import { NextResponse } from "next/server";
import { apiSession, audit, duplicate, toResponseError } from "@/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    const copy = await duplicate(session, id);
    await audit(session, "project.duplicate", copy.id, { from: id });
    return NextResponse.json({ id: copy.id }, { status: 201 });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
