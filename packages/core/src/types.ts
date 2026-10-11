import type { Mm, UnitSystem } from "./units.js";

// Re-exported so every consumer can pull the whole vocabulary from one module.
export type { Mm, UnitSystem };

/* ------------------------------------------------------------------ *
 * Spatial primitives
 * ------------------------------------------------------------------ */

/** Axis-aligned rectangle on the floor plane. `y` runs downward, as on a plan. */
export interface Rect {
  x: Mm;
  y: Mm;
  w: Mm;
  d: Mm;
}

/** Axis-aligned 3D box. `z` is height above finished floor level. */
export interface Box3 {
  x0: Mm;
  y0: Mm;
  z0: Mm;
  x1: Mm;
  y1: Mm;
  z1: Mm;
}

/** Rotation is restricted to 90° steps: joinery is built to walls, not to angles. */
export type Rot = 0 | 90 | 180 | 270;

export type Side = "N" | "S" | "W" | "E";

/* ------------------------------------------------------------------ *
 * Materials
 * ------------------------------------------------------------------ */

/**
 * Material slots. A style maps every slot to a concrete finish, so swapping
 * style re-skins the whole project without touching geometry.
 */
export type MaterialKey =
  // architecture
  | "floor"
  | "floorAccent"
  | "wall"
  | "wallAccent"
  | "ceiling"
  | "skirting"
  // joinery
  | "woodDark"
  | "woodMid"
  | "woodLight"
  | "laminate"
  | "lacquer"
  | "cane"
  // soft
  | "fabric"
  | "fabricAlt"
  | "fabricAccent"
  | "leather"
  | "rug"
  | "cushion"
  // hard surfaces
  | "stone"
  | "marble"
  | "quartz"
  | "tile"
  | "ceramic"
  // metals and transparent
  | "metal"
  | "metalDark"
  | "brass"
  | "chrome"
  | "glass"
  | "mirror"
  // props
  | "plant"
  | "planter"
  | "screen"
  | "paper"
  | "lampshade"
  | "emissive";

/** How a surface behaves under light. Drives the PBR material in the renderer. */
export type SurfaceClass =
  | "matte" // plaster, paint, paper
  | "satin" // lacquer, laminate
  | "gloss" // polished stone, ceramic
  | "wood"
  | "fabric"
  | "leather"
  | "pile" // rug, carpet
  | "stone"
  | "metal"
  | "glass"
  | "mirror"
  | "foliage"
  | "emissive";

export interface Finish {
  /** Human name that appears on the spec sheet and the quote. */
  name: string;
  /** Base colour, sRGB hex. */
  color: string;
  surface: SurfaceClass;
  /** 0–1 override; the surface class supplies a sensible default. */
  roughness?: number;
  metalness?: number;
  /** Procedural texture to generate, and how large one tile is in mm. */
  texture?: TextureRecipe;
  /** Clear-coat strength for lacquer and polished stone. */
  clearcoat?: number;
  /** 0–1, for glass and sheers. */
  opacity?: number;
  /** Bump strength multiplier, 0–2. */
  relief?: number;
}

export type TexturePattern =
  | "plaster"
  | "woodPlank"
  | "woodGrain"
  | "weave"
  | "linen"
  | "leatherGrain"
  | "pile"
  | "terrazzo"
  | "marbleVein"
  | "graniteSpeckle"
  | "tileGrid"
  | "brushedMetal"
  | "concrete"
  | "caneWeave"
  | "none";

export interface TextureRecipe {
  pattern: TexturePattern;
  /** Physical size of one texture tile, in mm. Keeps scale honest across rooms. */
  tileMm: number;
  /** Secondary colour used by the pattern (grout, grain, vein). */
  accent?: string;
  /** 0–1 pattern contrast. */
  contrast?: number;
}

export interface DesignStyle {
  id: string;
  name: string;
  /** One line a designer can read out to a client. */
  note: string;
  /** Rate multiplier applied to catalog base prices. */
  priceMultiplier: number;
  finishes: Record<MaterialKey, Finish>;
  /** Warm-to-cool bias of the artificial lighting, in kelvin. */
  lightTemperatureK: number;
}

/* ------------------------------------------------------------------ *
 * Catalog
 * ------------------------------------------------------------------ */

