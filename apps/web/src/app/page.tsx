import { PLAN_LIMITS } from "@layoutcraft/db";
import {
  ArrowRight,
  Box,
  Camera,
  ClipboardList,
  Footprints,
  Layers,
  Lightbulb,
  Ruler,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/server";

export default async function LandingPage() {
  // signed-in designers do not want a marketing page
  const session = await getSession();
  if (session) redirect("/projects");

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-[1100px] px-5 pb-16 pt-14 sm:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1 text-[12px] text-muted">
            <Sparkles size={13} className="text-accent" /> For interior design studios
          </p>
          <h1 className="m-0 max-w-[22ch] font-display text-[clamp(2.2rem,6vw,4rem)] font-bold leading-[1.04] tracking-[-0.025em]">
            From the builder&rsquo;s plan to a signed quotation.
          </h1>
          <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-muted">
            Draw the flat once. Layoutcraft furnishes every room to a layout that actually clears the
            doors, renders it well enough to show a client, and prices it from the same drawing — so
            the quote can never disagree with the design.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="btn btn-primary px-5 py-2.5 text-[14px]">
              Start a 14-day trial <ArrowRight size={15} />
            </Link>
            <Link href="/login" className="btn px-5 py-2.5 text-[14px]">
              Sign in
            </Link>
            <span className="text-[12.5px] text-muted">No card needed to start.</span>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-5 pb-20">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              icon={<Ruler size={17} />}
              title="Draw in real millimetres"
              body="Rooms are dimensioned wall centre to wall centre, the way a builder's drawing is. Trace a client's plan underneath and draw straight over it."
            />
            <Feature
              icon={<Sparkles size={17} />}
              title="Layouts that fit"
              body="Thirty designer layouts, each tried in eight orientations against the real room and its real doors. The engine scores every arrangement and hands you the one that works."
            />
            <Feature
              icon={<ClipboardList size={17} />}
              title="A design review that means something"
              body="Blocked door swings, walkways under 600 mm, a wardrobe with no room to open, a bed you can only reach from one side, a kitchen triangle that does not work."
            />
            <Feature
              icon={<Camera size={17} />}
              title="Renders, not block models"
              body="Procedural PBR materials, image-based lighting that follows the time of day, soft shadows and ambient occlusion. Press Render for a 4K still to put in a deck."
            />
            <Feature
              icon={<Footprints size={17} />}
              title="Walk the client through it"
              body="Switch to eye level and walk the flat with W A S D. Send a share link and let the client do the same on their own phone."
            />
            <Feature
              icon={<Layers size={17} />}
              title="Six finish schedules"
              body="Modern, Indo-contemporary, Scandinavian, Industrial, Japandi and Luxe classic. Switching style re-skins the whole flat and re-prices it."
            />
            <Feature
              icon={<Box size={17} />}
              title="Files for everyone downstream"
              body="Quotation and bill of materials as spreadsheets, an OBJ massing model for your visualiser, and print-ready STLs for a 1:50 presentation model."
            />
            <Feature
              icon={<Lightbulb size={17} />}
              title="Lighting as a line item"
              body="Cove runs, track spots, pendants and chandeliers are real fittings that light the render and appear on the quote by the metre."
            />
            <Feature
              icon={<ClipboardList size={17} />}
              title="Quotes that stay put"
              body="Freeze a share link at today's version. Keep designing without changing the number the client is deciding on."
            />
          </div>
        </section>

        <section className="border-y border-line bg-panel py-16">
          <div className="mx-auto max-w-[1100px] px-5">
            <h2 className="m-0 font-display text-[28px] font-bold tracking-tight">How a job runs</h2>
            <ol className="mt-7 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Draw the shell", "Trace the builder's plan or type the room sizes. Add doors, windows and openings."],
                ["Furnish it", "One button lays out every room. Step through arrangements until one suits the client."],
                ["Show them", "Walk the flat in 3D at the time of day they will use it. Render stills for the deck."],
                ["Send the quote", "The priced schedule comes from the same drawing. Share a frozen link and keep working."],
              ].map(([title, body], index) => (
                <li key={title} className="flex flex-col gap-2">
                  <span className="font-mono text-[12px] text-accent">0{index + 1}</span>
                  <b className="font-display text-[16px] font-semibold">{title}</b>
                  <span className="text-[13.5px] leading-relaxed text-muted">{body}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-5 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="m-0 font-display text-[28px] font-bold tracking-tight">Pricing</h2>
            <Link href="/pricing" className="text-[13.5px] text-accent hover:underline">
              Full comparison
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(["SOLO", "STUDIO", "PRACTICE"] as const).map((key) => {
              const plan = PLAN_LIMITS[key]!;
              return (
                <div
                  key={key}
                  className="flex flex-col gap-3 rounded-xl border border-line bg-paper p-5 shadow-card"
                >
                  <b className="font-display text-[17px] font-bold">{plan.label}</b>
                  <p className="m-0">
                    <span className="tnum text-[26px] font-semibold">
                      ₹{plan.priceInr.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[13px] text-muted"> / seat / month</span>
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px] text-muted">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link href="/signup" className="btn mt-auto">
                    Start a trial
                  </Link>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-[12.5px] text-muted">
            Billed per seat, monthly or yearly. Every plan includes the full editor, the 3D view and
            client share links.
          </p>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
          <span>Layoutcraft Studio</span>
          <nav className="flex gap-4">
            <Link href="/pricing" className="hover:text-ink">
              Pricing
            </Link>
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-[1100px] items-center gap-4 px-5 py-4">
        <Wordmark />
        <nav className="ml-auto flex items-center gap-2">
          <Link href="/pricing" className="btn btn-ghost btn-sm">
            Pricing
          </Link>
          <Link href="/login" className="btn btn-sm">
            Sign in
          </Link>
          <Link href="/signup" className="btn btn-primary btn-sm">
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="flex shrink-0 items-center gap-2.5">
      <svg viewBox="0 0 26 26" className="h-6 w-6" aria-hidden>
        <rect
          x="2"
          y="2"
          width="22"
          height="22"
          rx="4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path d="M2 14h11V2M13 14v10M13 19h11" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M13 9a5 5 0 0 1 5 5" fill="none" stroke="var(--accent)" strokeWidth="2" />
      </svg>
      <span className="font-display text-[18px] font-bold tracking-[-0.015em]">Layoutcraft</span>
    </Link>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-paper p-5">
      <span className="text-accent">{icon}</span>
      <b className="font-display text-[15.5px] font-semibold">{title}</b>
      <p className="m-0 text-[13.5px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
