import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, audit, listVersions, restoreVersion, toResponseError } from "@/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    return NextResponse.json({ versions: await listVersions(session, id) });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    const { versionId } = z.object({ versionId: z.string() }).parse(await request.json());
    await restoreVersion(session, id, versionId);
    await audit(session, "project.restore", id, { versionId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
