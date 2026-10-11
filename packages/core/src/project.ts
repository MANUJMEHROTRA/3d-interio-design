import { z } from "zod";
import { applyLayout } from "./autolayout.js";
import { CATALOG_KEYS } from "./catalog/index.js";
import { nextQuoteNumber, rid } from "./ids.js";
import { ROOM_TYPES } from "./rooms.js";
import { CURRENCIES } from "./pricing.js";
import { DEFAULT_STYLE_ID, STYLES } from "./styles.js";
import type { Opening, Project, Room, RoomType } from "./types.js";

/** Bump when the shape of a saved project changes, and add a migration below. */
export const SCHEMA_VERSION = 3;

export const DEFAULT_TERMS = `Prices include supply and installation of the items listed above. Civil, electrical, plumbing and false-ceiling work is quoted separately.
Payment: 50% on order confirmation, 40% on delivery to site, 10% on handover.
Any change to the approved drawings will be re-quoted before work proceeds.
Delivery approximately 6 to 8 weeks from sign-off of the final drawings.`;

/* ------------------------------------------------------------------ *
 * Schema
 * ------------------------------------------------------------------ */

const rotSchema = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
const sideSchema = z.enum(["N", "S", "W", "E"]);

export const roomSchema = z.object({
  id: z.string(),
  name: z.string().max(60),
  type: z.enum(Object.keys(ROOM_TYPES) as [RoomType, ...RoomType[]]),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().min(600).max(40000),
  d: z.number().int().min(600).max(40000),
  layout: z.string().nullable().optional(),
  variant: z.number().int().optional(),
  variantCount: z.number().int().optional(),
  ceiling: z.number().int().min(1800).max(6000).optional(),
  falseCeiling: z.number().int().min(0).max(900).optional(),
  floorFinish: z.string().optional(),
  accentWall: sideSchema.nullable().optional(),
  notes: z.string().max(2000).optional(),
});

export const openingSchema = z.object({
  id: z.string(),
  o: z.enum(["h", "v"]),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int().min(300).max(12000),
  kind: z.enum(["door", "sliding", "cased", "window", "frenchWindow"]),
  h: z.number().int().min(300).max(4000),
  sill: z.number().int().min(0).max(3000),
  swing: z.union([z.literal(1), z.literal(-1)]),
  hinge: z.enum(["start", "end"]).optional(),
  label: z.string().max(60).optional(),
});

export const placedItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  cx: z.number().int(),
  cy: z.number().int(),
  rot: rotSchema,
  w: z.number().int().min(50).max(12000).optional(),
  d: z.number().int().min(50).max(12000).optional(),
  z: z.number().int().min(0).max(6000).optional(),
  finishes: z.record(z.string()).optional(),
  label: z.string().max(80).optional(),
  locked: z.boolean().optional(),
});

export const projectSchema = z.object({
  v: z.number().int().optional(),
  id: z.string(),
  name: z.string().min(1).max(120),
  client: z.string().max(120),
  siteAddress: z.string().max(400).optional(),
  styleId: z.string(),
  ceiling: z.number().int().min(1800).max(6000),
  rooms: z.array(roomSchema).max(80),
  openings: z.array(openingSchema).max(400),
  items: z.array(placedItemSchema).max(4000),
  rates: z.record(z.number()),
  currency: z.object({
    code: z.string(),
    symbol: z.string(),
    locale: z.string(),
    rateFromINR: z.number().positive(),
  }),
  units: z.enum(["metric", "imperial"]),
  quote: z.object({
    number: z.string().max(40),
    designFeePct: z.number().min(0).max(100),
    taxes: z.array(z.object({ label: z.string().max(40), rate: z.number().min(0).max(100) })).max(6),
    discountPct: z.number().min(0).max(90),
    terms: z.string().max(8000),
    includeScaleModel: z.boolean(),
    validDays: z.number().int().min(1).max(365),
  }),
  print: z.object({
    scale: z.union([z.literal(50), z.literal(75), z.literal(100)]),
    walls: z.enum(["full", "cut"]),
    includeFurniture: z.boolean(),
    separateFurniture: z.boolean(),
    minFeature: z.number().min(0.6).max(5),
    bed: z.number().int().min(100).max(1000),
    ratePerGram: z.number().min(0),
  }),
  view: z.object({
    walls: z.enum(["cut", "full"]),
    showCeiling: z.boolean(),
    timeOfDay: z.number().min(0).max(24),
    lightsOn: z.boolean(),
    quality: z.enum(["draft", "standard", "high"]),
  }),
  updatedAt: z.number(),
});

/* ------------------------------------------------------------------ *
 * Construction
 * ------------------------------------------------------------------ */

