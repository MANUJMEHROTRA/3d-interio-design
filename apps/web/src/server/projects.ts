import {
  buildQuote,
  cloneProject,
  duplicateProject,
  parseProject,
  sampleProject,
  blankProject,
  type Project as DesignProject,
} from "@layoutcraft/core";
import { planLimits, prisma, type Prisma } from "@layoutcraft/db";
import { atLeast, type SessionContext } from "./auth.js";
import { AccessError } from "./errors.js";

/**
 * Project persistence.
 *
 * Every read and write goes through a function that takes the session, so
 * tenancy is enforced in one place. There is no code path that loads a project
 * by id alone.
 */

/** Fields the gallery needs, denormalised from the design document. */
function summarise(design: DesignProject) {
  const quote = buildQuote(design);
  return {
    name: design.name,
    clientName: design.client,
    roomCount: design.rooms.length,
    itemCount: design.items.length,
    quoteTotal: quote.total,
    currency: design.currency.code,
    styleId: design.styleId,
  };
}

export async function listProjects(session: SessionContext, includeArchived = false) {
  return prisma.project.findMany({
    where: {
      orgId: session.orgId,
      ...(includeArchived ? {} : { archivedAt: null }),
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      clientName: true,
      status: true,
      roomCount: true,
      itemCount: true,
      quoteTotal: true,
      currency: true,
      styleId: true,
      thumbnailUrl: true,
      updatedAt: true,
      createdAt: true,
      archivedAt: true,
      createdBy: { select: { name: true, email: true } },
      _count: { select: { shareLinks: true, comments: true } },
    },
  });
}

export async function getProject(
  session: SessionContext,
  id: string,
): Promise<{ record: Awaited<ReturnType<typeof prisma.project.findFirst>>; design: DesignProject }> {
  const record = await prisma.project.findFirst({
    where: { id, orgId: session.orgId },
  });
  if (!record) throw new AccessError("That project does not exist, or is not yours.", 404);

  const parsed = parseProject(record.data);
  if (!parsed.ok) {
    throw new AccessError(`This project could not be opened: ${parsed.error}`, 422);
  }
  return { record, design: parsed.project };
}

/** How many projects the plan still allows. */
export async function projectQuota(session: SessionContext) {
  const limits = planLimits(session.plan);
  if (limits.maxProjects < 0) return { used: 0, limit: -1, remaining: Infinity };
  const used = await prisma.project.count({
    where: { orgId: session.orgId, archivedAt: null },
  });
  return { used, limit: limits.maxProjects, remaining: limits.maxProjects - used };
}

export async function createProject(
  session: SessionContext,
  options: { from: "sample" | "blank" | DesignProject; name?: string },
) {
  if (!atLeast(session.role, "DESIGNER")) {
    throw new AccessError("Viewers cannot create projects.");
  }
  if (!session.canEdit) {
    throw new AccessError("Your subscription has lapsed, so projects are read-only.", 402);
  }

  const quota = await projectQuota(session);
  if (quota.limit >= 0 && quota.remaining <= 0) {
    throw new AccessError(
      `The ${planLimits(session.plan).label} plan includes ${quota.limit} projects. Upgrade to add more.`,
      402,
    );
  }

  const org = await prisma.organization.findUnique({ where: { id: session.orgId } });

  let design: DesignProject;
  if (options.from === "sample") design = sampleProject();
  else if (options.from === "blank") design = blankProject(options.name ?? "New project");
  else design = cloneProject(options.from);

  if (options.name) design.name = options.name;

  // apply the studio's defaults so a new project is already set up correctly
  if (org) {
    design.units = org.defaultUnits === "imperial" ? "imperial" : "metric";
    design.quote.taxes = [{ label: org.defaultTaxLabel, rate: org.defaultTaxRate }];
    if (org.defaultTerms) design.quote.terms = org.defaultTerms;
  }

  const summary = summarise(design);
  return prisma.project.create({
    data: {
      orgId: session.orgId,
      createdById: session.user.id,
      data: design as unknown as Prisma.InputJsonValue,
      ...summary,
    },
  });
}

export async function saveProject(
  session: SessionContext,
  id: string,
  design: DesignProject,
  options: { snapshotLabel?: string } = {},
) {
  if (!atLeast(session.role, "DESIGNER")) {
    throw new AccessError("Viewers cannot change projects.");
  }
  if (!session.canEdit) {
    throw new AccessError("Your subscription has lapsed, so projects are read-only.", 402);
  }

  const existing = await prisma.project.findFirst({
    where: { id, orgId: session.orgId },
    select: { id: true, updatedAt: true },
  });
  if (!existing) throw new AccessError("That project does not exist, or is not yours.", 404);

  design.updatedAt = Date.now();
  const summary = summarise(design);

  const [updated] = await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { data: design as unknown as Prisma.InputJsonValue, ...summary },
    }),
    ...(options.snapshotLabel
      ? [
          prisma.projectVersion.create({
            data: {
              projectId: id,
              data: design as unknown as Prisma.InputJsonValue,
              label: options.snapshotLabel,
              isSnapshot: true,
              createdById: session.user.id,
            },
          }),
        ]
      : []),
  ]);

  return updated;
}

