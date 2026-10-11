import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiSession,
  audit,
  createShareLink,
  listShareLinks,
  revokeShareLink,
  shareUrl,
  toResponseError,
} from "@/server";

const createSchema = z.object({
  scope: z.enum(["PRESENTATION", "QUOTE", "FULL"]),
  pinToCurrentVersion: z.boolean().optional(),
  allowComments: z.boolean().optional(),
  password: z.string().min(4).max(128).optional(),
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    const links = await listShareLinks(session, id);
    // never return the password hash to the browser
    return NextResponse.json({
      links: links.map((link) => ({
        id: link.id,
        token: link.token,
        scope: link.scope,
        versionId: link.versionId,
        expiresAt: link.expiresAt,
        viewCount: link.viewCount,
        allowComments: link.allowComments,
        createdAt: link.createdAt,
        hasPassword: Boolean(link.passwordHash),
      })),
    });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    const body = createSchema.parse(await request.json());
    const link = await createShareLink(session, id, body);
    await audit(session, "share.create", id, { scope: body.scope, pinned: Boolean(body.pinToCurrentVersion) });

    const origin = new URL(request.url).origin;
    return NextResponse.json(
      { id: link.id, token: link.token, url: shareUrl(link.token, origin) },
      { status: 201 },
    );
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await apiSession();
    const { id } = await params;
    const linkId = new URL(request.url).searchParams.get("id");
    if (!linkId) return NextResponse.json({ error: "Which link?" }, { status: 400 });
    await revokeShareLink(session, linkId);
    await audit(session, "share.revoke", id, { linkId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
