import { CATALOG } from "./catalog/index.js";
import { footprint, itemSize, roomAt } from "./geometry.js";
import { printStats } from "./fabrication.js";
import { getStyle } from "./styles.js";
import type { Currency, PlacedItem, Project } from "./types.js";

/* ------------------------------------------------------------------ *
 * Currency
 * ------------------------------------------------------------------ */

/**
 * The catalog is priced in INR because that is the market the rate card was
 * built from. Every other currency is a conversion of that reference, stored
 * on the project so a historic quote never silently re-prices itself when a
 * rate moves.
 */
export const CURRENCIES: Record<string, Currency> = {
  INR: { code: "INR", symbol: "₹", locale: "en-IN", rateFromINR: 1 },
  USD: { code: "USD", symbol: "$", locale: "en-US", rateFromINR: 0.012 },
  EUR: { code: "EUR", symbol: "€", locale: "de-DE", rateFromINR: 0.011 },
  GBP: { code: "GBP", symbol: "£", locale: "en-GB", rateFromINR: 0.0094 },
  AED: { code: "AED", symbol: "AED ", locale: "en-AE", rateFromINR: 0.044 },
  SGD: { code: "SGD", symbol: "S$", locale: "en-SG", rateFromINR: 0.016 },
  AUD: { code: "AUD", symbol: "A$", locale: "en-AU", rateFromINR: 0.018 },
  CAD: { code: "CAD", symbol: "C$", locale: "en-CA", rateFromINR: 0.016 },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);

export function formatMoney(amount: number, currency: Currency, compact = false): string {
  const value = Math.round(amount);
  if (compact && Math.abs(value) >= 100_000) {
    // Indian readers expect lakh and crore; everyone else expects K/M
    if (currency.locale === "en-IN") {
      if (Math.abs(value) >= 10_000_000) return `${currency.symbol}${(value / 10_000_000).toFixed(2)} Cr`;
      return `${currency.symbol}${(value / 100_000).toFixed(2)} L`;
    }
    if (Math.abs(value) >= 1_000_000) return `${currency.symbol}${(value / 1_000_000).toFixed(2)}M`;
    return `${currency.symbol}${(value / 1_000).toFixed(0)}K`;
  }
  return `${currency.symbol}${value.toLocaleString(currency.locale)}`;
}

/** Catalog INR → project currency, rounded to a sane presentation step. */
export function convert(inr: number, currency: Currency): number {
  const raw = inr * currency.rateFromINR;
  if (currency.code === "INR") return Math.round(raw / 100) * 100;
  return Math.round(raw);
}

/* ------------------------------------------------------------------ *
 * Rates
 * ------------------------------------------------------------------ */

/**
 * The rate for one catalog key on one project.
 *
 * Order of precedence: a project-level override the designer typed, then the
 * catalog base price scaled by the style multiplier and converted to the
 * project currency. Overrides are stored in project currency so editing a rate
 * in the quote does exactly what the designer expects.
 */
export function rateFor(project: Project, key: string): number {
  const override = project.rates[key];
  if (override !== undefined && override !== null && Number.isFinite(override)) return override;
  const item = CATALOG[key];
  if (!item || item.unit === "clientSupplied") return 0;
  return convert(item.price * getStyle(project.styleId).priceMultiplier, project.currency);
}

/** Billable quantity for one placed item, in the catalog's selling unit. */
export function quantityOf(item: PlacedItem): number {
  const catalog = CATALOG[item.key];
  if (!catalog) return 0;
  const { w, d } = itemSize(item);
  switch (catalog.unit) {
    case "perMetre":
      return w / 1000;
    case "perSqm":
      return (w * d) / 1e6;
    case "clientSupplied":
      return 1;
    default:
      return 1;
  }
}

/* ------------------------------------------------------------------ *
 * Quote
 * ------------------------------------------------------------------ */

