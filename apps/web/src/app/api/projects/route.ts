import { parseProject } from "@layoutcraft/core";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSession, audit, createProject, listProjects, toResponseError } from "@/server";

const createSchema = z.object({
  from: z.enum(["sample", "blank", "import"]),
  name: z.string().max(120).optional(),
  design: z.unknown().optional(),
});

export async function GET() {
  try {
    const session = await apiSession();
    return NextResponse.json({ projects: await listProjects(session) });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await apiSession();
    const body = createSchema.parse(await request.json());

    if (body.from === "import") {
      // an imported file is untrusted input: migrate and validate before it
      // is ever written to the database
      const parsed = parseProject(body.design, { strict: true });
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      const project = await createProject(session, {
        from: parsed.project,
        name: body.name ?? parsed.project.name,
      });
      await audit(session, "project.import", project.id, { name: project.name });
      return NextResponse.json({ id: project.id }, { status: 201 });
    }

    const project = await createProject(session, { from: body.from, name: body.name });
    await audit(session, "project.create", project.id, { from: body.from });
    return NextResponse.json({ id: project.id }, { status: 201 });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
