import { planLimits, prisma, type Role } from "@layoutcraft/db";
import { atLeast, hashToken, newToken, type SessionContext } from "./auth.js";
import { AccessError } from "./errors.js";

/** Studio settings, members and invites. */

export async function getOrg(session: SessionContext) {
  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    include: {
      subscription: true,
      members: {
        include: { user: { select: { id: true, email: true, name: true, lastSeenAt: true } } },
        orderBy: { createdAt: "asc" },
      },
      invites: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" } },
      rateCards: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!org) throw new AccessError("Your studio could not be found.", 404);
  return org;
}

export interface StudioSettingsInput {
  name?: string;
  studioName?: string | null;
  studioAddress?: string | null;
  studioContact?: string | null;
  taxId?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  defaultCurrency?: string;
  defaultUnits?: string;
  defaultTaxLabel?: string;
  defaultTaxRate?: number;
  defaultTerms?: string | null;
}

export async function updateStudio(session: SessionContext, input: StudioSettingsInput) {
  if (!atLeast(session.role, "ADMIN")) {
    throw new AccessError("Only an owner or admin can change studio settings.");
  }
  const clean = <T extends string | null | undefined>(v: T, max: number) =>
    typeof v === "string" ? (v.trim().slice(0, max) || null) : v;

  // A hex colour goes straight into an inline style on a client-facing page,
  // so it is validated rather than trusted.
  const brandColor =
    typeof input.brandColor === "string"
      ? /^#[0-9a-fA-F]{6}$/.test(input.brandColor.trim())
        ? input.brandColor.trim()
        : null
      : input.brandColor;

  return prisma.organization.update({
    where: { id: session.orgId },
    data: {
      name: input.name?.trim().slice(0, 120) || undefined,
      studioName: clean(input.studioName, 120),
      studioAddress: clean(input.studioAddress, 400),
      studioContact: clean(input.studioContact, 200),
      taxId: clean(input.taxId, 40),
      logoUrl: clean(input.logoUrl, 600),
      brandColor,
      defaultCurrency: input.defaultCurrency?.slice(0, 8),
      defaultUnits: input.defaultUnits === "imperial" ? "imperial" : input.defaultUnits ? "metric" : undefined,
      defaultTaxLabel: input.defaultTaxLabel?.trim().slice(0, 40),
      defaultTaxRate:
        typeof input.defaultTaxRate === "number" && Number.isFinite(input.defaultTaxRate)
          ? Math.max(0, Math.min(100, input.defaultTaxRate))
          : undefined,
      defaultTerms: clean(input.defaultTerms, 8000),
    },
  });
}

/* ------------------------------------------------------------------ *
 * Members
 * ------------------------------------------------------------------ */

export const INVITE_DAYS = 14;

export async function inviteMember(
  session: SessionContext,
  email: string,
  role: Role,
): Promise<{ token: string; expiresAt: Date }> {
  if (!atLeast(session.role, "ADMIN")) {
    throw new AccessError("Only an owner or admin can invite people.");
  }
  if (role === "OWNER") {
    throw new AccessError("Transfer ownership from the members list instead.");
  }

  const limits = planLimits(session.plan);
  if (limits.maxSeats >= 0) {
    const used = await prisma.membership.count({ where: { orgId: session.orgId } });
    const pending = await prisma.invite.count({
      where: { orgId: session.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
    });
    if (used + pending >= limits.maxSeats) {
      throw new AccessError(
        `The ${limits.label} plan includes ${limits.maxSeats} seat${limits.maxSeats === 1 ? "" : "s"}. Upgrade to add more.`,
        402,
      );
    }
  }

  const clean = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) {
    throw new AccessError("That does not look like an email address.", 400);
  }

  const already = await prisma.membership.findFirst({
    where: { orgId: session.orgId, user: { email: clean } },
  });
  if (already) throw new AccessError("They are already in your studio.", 400);

  const token = newToken();
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 86_400_000);

  // one live invite per address, so re-inviting replaces rather than stacks
  await prisma.invite.deleteMany({ where: { orgId: session.orgId, email: clean, acceptedAt: null } });
  await prisma.invite.create({
    data: {
      orgId: session.orgId,
      email: clean,
      role,
      tokenHash: hashToken(token),
      invitedBy: session.user.id,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function acceptInvite(
  token: string,
  userId: string,
): Promise<{ ok: true; orgId: string } | { ok: false; error: string }> {
  const invite = await prisma.invite.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite) return { ok: false, error: "That invitation link is not valid." };
  if (invite.acceptedAt) return { ok: false, error: "That invitation has already been used." };
  if (invite.expiresAt < new Date()) return { ok: false, error: "That invitation has expired." };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Sign in first, then open the invitation again." };
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return {
      ok: false,
      error: `That invitation was sent to ${invite.email}. Sign in with that address.`,
    };
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_orgId: { userId, orgId: invite.orgId } },
      create: { userId, orgId: invite.orgId, role: invite.role },
      update: { role: invite.role },
    }),
    prisma.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);

  return { ok: true, orgId: invite.orgId };
}

