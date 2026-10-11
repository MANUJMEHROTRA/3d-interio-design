/**
 * Every length in the domain is an integer number of millimetres.
 *
 * Millimetres are what Indian and European joinery drawings are dimensioned in,
 * they survive JSON round-trips without float drift, and they let us snap to a
 * 5 mm grid with plain integer arithmetic. Display conversion happens at the
 * edges only — never in the model.
 */

/** Millimetres. The one true unit of the model. */
export type Mm = number;

export const MM_PER_M = 1000;
export const MM_PER_INCH = 25.4;
export const MM_PER_FOOT = 304.8;
export const SQFT_PER_SQM = 10.763910416709722;

export type UnitSystem = "metric" | "imperial";

/** Round to the nearest `step`, staying on integers. */
export const snap = (v: number, step: number): number => Math.round(v / step) * step;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const mmToM = (mm: Mm): number => mm / MM_PER_M;
export const mToMm = (m: number): Mm => Math.round(m * MM_PER_M);

/** Area in mm² to m². */
export const mm2ToM2 = (a: number): number => a / 1_000_000;
/** Area in mm² to ft². */
export const mm2ToSqft = (a: number): number => mm2ToM2(a) * SQFT_PER_SQM;

/** `4500` → `"4.50 m"` */
export const formatLength = (mm: Mm, system: UnitSystem = "metric"): string => {
  if (system === "imperial") {
    const totalInches = mm / MM_PER_INCH;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches - feet * 12);
    return inches === 12 ? `${feet + 1}'0"` : `${feet}'${inches}"`;
  }
  return `${(mm / MM_PER_M).toFixed(2)} m`;
};

/** `4500 × 3600` → `"4.50 × 3.60 m"` */
export const formatSize = (w: Mm, d: Mm, system: UnitSystem = "metric"): string =>
  system === "imperial"
    ? `${formatLength(w, system)} × ${formatLength(d, system)}`
    : `${(w / MM_PER_M).toFixed(2)} × ${(d / MM_PER_M).toFixed(2)} m`;

/** Area label in whichever unit the studio sells in. */
export const formatArea = (mm2: number, system: UnitSystem = "metric"): string =>
  system === "imperial"
    ? `${Math.round(mm2ToSqft(mm2)).toLocaleString("en-IN")} sq ft`
    : `${mm2ToM2(mm2).toFixed(1)} m²`;