export interface QuoteRow {
  key: string;
  name: string;
  spec?: string;
  unit: "no." | "m" | "m²";
  qty: number;
  rate: number;
  amount: number;
  leadWeeks?: number;
}

export interface QuoteGroup {
  /** Room name, or "Not in a room" for orphans. */
  label: string;
  roomId: string | null;
  rows: QuoteRow[];
  total: number;
}

export interface QuoteTotalLine {
  label: string;
  amount: number;
  /** Rendered in bold as the final figure. */
  grand?: boolean;
  /** Negative lines (discounts) are shown in brackets. */
  negative?: boolean;
}

export interface Quote {
  groups: QuoteGroup[];
  /** Furniture and fit-out before fees, discount and tax. */
  subtotal: number;
  discount: number;
  designFee: number;
  scaleModel: number;
  taxes: Array<{ label: string; rate: number; amount: number }>;
  total: number;
  lines: QuoteTotalLine[];
  /** Items the client is buying themselves — listed but not priced. */
  clientSupplied: string[];
  /** Longest lead time across the whole scope, weeks. */
  leadWeeks: number;
  itemCount: number;
}

const UNIT_LABEL: Record<string, QuoteRow["unit"]> = {
  each: "no.",
  perMetre: "m",
  perSqm: "m²",
  clientSupplied: "no.",
};

export function buildQuote(project: Project): Quote {
  const byRoom = new Map<string, PlacedItem[]>();
  const clientSupplied = new Set<string>();
  let leadWeeks = 0;

  for (const item of project.items) {
    if (!CATALOG[item.key]) continue;
    const room = roomAt(project.rooms, item.cx, item.cy);
    const key = room?.id ?? "_orphan";
    const list = byRoom.get(key) ?? [];
    list.push(item);
    byRoom.set(key, list);
  }

  const groups: QuoteGroup[] = [];
  let subtotal = 0;

  const addGroup = (label: string, roomId: string | null, items: PlacedItem[] | undefined) => {
    if (!items?.length) return;
    const aggregate = new Map<string, QuoteRow>();

    for (const item of items) {
      const catalog = CATALOG[item.key]!;
      if (catalog.unit === "clientSupplied") {
        clientSupplied.add(catalog.name);
        continue;
      }
      if (catalog.leadWeeks) leadWeeks = Math.max(leadWeeks, catalog.leadWeeks);

      const existing = aggregate.get(item.key);
      const qty = quantityOf(item);
      if (existing) {
        existing.qty += qty;
      } else {
        aggregate.set(item.key, {
          key: item.key,
          name: catalog.name,
          spec: catalog.spec,
          unit: UNIT_LABEL[catalog.unit] ?? "no.",
          qty,
          rate: rateFor(project, item.key),
          amount: 0,
          leadWeeks: catalog.leadWeeks,
        });
      }
    }

    const rows = [...aggregate.values()].map((row) => ({
      ...row,
      qty: Math.round(row.qty * 100) / 100,
      amount: Math.round(row.rate * row.qty),
    }));
    if (!rows.length) return;

    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    subtotal += total;
    groups.push({ label, roomId, rows, total });
  };

  for (const room of project.rooms) addGroup(room.name, room.id, byRoom.get(room.id));
  addGroup("Not in a room", null, byRoom.get("_orphan"));

  const q = project.quote;
  const discount = Math.round((subtotal * Math.max(0, q.discountPct)) / 100);
  const afterDiscount = subtotal - discount;
  const designFee = Math.round((afterDiscount * Math.max(0, q.designFeePct)) / 100);
  const scaleModel = q.includeScaleModel
    ? Math.round(printStats(project).cost / 100) * 100
    : 0;

  const taxable = afterDiscount + designFee + scaleModel;
  const taxes = q.taxes.map((t) => ({
    label: t.label,
    rate: t.rate,
    amount: Math.round((taxable * Math.max(0, t.rate)) / 100),
  }));
  const taxTotal = taxes.reduce((s, t) => s + t.amount, 0);
  const total = taxable + taxTotal;

  const lines: QuoteTotalLine[] = [{ label: "Furniture and fit-out", amount: subtotal }];
  if (discount) lines.push({ label: `Discount (${q.discountPct}%)`, amount: -discount, negative: true });
  if (designFee) lines.push({ label: `Design fee (${q.designFeePct}%)`, amount: designFee });
  if (scaleModel) lines.push({ label: `3D-printed scale model (1:${project.print.scale})`, amount: scaleModel });
  for (const t of taxes) lines.push({ label: `${t.label} (${t.rate}%)`, amount: t.amount });
  lines.push({ label: "Total", amount: total, grand: true });

  return {
    groups,
    subtotal,
    discount,
    designFee,
    scaleModel,
    taxes,
    total,
    lines,
    clientSupplied: [...clientSupplied],
    leadWeeks,
    itemCount: project.items.filter((i) => CATALOG[i.key]).length,
  };
}