export type PartShape =
  /** A rectangular solid. `radius` rounds the vertical edges, `bevel` chamfers all edges. */
  | { k: "box"; box: Box3; radius?: Mm; bevel?: Mm }
  /** Upholstery: a box with a crowned, slightly pillowed top. */
  | { k: "cushion"; box: Box3; crown?: Mm; radius?: Mm }
  /** Worktop or table top with an eased or bullnosed front edge. */
  | { k: "slab"; box: Box3; edge?: "square" | "eased" | "bullnose" }
  /** Leg, pole, vase, pendant stem. Tapers from `r0` at z0 to `r1` at z1. */
  | { k: "cyl"; cx: Mm; cy: Mm; z0: Mm; z1: Mm; r0: Mm; r1?: Mm; segments?: number }
  /** Revolved profile for pots, bowls and shades. `profile` is [radius, t] with t 0→1 over z0→z1. */
  | { k: "lathe"; cx: Mm; cy: Mm; z0: Mm; z1: Mm; profile: Array<[Mm, number]>; segments?: number }
  /** Zero-thickness surface: rug, artwork, mirror glass, curtain. */
  | { k: "sheet"; box: Box3; axis: "z" | "x" | "y" }
  /** A sphere, for knobs, bowls and plant masses. */
  | { k: "ball"; cx: Mm; cy: Mm; cz: Mm; r: Mm; squash?: number };

export interface Part {
  shape: PartShape;
  m: MaterialKey;
  /** `wall` parts hang off a wall and are excluded from floor-standing checks. */
  mount?: "floor" | "wall";
  /** Suppress shadow casting for thin decorative bits — cheaper and cleaner. */
  noShadow?: boolean;
}

export type CatalogCategory =
  | "Living"
  | "Dining"
  | "Kitchen"
  | "Bedroom"
  | "Bath"
  | "Study"
  | "Utility"
  | "Lighting"
  | "Decor";

/** How the item is measured and sold. */
export type PricingUnit = "each" | "perMetre" | "perSqm" | "clientSupplied";

export interface CatalogItem {
  key: string;
  name: string;
  category: CatalogCategory;
  /** Nominal footprint, mm. */
  w: Mm;
  d: Mm;
  /** Overall height, used for cutaway logic and spec sheets. */
  h: Mm;
  /** Base rate in the catalog's reference currency (INR), before style multiplier. */
  price: number;
  unit: PricingUnit;
  /** Clear floor the piece needs in front of it to be usable, mm. */
  clearance?: Mm;
  /** Keys this piece is allowed to overlap — chairs tuck under tables. */
  compatible?: string[];
  /** Which dimensions the designer may stretch. */
  resize?: "w" | "wd" | "none";
  /** Minimum and maximum width when resizable. */
  wRange?: [Mm, Mm];
  /** Flat items (rugs) do not participate in collision checks. */
  flat?: boolean;
  /** Hangs on a wall; ignored by floor clearance rules. */
  wallHung?: boolean;
  /**
   * Fixed to the ceiling rather than a wall. Still `wallHung` for collision
   * purposes, but exempt from the "must be against a wall" check.
   */
  ceilingHung?: boolean;
  /**
   * A floor zone you stand in rather than an obstacle you walk around —
   * a shower tray, a rug. Excluded from walkway measurement.
   */
  standIn?: boolean;
  /** Short spec line for the quote and the client-facing spec sheet. */
  spec?: string;
  /** Lead time in weeks, surfaced on the quote. */
  leadWeeks?: number;
  /** Builds the solid parts for a given footprint. */
  parts: (w: Mm, d: Mm, h: Mm) => Part[];
  /** Light this piece emits, if any — used by the renderer, not the quote. */
  lights?: (w: Mm, d: Mm, h: Mm) => ItemLight[];
}

export interface ItemLight {
  /** Local coordinates, mm, origin at the footprint centre, z from floor. */
  x: Mm;
  y: Mm;
  z: Mm;
  /** Lumens-ish; the renderer normalises. */
  intensity: number;
  /** Colour temperature in kelvin. */
  kelvin: number;
  /** Fall-off distance in mm. */
  distance: Mm;
  kind: "point" | "spot";
}

/* ------------------------------------------------------------------ *
 * Project model
 * ------------------------------------------------------------------ */

export type RoomType =
  | "living"
  | "dining"
  | "kitchen"
  | "bedroom"
  | "kids"
  | "bath"
  | "utility"
  | "study"
  | "balcony"
  | "foyer"
  | "passage";

