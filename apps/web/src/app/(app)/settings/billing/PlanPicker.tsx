"use client";

import type { PlanLimits } from "@layoutcraft/db";
import { Check, CreditCard, ExternalLink } from "lucide-react";
import { useState } from "react";
import { Note, SegmentedControl, Section, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

type PlanKey = "SOLO" | "STUDIO" | "PRACTICE";

export function PlanPicker({
  plans,
  currentPlan,
  seatsUsed,
  hasSubscription,
  disabled,
}: {
  plans: Array<PlanLimits & { key: PlanKey }>;
  currentPlan: string;
  seatsUsed: number;
  hasSubscription: boolean;
  disabled?: boolean;
}) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [seats, setSeats] = useState(Math.max(1, seatsUsed));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (plan: PlanKey) => {
    setBusy(plan);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval, seats }),
      });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        setError(body.error ?? "Checkout could not be started.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  const portal = async () => {
    setBusy("portal");
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", { method: "POST" });
      const body = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !body.url) {
        setError(body.error ?? "The billing portal could not be opened.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  // Stripe's own yearly prices should carry the discount; this is only the
  // figure shown next to the toggle so the saving is visible before checkout.
  const yearlyDiscount = 0.84;

  return (
    <Section title="Choose a plan">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SegmentedControl
          value={interval}
          options={[
            { value: "month", label: "Monthly" },
            { value: "year", label: "Yearly · save 16%" },
          ]}
          onChange={(v) => setInterval(v as "month" | "year")}
        />
        <label className="field w-28">
          <span>Seats</span>
          <input
            className="input input-num"
            type="number"
            min={1}
            max={500}
            value={seats}
            onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>
      </div>

      {seats < seatsUsed ? (
        <Note tone="warn">
          You have {seatsUsed} people in the studio. Buying {seats} seat
          {seats === 1 ? "" : "s"} will not remove anyone, but Stripe will bill for the number you
          choose here.
        </Note>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => {
          const monthly =
            interval === "year" ? Math.round(plan.priceInr * yearlyDiscount) : plan.priceInr;
          const isCurrent = currentPlan === plan.key;
          const overSeats = plan.maxSeats >= 0 && seats > plan.maxSeats;

          return (
            <div
              key={plan.key}
              className={cn(
                "flex flex-col gap-3 rounded-xl border bg-paper p-5",
                isCurrent ? "border-accent ring-1 ring-accent" : "border-line",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <b className="font-display text-[17px] font-bold">{plan.label}</b>
                {isCurrent ? (
                  <span className="flex items-center gap-1 text-[11.5px] text-accent">
                    <Check size={13} /> current
                  </span>
                ) : null}
              </div>

              <p className="m-0">
                <span className="tnum text-[26px] font-semibold">
                  ₹{monthly.toLocaleString("en-IN")}
                </span>
                <span className="text-[12.5px] text-muted"> / seat / month</span>
              </p>
              <p className="m-0 text-[12px] text-muted">
                {seats} seat{seats === 1 ? "" : "s"} ·{" "}
                <b className="tnum font-semibold text-ink">
                  ₹{(monthly * seats * (interval === "year" ? 12 : 1)).toLocaleString("en-IN")}
                </b>{" "}
                per {interval === "year" ? "year" : "month"}
              </p>

              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px] text-muted">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5">
                    <Check size={13} className="mt-0.5 shrink-0 text-good" />
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                className={cn("btn mt-auto", !isCurrent && "btn-primary")}
                disabled={disabled || busy !== null || overSeats}
                onClick={() => void go(plan.key)}
                title={
                  overSeats
                    ? `${plan.label} allows at most ${plan.maxSeats} seats`
                    : undefined
                }
              >
                {busy === plan.key ? <Spinner /> : <CreditCard size={14} />}
                {overSeats
                  ? `Max ${plan.maxSeats} seats`
                  : isCurrent
                    ? "Change seats or interval"
                    : `Choose ${plan.label}`}
              </button>
            </div>
          );
        })}
      </div>

      {hasSubscription ? (
        <button type="button" className="btn self-start" disabled={busy !== null} onClick={portal}>
          {busy === "portal" ? <Spinner /> : <ExternalLink size={14} />} Invoices, card and
          cancellation
        </button>
      ) : null}

      {error ? <p className="m-0 text-[12.5px] text-bad">{error}</p> : null}
    </Section>
  );
}