/* ------------------------------------------------------------------ *
 * Bill of materials — what the factory and the site need
 * ------------------------------------------------------------------ */

export interface BomRow {
  room: string;
  name: string;
  key: string;
  /** `1800 × 620 × 2400 mm` */
  size: string;
  qty: number;
  unit: string;
  finish: string;
  rate: number;
  amount: number;
  leadWeeks?: number;
  notes?: string;
}

/** A flat, per-piece schedule: one row per placed item, with sizes and finishes. */
export function buildBom(project: Project): BomRow[] {
  const style = getStyle(project.styleId);
  const rows: BomRow[] = [];

  for (const item of project.items) {
    const catalog = CATALOG[item.key];
    if (!catalog) continue;
    const room = roomAt(project.rooms, item.cx, item.cy);
    const { w, d, h } = itemSize(item);
    const qty = quantityOf(item);
    const rate = rateFor(project, item.key);
    // the dominant material slot tells a joiner which finish schedule applies
    const slots = catalog.parts(w, d, h).map((p) => p.m);
    const counts = new Map<string, number>();
    for (const s of slots) counts.set(s, (counts.get(s) ?? 0) + 1);
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

    rows.push({
      room: room?.name ?? "Not in a room",
      name: item.label ?? catalog.name,
      key: item.key,
      size: `${Math.round(w)} × ${Math.round(d)} × ${Math.round(h)} mm`,
      qty: Math.round(qty * 100) / 100,
      unit: UNIT_LABEL[catalog.unit] ?? "no.",
      finish: dominant ? style.finishes[dominant as keyof typeof style.finishes]?.name ?? "—" : "—",
      rate,
      amount: catalog.unit === "clientSupplied" ? 0 : Math.round(rate * qty),
      leadWeeks: catalog.leadWeeks,
      notes: catalog.unit === "clientSupplied" ? "Client supplied" : undefined,
    });
  }

  return rows.sort((a, b) => a.room.localeCompare(b.room) || a.name.localeCompare(b.name));
}

/** Per-room area and cost, for the summary page of a proposal. */
export interface RoomSummary {
  roomId: string;
  name: string;
  type: string;
  areaMm2: number;
  itemCount: number;
  cost: number;
  costPerSqm: number;
}

export function roomSummaries(project: Project): RoomSummary[] {
  const quote = buildQuote(project);
  return project.rooms.map((room) => {
    const group = quote.groups.find((g) => g.roomId === room.id);
    const areaMm2 = room.w * room.d;
    const cost = group?.total ?? 0;
    return {
      roomId: room.id,
      name: room.name,
      type: room.type,
      areaMm2,
      itemCount: project.items.filter((i) => roomAt(project.rooms, i.cx, i.cy) === room).length,
      cost,
      costPerSqm: areaMm2 > 0 ? Math.round(cost / (areaMm2 / 1e6)) : 0,
    };
  });
}