export interface Room extends Rect {
  id: string;
  name: string;
  type: RoomType;
  /** Id of the applied layout template, if any. */
  layout?: string | null;
  /** Which rotation/mirror variant of that template is in use. */
  variant?: number;
  variantCount?: number;
  /** Per-room ceiling height override, mm. */
  ceiling?: Mm;
  /** Dropped/false ceiling depth, mm. 0 = none. */
  falseCeiling?: Mm;
  /** Per-room floor finish override. */
  floorFinish?: MaterialKey;
  /** Accent wall side, painted in `wallAccent`. */
  accentWall?: Side | null;
  notes?: string;
}

export type OpeningKind = "door" | "sliding" | "cased" | "window" | "frenchWindow";

export interface Opening {
  id: string;
  /** `h` lies on a horizontal wall (constant y); `v` on a vertical wall (constant x). */
  o: "h" | "v";
  x: Mm;
  y: Mm;
  /** Width along the wall. */
  w: Mm;
  kind: OpeningKind;
  /** Height of the opening, mm. */
  h: Mm;
  /** Height of the sill above floor, mm. 0 for doors. */
  sill: Mm;
  /** +1 / -1 — which way a door leaf swings. */
  swing: 1 | -1;
  /** Mirror the hinge side. */
  hinge?: "start" | "end";
  label?: string;
}

export interface PlacedItem {
  id: string;
  key: string;
  /** Footprint centre, mm. */
  cx: Mm;
  cy: Mm;
  rot: Rot;
  /** Overrides of the catalog nominal size. */
  w?: Mm;
  d?: Mm;
  /** Base height above floor for wall-hung pieces, mm. */
  z?: Mm;
  /** Swap individual material slots for this piece only. */
  finishes?: Partial<Record<MaterialKey, MaterialKey>>;
  /** Designer's label, shown on drawings. */
  label?: string;
  /** Locked items are skipped by auto-layout and cannot be dragged. */
  locked?: boolean;
}

export interface Currency {
  code: string;
  symbol: string;
  /** BCP-47 locale used for digit grouping. */
  locale: string;
  /** Multiplier from the catalog reference currency (INR) to this currency. */
  rateFromINR: number;
}

export interface TaxLine {
  label: string;
  /** Percent. */
  rate: number;
}

export interface QuoteSettings {
  number: string;
  /** Design fee as a percent of the fit-out subtotal. */
  designFeePct: number;
  /** Named tax lines — GST for India, VAT/sales tax elsewhere. */
  taxes: TaxLine[];
  /** Site-level discount, percent. */
  discountPct: number;
  terms: string;
  /** Include the 3D-printed presentation model as a line item. */
  includeScaleModel: boolean;
  validDays: number;
}

export interface PrintSettings {
  /** 1:`scale`. */
  scale: 50 | 75 | 100;
  walls: "full" | "cut";
  includeFurniture: boolean;
  /** Emit furniture as a second STL so it can print in another colour. */
  separateFurniture: boolean;
  /** Thinnest printable feature, mm at model scale. */
  minFeature: number;
  /** Printer bed size, mm. */
  bed: number;
  /** Bureau rate per gram, in project currency. */
  ratePerGram: number;
}

export interface ViewSettings {
  walls: "cut" | "full";
  showCeiling: boolean;
  /** Time of day drives sun angle and colour. 0–24. */
  timeOfDay: number;
  /** Artificial lighting on/off. */
  lightsOn: boolean;
  quality: "draft" | "standard" | "high";
}

export interface Project {
  /** Schema version, so saved projects can be migrated forward. */
  v: number;
  id: string;
  name: string;
  client: string;
  siteAddress?: string;
  styleId: string;
  /** Default ceiling height, mm. */
  ceiling: Mm;
  rooms: Room[];
  openings: Opening[];
  items: PlacedItem[];
  /** Per-project rate overrides, keyed by catalog key. */
  rates: Record<string, number>;
  currency: Currency;
  units: UnitSystem;
  quote: QuoteSettings;
  print: PrintSettings;
  view: ViewSettings;
  updatedAt: number;
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export type IssueSeverity = "error" | "warning" | "info";

export interface Issue {
  /** Item id, room id or opening id. */
  target: string;
  targetKind: "item" | "room" | "opening";
  severity: IssueSeverity;
  /** Stable code so the UI can group and the docs can explain. */
  code: string;
  message: string;
}

export interface ValidationReport {
  issues: Issue[];
  byItem: Map<string, Issue[]>;
  byRoom: Map<string, Issue[]>;
  blockedOpenings: Set<string>;
  errorCount: number;
  warningCount: number;
}