export function baseProject(name: string, client = ""): Project {
  return {
    v: SCHEMA_VERSION,
    id: rid("p"),
    name,
    client,
    styleId: DEFAULT_STYLE_ID,
    ceiling: 2900,
    rooms: [],
    openings: [],
    items: [],
    rates: {},
    currency: CURRENCIES.INR!,
    units: "metric",
    quote: {
      number: nextQuoteNumber(),
      designFeePct: 10,
      taxes: [{ label: "GST", rate: 18 }],
      discountPct: 0,
      terms: DEFAULT_TERMS,
      includeScaleModel: false,
      validDays: 15,
    },
    print: {
      scale: 50,
      walls: "full",
      includeFurniture: true,
      separateFurniture: true,
      minFeature: 1.6,
      bed: 256,
      ratePerGram: 10,
    },
    view: {
      walls: "cut",
      showCeiling: false,
      timeOfDay: 11,
      lightsOn: true,
      quality: "standard",
    },
    updatedAt: Date.now(),
  };
}

const room = (
  name: string,
  type: RoomType,
  x: number,
  y: number,
  w: number,
  d: number,
  extra: Partial<Room> = {},
): Room => ({
  id: rid("r"),
  name,
  type,
  x,
  y,
  w,
  d,
  falseCeiling: ROOM_TYPES[type].falseCeiling,
  ceiling: ROOM_TYPES[type].ceiling,
  ...extra,
});

const door = (o: "h" | "v", x: number, y: number, w = 900): Opening => ({
  id: rid("d"),
  o,
  x,
  y,
  w,
  kind: "door",
  h: 2100,
  sill: 0,
  swing: 1,
});

const cased = (o: "h" | "v", x: number, y: number, w: number): Opening => ({
  id: rid("d"),
  o,
  x,
  y,
  w,
  kind: "cased",
  h: 2250,
  sill: 0,
  swing: 1,
});

const window_ = (
  o: "h" | "v",
  x: number,
  y: number,
  w: number,
  sill = 750,
  h = 1500,
): Opening => ({ id: rid("d"), o, x, y, w, kind: "window", h, sill, swing: 1 });

const frenchWindow = (o: "h" | "v", x: number, y: number, w: number): Opening => ({
  id: rid("d"),
  o,
  x,
  y,
  w,
  kind: "frenchWindow",
  h: 2250,
  sill: 100,
  swing: 1,
});

/**
 * A fully furnished 2BHK, used as the sample project and as the fixture every
 * demo and screenshot is taken from. Dimensions are wall centre to wall
 * centre, which is how a builder's drawing is dimensioned.
 */
export function sampleProject(): Project {
  const p = baseProject("Sample 2BHK — Prestige Lakeside", "Mr & Mrs Sharma");
  p.siteAddress = "Tower 4, Flat 1203, Prestige Lakeside, Bengaluru";
  p.styleId = "indo";

  p.rooms = [
    room("Living", "living", 0, 0, 6000, 4800, { accentWall: "N" }),
    room("Kitchen", "kitchen", 6000, 0, 3600, 2200),
    room("Dining", "dining", 6000, 2200, 3600, 2600),
    room("Master bedroom", "bedroom", 0, 4800, 4600, 3600, { accentWall: "N" }),
    room("Bathroom", "bath", 4600, 4800, 1400, 2200),
    room("Utility", "utility", 4600, 7000, 1400, 1400),
    room("Bedroom 2", "kids", 6000, 4800, 3600, 3600, { accentWall: "S" }),
  ];

  p.openings = [
    // circulation
    door("v", 0, 1600, 1000),
    door("h", 3700, 4800, 800),
    door("h", 4700, 4800, 700),
    door("v", 4600, 7600, 700),
    door("h", 6200, 4800, 900),
    cased("v", 6000, 2600, 1600),
    cased("h", 8500, 2200, 900),
    // daylight
    window_("h", 1500, 0, 2400),
    frenchWindow("v", 0, 3200, 1400),
    window_("h", 6600, 0, 1200, 1050, 1200),
    frenchWindow("v", 9600, 2900, 1500),
    window_("v", 0, 6000, 1800),
    window_("h", 1400, 8400, 1600),
    window_("v", 9600, 5600, 1800),
    window_("h", 7000, 8400, 1500),
    window_("h", 4900, 8400, 800, 1050, 1200),
  ];

  const defaults: Record<string, string> = {
    Living: "tvwall",
    Kitchen: "lshape",
    Dining: "four",
    "Master bedroom": "classic",
    Bathroom: "compact",
    Utility: "laundry",
    "Bedroom 2": "single",
  };
  for (const r of p.rooms) {
    const id = defaults[r.name];
    if (id) applyLayout(p, r, id, 0);
  }
  return p;
}

/** A single empty room — what "new project" gives you. */
export function blankProject(name = "New project"): Project {
  const p = baseProject(name);
  p.rooms = [room("Living", "living", 0, 0, 4800, 3900)];
  p.openings = [door("v", 0, 1200, 900), window_("h", 1400, 0, 2000)];
  return p;
}

