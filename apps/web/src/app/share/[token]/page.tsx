import type { Metadata } from "next";
import { resolveShare } from "@/server";
import { ClientPortal } from "./ClientPortal";
import { PasswordGate } from "./PasswordGate";

export const metadata: Metadata = {
  title: "Your design",
  // a client link must never end up in a search index
  robots: { index: false, follow: false, nocache: true },
};

const MESSAGES: Record<string, { title: string; body: string }> = {
  missing: {
    title: "This link does not exist",
    body: "Check the address, or ask your designer to send it again.",
  },
  revoked: {
    title: "This link has been withdrawn",
    body: "Your designer has closed it. Ask them for a new one.",
  },
  expired: {
    title: "This link has expired",
    body: "Ask your designer to send a fresh link.",
  },
  broken: {
    title: "This design could not be opened",
    body: "Something is wrong with the saved file. Please let your designer know.",
  },
};

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pw?: string }>;
}) {
  const [{ token }, { pw }] = await Promise.all([params, searchParams]);
  const result = await resolveShare(token, pw);

  if (!result.ok) {
    if (result.reason === "password") {
      return <PasswordGate token={token} wrong={Boolean(pw)} />;
    }
    const message = MESSAGES[result.reason] ?? MESSAGES.missing!;
    return (
      <div className="grid min-h-dvh place-items-center px-5 text-center">
        <div className="max-w-[44ch]">
          <h1 className="m-0 font-display text-[24px] font-bold tracking-tight">{message.title}</h1>
          <p className="mt-2 text-[14px] text-muted">{message.body}</p>
        </div>
      </div>
    );
  }

  return <ClientPortal token={token} share={result.share} password={pw} />;
}