export async function changeRole(session: SessionContext, membershipId: string, role: Role) {
  if (!atLeast(session.role, "ADMIN")) {
    throw new AccessError("Only an owner or admin can change roles.");
  }
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: session.orgId },
  });
  if (!membership) throw new AccessError("That member does not exist.", 404);

  if (membership.role === "OWNER" || role === "OWNER") {
    if (session.role !== "OWNER") {
      throw new AccessError("Only the owner can transfer ownership.");
    }
    if (role === "OWNER") {
      // exactly one owner at a time: step the current one down to admin
      await prisma.$transaction([
        prisma.membership.updateMany({
          where: { orgId: session.orgId, role: "OWNER" },
          data: { role: "ADMIN" },
        }),
        prisma.membership.update({ where: { id: membershipId }, data: { role: "OWNER" } }),
      ]);
      return;
    }
  }

  await prisma.membership.update({ where: { id: membershipId }, data: { role } });
}

export async function removeMember(session: SessionContext, membershipId: string) {
  if (!atLeast(session.role, "ADMIN")) {
    throw new AccessError("Only an owner or admin can remove people.");
  }
  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, orgId: session.orgId },
  });
  if (!membership) throw new AccessError("That member does not exist.", 404);
  if (membership.role === "OWNER") {
    throw new AccessError("Transfer ownership before removing the owner.");
  }
  await prisma.membership.delete({ where: { id: membershipId } });
}

/* ------------------------------------------------------------------ *
 * Rate cards
 * ------------------------------------------------------------------ */

export async function saveRateCard(
  session: SessionContext,
  input: { id?: string; name: string; rates: Record<string, number>; isDefault?: boolean },
) {
  if (!atLeast(session.role, "ADMIN")) {
    throw new AccessError("Only an owner or admin can edit rate cards.");
  }
  const rates = Object.fromEntries(
    Object.entries(input.rates)
      .filter(([, v]) => Number.isFinite(v) && v >= 0)
      .map(([k, v]) => [k, Math.round(v)]),
  );

  if (input.isDefault) {
    await prisma.rateCard.updateMany({
      where: { orgId: session.orgId },
      data: { isDefault: false },
    });
  }

  if (input.id) {
    const existing = await prisma.rateCard.findFirst({
      where: { id: input.id, orgId: session.orgId },
    });
    if (!existing) throw new AccessError("That rate card does not exist.", 404);
    return prisma.rateCard.update({
      where: { id: input.id },
      data: { name: input.name.trim().slice(0, 80), rates, isDefault: input.isDefault ?? false },
    });
  }

  return prisma.rateCard.create({
    data: {
      orgId: session.orgId,
      name: input.name.trim().slice(0, 80) || "Rate card",
      rates,
      isDefault: input.isDefault ?? false,
    },
  });
}

export async function deleteRateCard(session: SessionContext, id: string) {
  if (!atLeast(session.role, "ADMIN")) throw new AccessError("You cannot delete rate cards.");
  const card = await prisma.rateCard.findFirst({ where: { id, orgId: session.orgId } });
  if (!card) throw new AccessError("That rate card does not exist.", 404);
  await prisma.rateCard.delete({ where: { id } });
}

export async function defaultRateCard(orgId: string) {
  return prisma.rateCard.findFirst({ where: { orgId, isDefault: true } });
}

/* ------------------------------------------------------------------ *
 * Audit
 * ------------------------------------------------------------------ */

export async function audit(
  session: SessionContext,
  action: string,
  target?: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog
    .create({
      data: {
        orgId: session.orgId,
        userId: session.user.id,
        action,
        target,
        metadata: metadata as never,
      },
    })
    .catch(() => {
      // auditing must never be the reason a user action fails
    });
}