/* ------------------------------------------------------------------ *
 * Migration
 * ------------------------------------------------------------------ */

type LegacyOpening = Partial<Opening> & { opening?: boolean };

/**
 * Bring any saved project forward to the current schema.
 *
 * Projects live in a customer's account for years and they will open quotes
 * they sent eighteen months ago, so every old shape has to keep working.
 * v1 called openings `doors` and flagged cased openings with a boolean;
 * v2 had no window sill or height.
 */
export function migrate(input: unknown): Project {
  const raw = (input ?? {}) as Record<string, unknown>;
  const base = baseProject(String(raw.name ?? "Untitled project"), String(raw.client ?? ""));
  const version = typeof raw.v === "number" ? raw.v : 1;

  const p: Project = {
    ...base,
    id: typeof raw.id === "string" ? raw.id : base.id,
    name: String(raw.name ?? base.name).slice(0, 120) || base.name,
    client: String(raw.client ?? "").slice(0, 120),
    siteAddress: typeof raw.siteAddress === "string" ? raw.siteAddress.slice(0, 400) : undefined,
    styleId: typeof raw.styleId === "string" ? raw.styleId : String(raw.style ?? base.styleId),
    ceiling: Number(raw.ceiling) || base.ceiling,
    updatedAt: Number(raw.updatedAt) || Date.now(),
    v: SCHEMA_VERSION,
  };
  if (!STYLES[p.styleId]) p.styleId = DEFAULT_STYLE_ID;

  // rooms
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
  p.rooms = rooms
    .map((r) => r as Partial<Room>)
    .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y) && r.w && r.d)
    .map((r) => ({
      id: r.id ?? rid("r"),
      name: (r.name ?? "Room").slice(0, 60),
      type: (r.type && r.type in ROOM_TYPES ? r.type : "living") as RoomType,
      x: Math.round(r.x!),
      y: Math.round(r.y!),
      w: Math.max(600, Math.round(r.w!)),
      d: Math.max(600, Math.round(r.d!)),
      layout: r.layout ?? null,
      variant: r.variant ?? 0,
      ceiling: r.ceiling,
      falseCeiling: r.falseCeiling,
      accentWall: r.accentWall ?? null,
      notes: r.notes,
    }));

  // openings: v1 stored them as `doors` with an `opening` boolean
  const legacy = (Array.isArray(raw.openings) ? raw.openings : raw.doors) ?? [];
  p.openings = (legacy as LegacyOpening[])
    .filter((o) => Number.isFinite(o.x) && Number.isFinite(o.y) && o.w)
    .map((o) => {
      const kind: Opening["kind"] = o.kind ?? (o.opening ? "cased" : "door");
      const isWindow = kind === "window" || kind === "frenchWindow";
      return {
        id: o.id ?? rid("d"),
        o: o.o === "v" ? "v" : "h",
        x: Math.round(o.x!),
        y: Math.round(o.y!),
        w: Math.max(300, Math.round(o.w!)),
        kind,
        h: o.h ?? (kind === "cased" ? 2250 : isWindow ? 1500 : 2100),
        sill: o.sill ?? (isWindow ? 750 : 0),
        swing: o.swing === -1 ? -1 : 1,
        hinge: o.hinge,
        label: o.label,
      } satisfies Opening;
    });

  // items: drop anything whose catalog key no longer exists, and remap renames
  const RENAMED: Record<string, string> = {
    tv: "tvUnit",
    side: "nightstand",
    bedK: "bedKing",
    bedQ: "bedQueen",
    bedS: "bedSingle",
    chair: "diningChair",
    chair2: "studyChair",
    counter: "counterRun",
    crockery: "crockeryUnit",
    bookshelf: "bookshelf",
    shoe: "shoeCabinet",
    plant: "planter",
    storage: "storageRack",
  };
  const items: unknown[] = Array.isArray(raw.items) ? raw.items : [];
  p.items = items.flatMap((entry) => {
    const i = (entry ?? {}) as Record<string, unknown>;
    const originalKey = String(i.key ?? "");
    const key = RENAMED[originalKey] ?? originalKey;
    if (!CATALOG_KEYS.has(key)) return [];
    if (!Number.isFinite(Number(i.cx)) || !Number.isFinite(Number(i.cy))) return [];
    return [
      {
        id: typeof i.id === "string" ? i.id : rid("i"),
        key,
        cx: Math.round(Number(i.cx)),
        cy: Math.round(Number(i.cy)),
        rot: ((Math.round(Number(i.rot ?? 0) / 90) * 90 + 360) % 360) as 0 | 90 | 180 | 270,
        w: Number.isFinite(Number(i.w)) ? Math.round(Number(i.w)) : undefined,
        d: Number.isFinite(Number(i.d)) ? Math.round(Number(i.d)) : undefined,
        z: Number.isFinite(Number(i.z)) ? Math.round(Number(i.z)) : undefined,
        label: typeof i.label === "string" ? i.label.slice(0, 80) : undefined,
        locked: i.locked === true,
        finishes: (i.finishes as Project["items"][number]["finishes"]) ?? undefined,
      },
    ];
  });

  // rates
  const rates = (raw.rates ?? {}) as Record<string, unknown>;
  p.rates = Object.fromEntries(
    Object.entries(rates)
      .filter(([k, v]) => CATALOG_KEYS.has(k) && Number.isFinite(Number(v)))
      .map(([k, v]) => [k, Number(v)]),
  );

  // currency and units
  const currency = raw.currency as Project["currency"] | undefined;
  p.currency =
    currency && typeof currency.code === "string" && CURRENCIES[currency.code]
      ? { ...CURRENCIES[currency.code]!, ...currency }
      : CURRENCIES.INR!;
  p.units = raw.units === "imperial" ? "imperial" : "metric";

  // quote: v1 kept fee/gst at the top level
  const quote = (raw.quote ?? {}) as Record<string, unknown>;
  p.quote = {
    number: String(quote.number ?? raw.quoteNo ?? base.quote.number).slice(0, 40),
    designFeePct: Number(quote.designFeePct ?? raw.fee ?? 10),
    taxes: Array.isArray(quote.taxes)
      ? (quote.taxes as Array<{ label?: string; rate?: number }>).map((t) => ({
          label: String(t.label ?? "Tax").slice(0, 40),
          rate: Number(t.rate ?? 0),
        }))
      : [{ label: "GST", rate: Number(raw.gst ?? 18) }],
    discountPct: Number(quote.discountPct ?? 0),
    terms: String(quote.terms ?? raw.terms ?? DEFAULT_TERMS).slice(0, 8000),
    includeScaleModel: Boolean(quote.includeScaleModel ?? raw.includeModel ?? false),
    validDays: Number(quote.validDays ?? 15),
  };

  p.print = { ...base.print, ...((raw.print ?? {}) as object) };
  p.view = { ...base.view, ...((raw.view ?? {}) as object) };
  // v1 projects had no ceiling field and were drawn against a 2700 mm assumption
  if (version < 3 && !raw.ceiling) p.ceiling = 2700;

  return p;
}

