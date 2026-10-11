import { NextResponse } from "next/server";
import { z } from "zod";
import { addComment, resolveShare, toResponseError } from "@/server";

const schema = z.object({
  authorName: z.string().min(1).max(120),
  authorEmail: z.string().email().max(200).optional(),
  body: z.string().min(1).max(4000),
  targetKind: z.enum(["PROJECT", "ROOM", "ITEM", "QUOTE_LINE"]).optional(),
  targetId: z.string().max(80).optional(),
  password: z.string().max(128).optional(),
});

/**
 * A client leaving a comment on a share link.
 *
 * The token is re-resolved here rather than trusting ids from the body, so a
 * comment can only ever be attached to the project the link actually points at.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const input = schema.parse(await request.json());

    const resolved = await resolveShare(token, input.password);
    if (!resolved.ok) {
      return NextResponse.json({ error: "This link is no longer open." }, { status: 403 });
    }
    if (!resolved.share.allowComments) {
      return NextResponse.json({ error: "Comments are closed on this link." }, { status: 403 });
    }

    await addComment({
      shareLinkId: resolved.share.shareLinkId,
      projectId: resolved.share.projectId,
      authorName: input.authorName,
      authorEmail: input.authorEmail,
      body: input.body,
      targetKind: input.targetKind,
      targetId: input.targetId,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    const { message, status } = toResponseError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
