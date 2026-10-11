import { PLAN_LIMITS } from "@layoutcraft/db";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Per-seat pricing for interior design studios. 14-day trial, no card needed.",
};

const PLANS = ["TRIAL", "SOLO", "STUDIO", "PRACTICE"] as const;

const ROWS: Array<[string, (p: (typeof PLAN_LIMITS)[string]) => string]> = [
  ["Projects", (p) => (p.maxProjects < 0 ? "Unlimited" : String(p.maxProjects))],
  ["Seats included", (p) => (p.maxSeats < 0 ? "Unlimited" : String(p.maxSeats))],
  ["Full editor and 3D view", () => "Yes"],
  ["Auto-layout and design review", () => "Yes"],
  ["Client share links", (p) => (p.shareLinks ? "Yes" : "—")],
  ["Client comments", (p) => (p.whiteLabel ? "Yes" : p.shareLinks ? "Yes" : "—")],
  ["4K still renders", (p) => (p.stillRender ? "Yes" : "—")],
  ["Quote, BOM and schedules", () => "Yes"],
  ["3D-print bundle", (p) => (p.printExport ? "Yes" : "—")],
  ["OBJ export for visualisers", (p) => (p.modelExport ? "Yes" : "—")],
  ["Your branding only", (p) => (p.whiteLabel ? "Yes" : "—")],
  ["Version history", (p) => (p.historyDays < 0 ? "Unlimited" : `${p.historyDays} days`)],
];

export default function PricingPage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-[1100px] items-center gap-4 px-5 py-4">
          <Link href="/" className="font-display text-[18px] font-bold tracking-[-0.015em]">
            Layoutcraft
          </Link>
          <nav className="ml-auto flex gap-2">
            <Link href="/login" className="btn btn-sm">Sign in</Link>
            <Link href="/signup" className="btn btn-primary btn-sm">Start free</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 py-14">
        <h1 className="m-0 font-display text-[clamp(2rem,5vw,3rem)] font-bold leading-tight tracking-tight">
          Priced per seat, not per project.
        </h1>
        <p className="mt-4 max-w-[56ch] text-[16px] leading-relaxed text-muted">
          A studio taking on more work should not pay more to draw it. Every plan includes the whole
          editor, the 3D view and client share links; the differences are seats, output formats and
          how long history is kept.
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((key) => {
            const plan = PLAN_LIMITS[key]!;
            return (
              <div
                key={key}
                className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-5 shadow-card"
              >
                <b className="font-display text-[17px] font-bold">{plan.label}</b>
                <p className="m-0">
                  {plan.priceInr === 0 ? (
                    <span className="text-[26px] font-semibold">Free</span>
                  ) : (
                    <>
                      <span className="tnum text-[26px] font-semibold">
                        ₹{plan.priceInr.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[12.5px] text-muted"> / seat / mo</span>
                    </>
                  )}
                </p>
                <p className="m-0 text-[12px] text-muted">
                  {plan.priceUsd === 0 ? "14 days" : `about $${plan.priceUsd} / seat / mo`}
                </p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[12.5px] text-muted">
                  {plan.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link href="/signup" className="btn mt-auto">
                  {plan.priceInr === 0 ? "Start the trial" : "Start a trial"}
                </Link>
              </div>
            );
          })}
        </div>

        <section className="mt-14">
          <h2 className="m-0 font-display text-[24px] font-bold tracking-tight">Side by side</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
              <thead>
                <tr>
                  <th className="label-caps border-b border-line px-3 py-2.5 text-left">Feature</th>
                  {PLANS.map((key) => (
                    <th key={key} className="label-caps border-b border-line px-3 py-2.5 text-center">
                      {PLAN_LIMITS[key]!.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, value]) => (
                  <tr key={label}>
                    <td className="border-b border-line2 px-3 py-2.5">{label}</td>
                    {PLANS.map((key) => (
                      <td key={key} className="tnum border-b border-line2 px-3 py-2.5 text-center text-muted">
                        {value(PLAN_LIMITS[key]!)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14 grid gap-5 sm:grid-cols-2">
          <Faq q="What happens when the trial ends?">
            Nothing is deleted. Your projects become read-only until you choose a plan, and unlock
            again the moment you do.
          </Faq>
          <Faq q="Can I change plan or seat count later?">
            Yes, at any time from Settings → Billing. Stripe prorates the difference.
          </Faq>
          <Faq q="Do my clients need an account?">
            No. A share link opens in any browser, with no sign-in. You decide whether it shows the
            design, the quotation, or both.
          </Faq>
          <Faq q="Can I take my data out?">
            Every project exports as a JSON document, and the quote, bill of materials and room
            schedule export as spreadsheets. The JSON re-imports into any account.
          </Faq>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8 text-center text-[12.5px] text-muted">
        Layoutcraft Studio
      </footer>
    </div>
  );
}

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div>
      <b className="font-display text-[15px] font-semibold">{q}</b>
      <p className="m-0 mt-1.5 text-[13.5px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}
