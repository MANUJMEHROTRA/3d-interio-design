import { planLimits, prisma } from "@layoutcraft/db";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { AccessError, getProject, requireSession } from "@/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const session = await requireSession(`/projects/${id}`);
  const record = await prisma.project.findFirst({
    where: { id, orgId: session.orgId },
    select: { name: true },
  });
  return { title: record?.name ?? "Project" };
}

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession(`/projects/${id}`);

  let design;
  try {
    ({ design } = await getProject(session, id));
  } catch (error) {
    if (error instanceof AccessError && error.status === 404) notFound();
    throw error;
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: {
      name: true,
      studioName: true,
      studioAddress: true,
      studioContact: true,
      taxId: true,
      logoUrl: true,
      brandColor: true,
    },
  });

  const limits = planLimits(session.plan);
  const canEdit = session.canEdit && session.role !== "VIEWER";

  return (
    <Editor
      projectId={id}
      initial={design}
      readOnly={!canEdit}
      studio={{
        name: org?.studioName ?? org?.name ?? session.orgName,
        address: org?.studioAddress ?? null,
        contact: org?.studioContact ?? null,
        taxId: org?.taxId ?? null,
        logoUrl: org?.logoUrl ?? null,
        brandColor: org?.brandColor ?? null,
        showBranding: !limits.whiteLabel,
      }}
      capabilities={{
        stillRender: limits.stillRender,
        modelExport: limits.modelExport,
        printExport: limits.printExport,
        shareLinks: limits.shareLinks,
      }}
    />
  );
}
