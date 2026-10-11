import { parseProject } from "@layoutcraft/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiSession,
  archiveProject,
  audit,
  deleteProject,
  getProject,
  maybeVersion,
  saveProject,
  setStatus,
  toResponseError,
} from "@/server";

const patchSchema = z.object({
  design: z.unknown().optional(),
  status: z
    .enum(["DRAFT", "QUOTED", "APPROVED", "IN_PRODUCTION", "COMPLETED", "LOST"])
    .optional(),
  archived: z.boolean().optional(),
  snapshotLabel: z.string().max(120).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    const { design } = await getProject(session, id);
    return NextResponse.json({ design });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    const body = patchSchema.parse(await request.json());

    if (body.status) await setStatus(session, id, body.status);
    if (body.archived !== undefined) await archiveProject(session, id, body.archived);

    if (body.design !== undefined) {
      // The editor is a client that we do not trust: re-validate the whole
      // document on the way in, so a bug or a tampered request cannot write a
      // shape the renderer or the quote engine will choke on later.
      const parsed = parseProject(body.design, { strict: true });
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      // keep the id the route named, not whatever the body claimed
      parsed.project.id = id;
      await saveProject(session, id, parsed.project, {
        snapshotLabel: body.snapshotLabel,
      });
      await maybeVersion(session, id, parsed.project);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    await deleteProject(session, id);
    await audit(session, "project.delete", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