/**
 * Keep a version if the last one is older than the interval.
 *
 * Autosave fires every couple of seconds while someone drags furniture; a
 * version per autosave would be unusable as history and expensive to store.
 * One version every ten minutes of active editing is what a designer actually
 * wants to roll back to.
 */
const VERSION_INTERVAL_MS = 10 * 60_000;

export async function maybeVersion(
  session: SessionContext,
  projectId: string,
  design: DesignProject,
) {
  const latest = await prisma.projectVersion.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < VERSION_INTERVAL_MS) return null;

  const limits = planLimits(session.plan);
  const created = await prisma.projectVersion.create({
    data: {
      projectId,
      data: design as unknown as Prisma.InputJsonValue,
      createdById: session.user.id,
    },
  });

  // prune beyond the plan's retention, but never a snapshot a client has seen
  if (limits.historyDays > 0) {
    const cutoff = new Date(Date.now() - limits.historyDays * 86_400_000);
    await prisma.projectVersion
      .deleteMany({
        where: { projectId, createdAt: { lt: cutoff }, isSnapshot: false },
      })
      .catch(() => {});
  }

  return created;
}

export async function duplicate(session: SessionContext, id: string) {
  const { design, record } = await getProject(session, id);
  if (!record) throw new AccessError("That project does not exist.", 404);
  const copy = duplicateProject(design);
  return createProject(session, { from: copy, name: copy.name });
}

export async function archiveProject(session: SessionContext, id: string, archived: boolean) {
  if (!atLeast(session.role, "DESIGNER")) throw new AccessError("You cannot archive projects.");
  const record = await prisma.project.findFirst({
    where: { id, orgId: session.orgId },
    select: { id: true },
  });
  if (!record) throw new AccessError("That project does not exist.", 404);
  return prisma.project.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  });
}

export async function deleteProject(session: SessionContext, id: string) {
  // Deleting a project destroys quotes a client may still be considering, so
  // it is owner-and-admin only even though archiving is not.
  if (!atLeast(session.role, "ADMIN")) {
    throw new AccessError("Only an owner or admin can delete a project permanently.");
  }
  const record = await prisma.project.findFirst({
    where: { id, orgId: session.orgId },
    select: { id: true },
  });
  if (!record) throw new AccessError("That project does not exist.", 404);
  await prisma.project.delete({ where: { id } });
}

export async function setStatus(
  session: SessionContext,
  id: string,
  status: "DRAFT" | "QUOTED" | "APPROVED" | "IN_PRODUCTION" | "COMPLETED" | "LOST",
) {
  if (!atLeast(session.role, "DESIGNER")) throw new AccessError("You cannot change status.");
  const record = await prisma.project.findFirst({
    where: { id, orgId: session.orgId },
    select: { id: true },
  });
  if (!record) throw new AccessError("That project does not exist.", 404);
  return prisma.project.update({ where: { id }, data: { status } });
}

export async function listVersions(session: SessionContext, projectId: string) {
  await getProject(session, projectId);
  return prisma.projectVersion.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      label: true,
      isSnapshot: true,
      createdAt: true,
      createdBy: { select: { name: true, email: true } },
    },
  });
}

export async function restoreVersion(
  session: SessionContext,
  projectId: string,
  versionId: string,
) {
  if (!atLeast(session.role, "DESIGNER")) throw new AccessError("You cannot restore versions.");
  const version = await prisma.projectVersion.findFirst({
    where: { id: versionId, projectId, project: { orgId: session.orgId } },
  });
  if (!version) throw new AccessError("That version does not exist.", 404);

  const parsed = parseProject(version.data);
  if (!parsed.ok) throw new AccessError(`That version cannot be read: ${parsed.error}`, 422);

  // snapshot what we are about to replace, so restoring is itself undoable
  const current = await getProject(session, projectId);
  await prisma.projectVersion.create({
    data: {
      projectId,
      data: current.design as unknown as Prisma.InputJsonValue,
      label: "Before restore",
      createdById: session.user.id,
    },
  });

  return saveProject(session, projectId, parsed.project);
}

export { summarise as summariseDesign };
