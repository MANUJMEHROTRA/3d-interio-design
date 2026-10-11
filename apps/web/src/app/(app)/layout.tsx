import { planLimits } from "@layoutcraft/db";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { requireSession } from "@/server";
import { AppNav } from "./AppNav";

/**
 * The signed-in shell.
 *
 * The editor needs the whole viewport, so the navigation is a single slim bar
 * rather than a sidebar, and it is the editor route that drops it entirely.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const limits = planLimits(session.plan);

  const trialDaysLeft = session.trialEndsAt
    ? Math.ceil((session.trialEndsAt.getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div className="min-h-dvh">
      {session.subscriptionStatus === "EXPIRED" ? (
        <Banner tone="bad">
          <AlertTriangle size={14} />
          Your trial has ended, so projects are read-only. Everything is still here.
          <Link href="/settings/billing" className="underline">
            Choose a plan
          </Link>
        </Banner>
      ) : session.subscriptionStatus === "PAST_DUE" ? (
        <Banner tone="warn">
          <AlertTriangle size={14} />
          We could not take the last payment. You can keep working for now.
          <Link href="/settings/billing" className="underline">
            Update your card
          </Link>
        </Banner>
      ) : session.subscriptionStatus === "TRIALING" && trialDaysLeft !== null && trialDaysLeft <= 7 ? (
        <Banner tone="info">
          {trialDaysLeft <= 0
            ? "Your trial ends today."
            : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left of your trial.`}
          <Link href="/settings/billing" className="underline">
            See the plans
          </Link>
        </Banner>
      ) : null}

      <AppNav
        orgName={session.orgName}
        userName={session.user.name ?? session.user.email}
        planLabel={limits.label}
        role={session.role}
      />

      <main className="mx-auto max-w-[1200px] px-5 py-7">{children}</main>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "bad" | "warn" | "info";
  children: React.ReactNode;
}) {
  const classes =
    tone === "bad"
      ? "bg-bad text-white"
      : tone === "warn"
        ? "bg-warn text-white"
        : "bg-accent-soft text-ink";
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 px-5 py-2 text-center text-[12.5px] ${classes}`}
    >
      {children}
    </div>
  );
}