/**
 * Is this recognisably a project document at all?
 *
 * `migrate` is deliberately forgiving — it has to open files written by older
 * versions with missing fields. That forgiveness is dangerous at a trust
 * boundary: `{ rooms: "nope" }` would migrate into a valid *empty* project,
 * and saving that over a real one destroys the designer's work. So anything
 * arriving from a client or a file has to clear this gate first.
 */
function looksLikeProject(input: unknown): string | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return "That is not a Layoutcraft project.";
  }
  const raw = input as Record<string, unknown>;

  if (!Array.isArray(raw.rooms)) {
    return "That file has no list of rooms, so it is not a project.";
  }
  if (raw.items !== undefined && !Array.isArray(raw.items)) {
    return "The furniture list in that file is not valid.";
  }
  const openings = raw.openings ?? raw.doors;
  if (openings !== undefined && !Array.isArray(openings)) {
    return "The doors and windows in that file are not valid.";
  }
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    return "That file has no project name.";
  }
  return null;
}

export interface ParseOptions {
  /**
   * Refuse anything that is not recognisably a project, rather than migrating
   * it into an empty one. Always use this for an API body or an imported file.
   */
  strict?: boolean;
}

/** Parse untrusted JSON (an import, or an API body) into a safe project. */
export function parseProject(
  input: unknown,
  options: ParseOptions = {},
): { ok: true; project: Project } | { ok: false; error: string } {
  try {
    if (options.strict) {
      const problem = looksLikeProject(input);
      if (problem) return { ok: false, error: problem };
    }
    const migrated = migrate(input);
    const result = projectSchema.safeParse(migrated);
    if (!result.success) {
      return { ok: false, error: result.error.issues[0]?.message ?? "Invalid project file" };
    }
    return { ok: true, project: migrated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read that file" };
  }
}

export const cloneProject = (p: Project): Project =>
  typeof structuredClone === "function"
    ? structuredClone(p)
    : (JSON.parse(JSON.stringify(p)) as Project);

/** Duplicate a project under a new id, ready to save as a separate record. */
export function duplicateProject(p: Project, name?: string): Project {
  const copy = cloneProject(p);
  copy.id = rid("p");
  copy.name = name ?? `${p.name} (copy)`;
  copy.quote = { ...copy.quote, number: nextQuoteNumber() };
  copy.updatedAt = Date.now();
  return copy;
}
