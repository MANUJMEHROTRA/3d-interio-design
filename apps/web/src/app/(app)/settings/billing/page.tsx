import { PLAN_LIMITS, planLimits } from "@layoutcraft/db";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { billingConfigured, requireSession, subscriptionFor } from "@/server";
import { Note, Pill, Section } from "@/components/ui";
import { PlanPicker } from "./PlanPicker";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await requireSession("/settings/billing");
  if (session.role !== "OWNER" && session.role !== "ADMIN") redirect("/settings");

  const [{ subscription, seatsUsed }, { checkout }] = await Promise.all([
    subscriptionFor(session.orgId),
    searchParams,
  ]);
  const limits = planLimits(session.plan);
  const configured = billingConfigured();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="m-0 font-display text-[26px] font-bold tracking-tight">Billing</h1>
        <p className="m-0 mt-1 text-[13px] text-muted">
          Billed per seat. Change or cancel whenever you like.
        </p>
      </header>

      {checkout === "success" ? (
        <p className="m-0 rounded-lg border border-good bg-good/10 px-3 py-2.5 text-[13px] text-good">
          Payment received. Your plan may take a few seconds to show here while Stripe confirms it.
        </p>
      ) : checkout === "cancelled" ? (
        <p className="m-0 rounded-lg border border-line bg-panel px-3 py-2.5 text-[13px] text-muted">
          Checkout cancelled — nothing has changed.
        </p>
      ) : null}

      <Section title="Current plan">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-paper p-4">
          <div className="min-w-0 flex-1">
            <b className="font-display text-[18px] font-bold">{limits.label}</b>
            <p className="m-0 mt-0.5 text-[13px] text-muted">
              {seatsUsed} of {limits.maxSeats < 0 ? "unlimited" : limits.maxSeats} seat
              {limits.maxSeats === 1 ? "" : "s"} in use
              {subscription?.currentPeriodEnd
                ? ` · renews ${subscription.currentPeriodEnd.toLocaleDateString()}`
                : ""}
              {subscription?.trialEndsAt && session.subscriptionStatus === "TRIALING"
                ? ` · trial ends ${subscription.trialEndsAt.toLocaleDateString()}`
                : ""}
            </p>
          </div>
          <Pill
            tone={
              session.subscriptionStatus === "ACTIVE"
                ? "ok"
                : session.subscriptionStatus === "TRIALING"
                  ? "on"
                  : session.subscriptionStatus === "PAST_DUE"
                    ? "warn"
                    : "bad"
            }
          >
            {session.subscriptionStatus.toLowerCase().replace("_", " ")}
          </Pill>
          {subscription?.cancelAtPeriodEnd ? <Pill tone="warn">cancels at period end</Pill> : null}
        </div>
      </Section>

      {!configured ? (
        <Note tone="warn">
          Stripe is not configured on this deployment, so checkout is disabled. Set
          STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and the STRIPE_PRICE_* variables, then restart.
        </Note>
      ) : null}

      <PlanPicker
        currentPlan={session.plan}
        seatsUsed={seatsUsed}
        hasSubscription={Boolean(subscription?.stripeSubscriptionId)}
        disabled={!configured}
        plans={(["SOLO", "STUDIO", "PRACTICE"] as const).map((key) => ({
          key,
          ...PLAN_LIMITS[key]!,
        }))}
      />

      <Section title="What each plan includes">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <thead>
              <tr>
                <th className="label-caps border-b border-line px-2 py-2 text-left">Feature</th>
                {(["TRIAL", "SOLO", "STUDIO", "PRACTICE"] as const).map((key) => (
                  <th key={key} className="label-caps border-b border-line px-2 py-2 text-center">
                    {PLAN_LIMITS[key]!.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Projects", (p: typeof PLAN_LIMITS.TRIAL) => (p!.maxProjects < 0 ? "Unlimited" : String(p!.maxProjects))],
                  ["Seats", (p) => (p!.maxSeats < 0 ? "Unlimited" : String(p!.maxSeats))],
                  ["Client share links", (p) => (p!.shareLinks ? "Yes" : "—")],
                  ["4K still renders", (p) => (p!.stillRender ? "Yes" : "—")],
                  ["3D-print bundle", (p) => (p!.printExport ? "Yes" : "—")],
                  ["OBJ export", (p) => (p!.modelExport ? "Yes" : "—")],
                  ["Your branding only", (p) => (p!.whiteLabel ? "Yes" : "—")],
                  ["Version history", (p) => (p!.historyDays < 0 ? "Unlimited" : `${p!.historyDays} days`)],
                ] as Array<[string, (p: (typeof PLAN_LIMITS)[string]) => string]>
              ).map(([label, value]) => (
                <tr key={label}>
                  <td className="border-b border-line2 px-2 py-2">{label}</td>
                  {(["TRIAL", "SOLO", "STUDIO", "PRACTICE"] as const).map((key) => (
                    <td
                      key={key}
                      className="tnum border-b border-line2 px-2 py-2 text-center text-muted"
                    >
                      {value(PLAN_LIMITS[key]!)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
