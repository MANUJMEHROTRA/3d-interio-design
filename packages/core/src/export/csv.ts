import { mm2ToM2, mm2ToSqft } from "../units.js";
import { buildBom, buildQuote, roomSummaries } from "../pricing.js";
import { validate } from "../validation.js";
import type { Project } from "../types.js";

const cell = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (rows: Array<Array<unknown>>): string =>
  rows.map((r) => r.map(cell).join(",")).join("\r\n");

/** The quote as a spreadsheet, grouped by room exactly as it prints. */
export function quoteCsv(project: Project): string {
  const q = buildQuote(project);
  const cur = project.currency.code;
  const rows: Array<Array<unknown>> = [
    [`${project.name}${project.client ? ` — ${project.client}` : ""}`],
    [`Quotation ${project.quote.number}`, new Date().toISOString().slice(0, 10)],
    [],
    ["Room", "Item", "Specification", "Qty", "Unit", `Rate (${cur})`, `Amount (${cur})`, "Lead (weeks)"],
  ];
  for (const group of q.groups) {
    for (const row of group.rows) {
      rows.push([
        group.label,
        row.name,
        row.spec ?? "",
        row.qty,
        row.unit,
        row.rate,
        row.amount,
        row.leadWeeks ?? "",
      ]);
    }
    rows.push(["", `${group.label} subtotal`, "", "", "", "", group.total, ""]);
    rows.push([]);
  }
  for (const line of q.lines) {
    rows.push(["", line.label, "", "", "", "", line.amount, ""]);
  }
  if (q.clientSupplied.length) {
    rows.push([]);
    rows.push(["Supplied by the client, not priced", q.clientSupplied.join("; ")]);
  }
  return toCsv(rows);
}

/** Per-piece schedule for the factory and the site supervisor. */
export function bomCsv(project: Project): string {
  const rows: Array<Array<unknown>> = [
    ["Room", "Item", "Catalog key", "Size (W × D × H)", "Qty", "Unit", "Finish", "Rate", "Amount", "Lead (weeks)", "Notes"],
  ];
  for (const r of buildBom(project)) {
    rows.push([r.room, r.name, r.key, r.size, r.qty, r.unit, r.finish, r.rate, r.amount, r.leadWeeks ?? "", r.notes ?? ""]);
  }
  return toCsv(rows);
}

/** Room-by-room area and cost, for the summary page of a proposal. */
export function roomScheduleCsv(project: Project): string {
  const rows: Array<Array<unknown>> = [
    ["Room", "Type", "Area (m²)", "Area (sq ft)", "Pieces", `Cost (${project.currency.code})`, "Cost per m²"],
  ];
  for (const s of roomSummaries(project)) {
    rows.push([
      s.name,
      s.type,
      mm2ToM2(s.areaMm2).toFixed(2),
      Math.round(mm2ToSqft(s.areaMm2)),
      s.itemCount,
      s.cost,
      s.costPerSqm,
    ]);
  }
  return toCsv(rows);
}

/** The design review, so it can be circulated and signed off. */
export function issuesCsv(project: Project): string {
  const report = validate(project);
  const rows: Array<Array<unknown>> = [["Severity", "Code", "Where", "Issue"]];
  const label = (target: string, kind: string) => {
    if (kind === "room") return project.rooms.find((r) => r.id === target)?.name ?? target;
    if (kind === "item") {
      const item = project.items.find((i) => i.id === target);
      return item ? item.label ?? item.key : target;
    }
    return target;
  };
  for (const i of report.issues) {
    rows.push([i.severity, i.code, label(i.target, i.targetKind), i.message]);
  }
  return toCsv(rows);
}
