import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptInvite, getSession } from "@/server";

export const metadata: Metadata = { title: "Join a studio", robots: { index: false } };

/**
 * Accepting an invitation.
 *
 * The invitee must already be signed in as the address the invite was sent to,
 * so an invitation can never be used to join a studio as somebody else.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();

  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const result = await acceptInvite(token, session.user.id);
  if (result.ok) redirect("/projects?welcome=1");

  return (
    <div className="grid min-h-dvh place-items-center px-5 text-center">
      <div className="max-w-[46ch]">
        <h1 className="m-0 font-display text-[24px] font-bold tracking-tight">
          That invitation did not work
        </h1>
        <p className="mt-2 text-[14px] text-muted">{result.error}</p>
        <p className="mt-5 text-[13px] text-muted">
          You are signed in as {session.user.email}.{" "}
          <Link href="/projects" className="text-accent hover:underline">
            Go to your projects
          </Link>
        </p>
      </div>
    </div>
  );
}
