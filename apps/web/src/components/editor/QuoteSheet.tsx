"use client";

import {
  buildQuote,
  formatArea,
  formatMoney,
  getStyle,
  innerRect,
  type Currency,
  type Project,
  type Quote,
} from "@layoutcraft/core";
import { useMemo } from "react";
import { cn } from "@/lib/cn";

export interface StudioIdentity {
  name: string;
  address?: string | null;
  contact?: string | null;
  taxId?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  showBranding?: boolean;
}

/**
 * The quotation, as it prints.
 *
 * This is the document the client actually decides on, so it is laid out as a
 * document and not as an app screen: a fixed measure, real typographic
 * hierarchy, and a print stylesheet that drops the interface. The same
 * component renders in the editor, on the share link and in the print view, so
 * what the designer approves is exactly what the client receives.
 */
export function QuoteSheet({
  project,
  studio,
  editableRates = false,
  onRateChange,
  className,
}: {
  project: Project;
  studio: StudioIdentity;
  editableRates?: boolean;
  onRateChange?: (key: string, rate: number) => void;
  className?: string;
}) {
  const quote = useMemo(() => buildQuote(project), [project]);
  const style = getStyle(project.styleId);
  const carpetArea = project.rooms.reduce((sum, r) => {
    const inner = innerRect(r);
    return sum + inner.w * inner.d;
  }, 0);

  const today = new Date();
  const validUntil = new Date(today.getTime() + project.quote.validDays * 86_400_000);
  const dateFmt = (d: Date) =>
    d.toLocaleDateString(project.currency.locale, { day: "numeric", month: "short", year: "numeric" });

  const accent = studio.brandColor ?? undefined;

  return (
    <article
      className={cn(
        "print-page mx-auto flex w-full max-w-[860px] flex-col gap-7 rounded-xl border border-line bg-paper p-7 shadow-card sm:p-10",
        className,
      )}
    >
      <header
        className="flex flex-wrap items-start justify-between gap-5 border-b-2 pb-4"
        style={{ borderColor: accent ?? "var(--ink)" }}
      >
        <div className="flex items-start gap-3">
          {studio.logoUrl ? (
            // the studio's own mark, so the quote is theirs and not ours
            <img src={studio.logoUrl} alt="" className="h-12 w-auto object-contain" />
          ) : null}
          <div className="flex flex-col gap-0.5 text-[13px] text-muted">
            <b className="font-display text-[18px] font-bold text-ink">{studio.name}</b>
            {studio.address ? <span className="whitespace-pre-line">{studio.address}</span> : null}
            {studio.contact ? <span>{studio.contact}</span> : null}
            {studio.taxId ? <span>GSTIN {studio.taxId}</span> : null}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 text-right font-mono text-[12.5px] text-muted">
          <b
            className="font-display text-[20px] font-bold tracking-wide"
            style={{ color: accent ?? "var(--ink)" }}
          >
            QUOTATION
          </b>
          <span>{project.quote.number}</span>
          <span>{dateFmt(today)}</span>
          <span>Valid until {dateFmt(validUntil)}</span>
        </div>
      </header>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-4">
        <Meta label="Client" value={project.client || "—"} />
        <Meta label="Project" value={project.name} />
        {project.siteAddress ? <Meta label="Site" value={project.siteAddress} /> : null}
        <Meta label="Design style" value={style.name} />
        <Meta label="Carpet area" value={formatArea(carpetArea, project.units)} />
      </section>

      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[540px] border-collapse text-[13px]">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th numeric>Qty</Th>
              <Th numeric>Rate ({project.currency.code})</Th>
              <Th numeric>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {quote.groups.length ? (
              quote.groups.map((group) => (
                <RoomGroup
                  key={group.roomId ?? group.label}
                  group={group}
                  currency={project.currency}
                  editableRates={editableRates}
                  onRateChange={onRateChange}
                />
              ))
            ) : (
              <tr>
                <td colSpan={4} className="py-6 text-center text-[12.5px] text-muted">
                  Nothing has been specified yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="ml-auto flex w-full max-w-[360px] flex-col gap-1 text-[13.5px]">
        {quote.lines.map((line) => (
          <div
            key={line.label}
            className={cn(
              "flex justify-between gap-3",
              line.grand && "mt-1.5 border-t-2 border-ink pt-2 text-[16px] font-bold",
            )}
          >
            <span>{line.label}</span>
            <span className="tnum">
              {line.negative
                ? `(${formatMoney(Math.abs(line.amount), project.currency)})`
                : formatMoney(line.amount, project.currency)}
            </span>
          </div>
        ))}
      </section>

      {quote.clientSupplied.length ? (
        <p className="m-0 text-[12.5px] text-muted">
          Supplied by the client and not priced: {quote.clientSupplied.join(", ")}.
        </p>
      ) : null}

      {quote.leadWeeks ? (
        <p className="m-0 text-[12.5px] text-muted">
          Longest lead time in this scope is {quote.leadWeeks} weeks from sign-off of the final
          drawings.
        </p>
      ) : null}

      <footer className="whitespace-pre-wrap border-t border-line pt-4 text-[12.5px] leading-relaxed text-muted">
        {project.quote.terms}
      </footer>

      {studio.showBranding !== false ? (
        <p className="no-print m-0 text-center text-[11px] text-muted">
          Prepared with Layoutcraft Studio
        </p>
      ) : null}
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="label-caps">{label}</span>
      <b className="text-[13.5px] font-semibold">{value}</b>
    </div>
  );
}

function Th({ children, numeric }: { children: React.ReactNode; numeric?: boolean }) {
  return (
    <th
      className={cn(
        "label-caps border-b border-line px-2 py-1.5 font-semibold",
        numeric ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function RoomGroup({
  group,
  currency,
  editableRates,
  onRateChange,
}: {
  group: Quote["groups"][number];
  currency: Currency;
  editableRates: boolean;
  onRateChange?: (key: string, rate: number) => void;
}) {
  return (
    <>
      <tr>
        <td colSpan={3} className="border-b border-line pb-1.5 pt-5 text-[13px] font-semibold">
          {group.label}
        </td>
        <td className="tnum border-b border-line pb-1.5 pt-5 text-right text-[13px] font-medium">
          {formatMoney(group.total, currency)}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={row.key}>
          <td className="border-b border-line2 px-2 py-1.5 align-top">
            <span>{row.name}</span>
            {row.spec ? (
              <span className="block text-[11.5px] leading-snug text-muted">{row.spec}</span>
            ) : null}
          </td>
          <td className="tnum whitespace-nowrap border-b border-line2 px-2 py-1.5 text-right align-top">
            {row.unit === "no." ? row.qty : `${row.qty.toFixed(2)} ${row.unit}`}
          </td>
          <td className="tnum whitespace-nowrap border-b border-line2 px-2 py-1.5 text-right align-top">
            {editableRates && onRateChange ? (
              <input
                type="number"
                min={0}
                step={100}
                defaultValue={row.rate}
                aria-label={`Rate for ${row.name}`}
                className="tnum w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-right hover:border-line focus:border-accent focus:bg-bg focus:outline-none"
                onBlur={(e) => {
                  const next = Number(e.target.value);
                  if (Number.isFinite(next) && next >= 0 && next !== row.rate) {
                    onRateChange(row.key, next);
                  }
                }}
              />
            ) : (
              row.rate.toLocaleString(currency.locale)
            )}
          </td>
          <td className="tnum whitespace-nowrap border-b border-line2 px-2 py-1.5 text-right align-top">
            {formatMoney(row.amount, currency)}
          </td>
        </tr>
      ))}
    </>
  );
}
