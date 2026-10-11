import { parseProject, type Project as DesignProject } from "@layoutcraft/core";
import { planLimits, prisma, type ShareScope } from "@layoutcraft/db";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { atLeast, type SessionContext } from "./auth.js";
import { AccessError } from "./errors.js";

/**
 * Client-facing share links.
 *
 * A link can be pinned to a version, which is the point: once a quote has gone
 * to a client, the designer must be able to keep editing without the number the
 * client is looking at changing underneath them.
 */

const TOKEN_BYTES = 18;

export const shareUrl = (token: string, base?: string): string =>
  `${base ?? process.env.NEXT_PUBLIC_APP_URL ?? ""}/share/${token}`;

export async function createShareLink(
  session: SessionContext,
  projectId: string,
  options: {
    scope: ShareScope;
    pinToCurrentVersion?: boolean;
    password?: string;
    expiresInDays?: number;
    allowComments?: boolean;
  },
) {
  if (!atLeast(session.role, "DESIGNER")) {
    throw new AccessError("You cannot share projects.");
  }
  const limits = planLimits(session.plan);
  if (!limits.shareLinks) {
    throw new AccessError("Share links are not included in your plan.", 402);
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.orgId },
  });
  if (!project) throw new AccessError("That project does not exist.", 404);

  let versionId: string | null = null;
  if (options.pinToCurrentVersion) {
    const snapshot = await prisma.projectVersion.create({
      data: {
        projectId,
        data: project.data as never,
        label: "Shared with client",
        isSnapshot: true,
        createdById: session.user.id,
      },
    });
    versionId = snapshot.id;
  }

  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return prisma.shareLink.create({
    data: {
      projectId,
      token,
      scope: options.scope,
      versionId,
      passwordHash: options.password ? await bcrypt.hash(options.password, 10) : null,
      expiresAt: options.expiresInDays
        ? new Date(Date.now() + options.expiresInDays * 86_400_000)
        : null,
      allowComments: options.allowComments ?? true,
      createdById: session.user.id,
    },
  });
}

export async function listShareLinks(session: SessionContext, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.orgId },
    select: { id: true },
  });
  if (!project) throw new AccessError("That project does not exist.", 404);
  return prisma.shareLink.findMany({
    where: { projectId, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeShareLink(session: SessionContext, id: string) {
  if (!atLeast(session.role, "DESIGNER")) throw new AccessError("You cannot revoke links.");
  const link = await prisma.shareLink.findFirst({
    where: { id, project: { orgId: session.orgId } },
    select: { id: true },
  });
  if (!link) throw new AccessError("That link does not exist.", 404);
  return prisma.shareLink.update({ where: { id }, data: { revokedAt: new Date() } });
}

export interface PublicShare {
  scope: ShareScope;
  allowComments: boolean;
  design: DesignProject;
  projectId: string;
  shareLinkId: string;
  studio: {
    name: string;
    address: string | null;
    contact: string | null;
    taxId: string | null;
    logoUrl: string | null;
    brandColor: string | null;
    /** False on plans that include white-labelling. */
    showBranding: boolean;
  };
  /** Set when the link is pinned, so the page can say so. */
  pinnedAt: Date | null;
}

export type ShareResult =
  | { ok: true; share: PublicShare }
  | { ok: false; reason: "missing" | "expired" | "revoked" | "password" | "broken" };

/**
 * Resolve a public token. Takes no session: this is the one path in the app
 * that serves data to someone who is not signed in, so it is deliberately
 * narrow and returns only what the chosen scope permits.
 */
export async function resolveShare(
  token: string,
  password?: string,
): Promise<ShareResult> {
  const link = await prisma.shareLink.findUnique({
    where: { token },
    include: {
      project: {
        include: { organization: { include: { subscription: true } } },
      },
    },
  });

  if (!link) return { ok: false, reason: "missing" };
  if (link.revokedAt) return { ok: false, reason: "revoked" };
  if (link.expiresAt && link.expiresAt < new Date()) return { ok: false, reason: "expired" };

  if (link.passwordHash) {
    if (!password) return { ok: false, reason: "password" };
    const valid = await bcrypt.compare(password, link.passwordHash);
    if (!valid) return { ok: false, reason: "password" };
  }

  let source: unknown = link.project.data;
  let pinnedAt: Date | null = null;
  if (link.versionId) {
    const version = await prisma.projectVersion.findUnique({ where: { id: link.versionId } });
    if (version) {
      source = version.data;
      pinnedAt = version.createdAt;
    }
  }

  const parsed = parseProject(source);
  if (!parsed.ok) return { ok: false, reason: "broken" };

  // A share link with the presentation scope must not leak prices, so the
  // rates are stripped from the document before it leaves the server rather
  // than merely hidden in the UI.
  const design = parsed.project;
  if (link.scope === "PRESENTATION") {
    design.rates = {};
    design.quote = {
      ...design.quote,
      designFeePct: 0,
      taxes: [],
      discountPct: 0,
      includeScaleModel: false,
    };
  }

  const org = link.project.organization;
  const limits = planLimits(org.subscription?.plan ?? "TRIAL");

  void prisma.shareLink
    .update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    })
    .catch(() => {});

  return {
    ok: true,
    share: {
      scope: link.scope,
      allowComments: link.allowComments,
      design,
      projectId: link.projectId,
      shareLinkId: link.id,
      studio: {
        name: org.studioName ?? org.name,
        address: org.studioAddress,
        contact: org.studioContact,
        taxId: org.taxId,
        logoUrl: org.logoUrl,
        brandColor: org.brandColor,
        showBranding: !limits.whiteLabel,
      },
      pinnedAt,
    },
  };
}

export async function addComment(input: {
  shareLinkId: string;
  projectId: string;
  authorName: string;
  authorEmail?: string;
  body: string;
  targetKind?: "PROJECT" | "ROOM" | "ITEM" | "QUOTE_LINE";
  targetId?: string;
}) {
  const link = await prisma.shareLink.findUnique({
    where: { id: input.shareLinkId },
    select: { id: true, projectId: true, allowComments: true, revokedAt: true },
  });
  if (!link || link.revokedAt || !link.allowComments) {
    throw new AccessError("Comments are closed on this link.", 403);
  }
  if (link.projectId !== input.projectId) {
    throw new AccessError("That comment does not belong to this project.", 400);
  }
  const body = input.body.trim().slice(0, 4000);
  if (!body) throw new AccessError("Write something first.", 400);

  return prisma.comment.create({
    data: {
      projectId: link.projectId,
      shareLinkId: link.id,
      authorName: input.authorName.trim().slice(0, 120) || "Client",
      authorEmail: input.authorEmail?.trim().slice(0, 200) || null,
      body,
      targetKind: input.targetKind ?? "PROJECT",
      targetId: input.targetId ?? null,
    },
  });
}

export async function listComments(session: SessionContext, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, orgId: session.orgId },
    select: { id: true },
  });
  if (!project) throw new AccessError("That project does not exist.", 404);
  return prisma.comment.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function resolveComment(session: SessionContext, id: string, resolved: boolean) {
  const comment = await prisma.comment.findFirst({
    where: { id, project: { orgId: session.orgId } },
    select: { id: true },
  });
  if (!comment) throw new AccessError("That comment does not exist.", 404);
  return prisma.comment.update({
    where: { id },
    data: { resolvedAt: resolved ? new Date() : null },
  });
}

export const hashShareToken = (t: string): string =>
  createHash("sha256").update(t).digest("hex");
