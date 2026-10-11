import { CATALOG } from "../catalog/index.js";
import type { Mm, RoomType, Rot } from "../types.js";

/** A candidate placement in a room's local space: x 0→W, y 0→D of the clear floor. */
export interface Candidate {
  key: string;
  cx: Mm;
  cy: Mm;
  rot: Rot;
  w?: Mm;
  d?: Mm;
  z?: Mm;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  /** One line the designer can read out to a client. */
  note: string;
  /** Smallest clear floor this template can work in, mm. */
  min?: { w: Mm; d: Mm };
  make: (W: Mm, D: Mm) => Candidate[];
}

/* ------------------------------------------------------------------ *
 * Placement helpers
 * ------------------------------------------------------------------ */

const size = (key: string, ov?: { w?: Mm; d?: Mm }) => {
  const c = CATALOG[key];
  return { w: ov?.w ?? c?.w ?? 600, d: ov?.d ?? c?.d ?? 600 };
};

type Ov = { w?: Mm; d?: Mm; z?: Mm };

const put = (key: string, cx: Mm, cy: Mm, rot: Rot = 0, ov: Ov = {}): Candidate => ({
  key,
  cx: Math.round(cx),
  cy: Math.round(cy),
  rot,
  ...ov,
});

/** Against the top wall, facing into the room. `u` is the distance along that wall. */
const north = (key: string, u: Mm, ov: Ov = {}): Candidate =>
  put(key, u, size(key, ov).d / 2, 0, ov);

/** Against the bottom wall. */
const south = (key: string, u: Mm, D: Mm, ov: Ov = {}): Candidate =>
  put(key, u, D - size(key, ov).d / 2, 180, ov);

/** Against the left wall. */
const west = (key: string, v: Mm, ov: Ov = {}): Candidate =>
  put(key, size(key, ov).d / 2, v, 270, ov);

/** Against the right wall. */
const east = (key: string, v: Mm, W: Mm, ov: Ov = {}): Candidate =>
  put(key, W - size(key, ov).d / 2, v, 90, ov);

/**
 * A ceiling fixture. `z` is recomputed against the room's real ceiling when the
 * layout is applied, so the value here is only a sensible starting point.
 */
const ceilingAt = (key: string, cx: Mm, cy: Mm, ceilZ: Mm = 2700, ov: Ov = {}): Candidate =>
  put(key, cx, cy, 0, { ...ov, z: ceilZ - (CATALOG[key]?.h ?? 1600) });

/** A ceiling fixture sized to the room, for the resizable cove and track runs. */
const ceilingRun = (key: string, W: Mm, D: Mm, ceilZ = 2700, inset = 500): Candidate => {
  const range = CATALOG[key]?.wRange ?? [600, 4800];
  return ceilingAt(key, W / 2, D / 2, ceilZ, {
    w: fit(Math.max(W, D) - inset, range[0], range[1]),
  });
};

const fit = (v: Mm, lo: Mm, hi: Mm) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

export const TEMPLATES: Partial<Record<RoomType, LayoutTemplate[]>> = {
  living: [
    {
      id: "tvwall",
      name: "Sofa facing a TV wall",
      note: "TV panel on the short wall, 3-seater opposite, rug and coffee table between",
      min: { w: 3000, d: 3200 },
      make: (W, D) => {
        const c = W / 2;
        const tvW = fit(W - 600, 1200, 4000);
        const out: Candidate[] = [north("tvUnit", c, { w: tvW })];
        const sofaY = Math.min(D - 480, 3400);
        const centre = (sofaY + 900) / 2 + 100;
        out.push(put("sofa3", c, sofaY, 180));
        out.push(put("rug", c, centre, 0, { w: fit(W - 900, 1600, 3000), d: fit(sofaY - 1100, 1200, 2200) }));
        out.push(put("coffee", c, centre));
        if (W >= 4200) {
          out.push(put("armchair", c - 1500, centre, 270));
          out.push(put("armchair", c + 1500, centre, 90));
        } else if (W >= 3400) {
          out.push(put("armchair", c + 1300, centre - 300, 90));
        }
        if (W >= 3600) out.push(north("planter", W - 300));
        if (D >= 4000) out.push(put("sideTable", c + tvW / 2 - 200, sofaY - 600, 0));
        out.push(ceilingRun("coveLight", W, D));
        out.push(put("floorLamp", 300, sofaY - 300, 0));
        return out;
      },
    },
    {
      id: "lounge",
      name: "L-sofa lounge",
      note: "L-shaped sofa into a corner, TV wall opposite, bookshelf on the return",
      min: { w: 3400, d: 3600 },
      make: (W, D) => {
        const out: Candidate[] = [put("sofaL", 1400, D - 900, 180)];
        const cx = fit(1900, 1200, W - 1200);
        const centre = D - 1750;
        out.push(north("tvUnit", cx, { w: fit(W - 600, 1200, 3000) }));
        out.push(put("rug", cx, centre, 0, { w: fit(W - 700, 1600, 2800), d: 1800 }));
        out.push(put("coffee", cx, centre));
        if (W >= 4000) out.push(east("bookshelf", D / 2, W, { w: fit(D - 1400, 600, 1800) }));
        out.push(put("fullHeightPlant", W - 600, D - 600, 0));
        out.push(ceilingAt("pendantCluster", cx, centre, 2700));
        return out;
      },
    },
    {
      id: "conversation",
      name: "Conversation set, no TV",
      note: "Sofa and two armchairs facing each other across a rug — for a formal drawing room",
      min: { w: 3600, d: 3000 },
      make: (W, D) => {
        const m = D / 2;
        const out: Candidate[] = [
          west("sofa3", m),
          put("rug", 1900, m, 0, { w: fit(W - 1200, 1600, 2600), d: fit(D - 900, 1400, 2400) }),
          put("coffee", 1750, m, 90),
        ];
        out.push(put("armchair", 2900, m - 600, 90));
        out.push(put("armchair", 2900, m + 600, 90));
        if (W >= 4400) out.push(east("console", m, W, { w: fit(D - 1200, 900, 1800) }));
        out.push(put("pouffe", 1750, m + 1000, 0));
        out.push(ceilingAt("chandelier", 1900, m, 2700));
        return out;
      },
    },
    {
      id: "openplan",
      name: "Open-plan living and dining",
      note: "Seating at one end, a 6-seater table at the other, zoned by rugs",
      min: { w: 5200, d: 3200 },
      make: (W, D) => {
        const out: Candidate[] = [];
        const splitX = W * 0.56;
        // living half
        out.push(north("tvUnit", splitX / 2, { w: fit(splitX - 700, 1200, 3000) }));
        out.push(put("sofa3", splitX / 2, Math.min(D - 480, 3300), 180));
        out.push(put("rug", splitX / 2, D / 2 + 150, 0, { w: fit(splitX - 800, 1600, 2600), d: 1700 }));
        out.push(put("coffee", splitX / 2, D / 2 + 150));
        // dining half
        const dx = splitX + (W - splitX) / 2;
        out.push(put("dining6", dx, D / 2));
        for (const off of [-600, 0, 600]) {
          out.push(put("diningChair", dx + off, D / 2 - 560, 0));
          out.push(put("diningChair", dx + off, D / 2 + 560, 180));
        }
        out.push(ceilingAt("pendantCluster", dx, D / 2, 2700));
        out.push(ceilingAt("coveLight", splitX / 2, D / 2, 2700, { w: fit(splitX - 500, 600, 9000) }));
        return out;
      },
    },
  ],

  dining: [
    {
      id: "four",
      name: "4-seater with crockery unit",
      note: "Table centred, four chairs, crockery unit against a side wall",
      min: { w: 2400, d: 2400 },
      make: (W, D) => {
        const hasUnit = W >= 3100;
        const c = hasUnit ? Math.min(W / 2, W - 1700) : W / 2;
        const m = D / 2;
        const out: Candidate[] = [put("dining4", c, m)];
        for (const dx of [-300, 300]) {
          out.push(put("diningChair", c + dx, m - 520, 0));
          out.push(put("diningChair", c + dx, m + 520, 180));
        }
        if (hasUnit) out.push(east("crockeryUnit", m, W, { w: fit(D - 1200, 600, 1800) }));
        out.push(ceilingAt("pendantCluster", c, m, 2700));
        return out;
      },
    },
    {
      id: "six",
      name: "6-seater family table",
      note: "Long table with six chairs and a pendant run overhead",
      min: { w: 3000, d: 2800 },
      make: (W, D) => {
        const c = W / 2;
        const m = D / 2;
        const out: Candidate[] = [put("dining6", c, m), put("rug", c, m, 0, { w: 2700, d: 1900 })];
        for (const dx of [-620, 0, 620]) {
          out.push(put("diningChair", c + dx, m - 570, 0));
          out.push(put("diningChair", c + dx, m + 570, 180));
        }
        out.push(ceilingAt("pendantCluster", c, m, 2700));
        if (W >= 4200) out.push(east("crockeryUnit", m, W, { w: fit(D - 1400, 600, 1800) }));
        return out;
      },
    },
    {
      id: "round",
      name: "Round table",
      note: "Round table with four chairs — kinder in a square room",
      min: { w: 2600, d: 2600 },
      make: (W, D) => {
        const c = W / 2;
        const m = D / 2;
        const out: Candidate[] = [put("diningRound", c, m), put("rug", c, m, 0, { w: 2200, d: 2200 })];
        out.push(put("diningChair", c, m - 760, 0));
        out.push(put("diningChair", c, m + 760, 180));
        out.push(put("diningChair", c - 760, m, 270));
        out.push(put("diningChair", c + 760, m, 90));
        out.push(ceilingAt("chandelier", c, m, 2700));
        return out;
      },
    },
    {
      id: "banquette",
      name: "Table with a bench",
      note: "Bench on the wall side and chairs opposite — fits more people into less room",
      min: { w: 2800, d: 2200 },
      make: (W, D) => {
        const c = W / 2;
        const out: Candidate[] = [put("dining6", c, D / 2 + 100)];
        out.push(north("bench", c, { w: fit(W - 800, 900, 1800) }));
        for (const dx of [-620, 0, 620]) out.push(put("diningChair", c + dx, D / 2 + 680, 180));
        out.push(ceilingAt("pendantCluster", c, D / 2 + 100, 2700));
        return out;
      },
    },
  ],

  kitchen: [
    {
      id: "lshape",
      name: "L-shaped kitchen",
      note: "Counters on two walls with the hob on the long run and the sink on the return",
      min: { w: 2100, d: 1800 },
      make: (W, D) => {
        const runW = Math.max(900, W - 850);
        const out: Candidate[] = [
          north("counterRun", runW / 2, { w: runW }),
          north("fridge", W - 400),
        ];
        const legD = Math.min(D - 700, 2600);
        if (legD >= 900) out.push(put("counterRun", 300, 650 + legD / 2, 270, { w: legD }));
        out.push(north("hob", Math.min(runW - 500, 1200)));
        if (legD >= 1200) out.push(put("sink", 320, 650 + legD / 2, 270));
        out.push(ceilingRun("trackLight", W, D, 2550));
        return out;
      },
    },
    {
      id: "parallel",
      name: "Parallel kitchen",
      note: "Two facing runs with a 1000 mm aisle — the most efficient layout for a galley",
      min: { w: 2100, d: 2600 },
      make: (W, D) => {
        const out: Candidate[] = [
          north("counterRun", (W - 800) / 2, { w: Math.max(900, W - 800) }),
          north("fridge", W - 400),
          south("counterBase", W / 2, D, { w: Math.max(900, W - 200) }),
        ];
        out.push(north("hob", Math.min(W - 1200, 1100)));
        out.push(south("sink", W / 2, D));
        out.push(ceilingRun("trackLight", W, D, 2550));
        return out;
      },
    },
    {
      id: "straight",
      name: "Straight kitchen",
      note: "One run along the longest wall — for a compact flat",
      min: { w: 1800, d: 1500 },
      make: (W, D) => {
        const runW = Math.max(900, W - 850);
        const out: Candidate[] = [
          north("counterRun", runW / 2, { w: runW }),
          north("fridge", W - 400),
          north("hob", Math.min(runW - 500, 900)),
        ];
        if (runW > 1800) out.push(north("sink", runW - 450));
        out.push(ceilingRun("trackLight", W, D, 2550));
        return out;
      },
    },
    {
      id: "island",
      name: "Kitchen with an island",
      note: "Perimeter run with a central island and breakfast seating",
      min: { w: 3600, d: 3400 },
      make: (W, D) => {
        const runW = Math.max(1200, W - 850);
        const out: Candidate[] = [
          north("counterRun", runW / 2, { w: runW }),
          north("fridge", W - 400),
          north("hob", Math.min(runW - 500, 1200)),
        ];
        const islandW = fit(W - 1800, 1200, 2800);
        out.push(put("island", W / 2, D - 1500, 180, { w: islandW }));
        out.push(put("sink", W / 2, D - 1600, 180));
        for (const dx of [-500, 500]) out.push(put("barStool", W / 2 + dx, D - 800, 0));
        out.push(ceilingAt("pendantCluster", W / 2, D - 1500, 2700));
        return out;
      },
    },
  ],

  bedroom: [
    {
      id: "classic",
      name: "Bed with a wardrobe wall",
      note: "Bed centred on the head wall, wardrobe opposite, dresser if the room allows",
      min: { w: 2800, d: 3000 },
      make: (W, D) => {
        const bedKey = W >= 4000 && D >= 3600 ? "bedKing" : "bedQueen";
        const bed = size(bedKey);
        const c = W / 2;
        const sideOff = bed.w / 2 + 250;
        const out: Candidate[] = [north(bedKey, c)];
        if (c - sideOff > 240) out.push(north("nightstand", c - sideOff));
        if (W - (c + sideOff) > 240) out.push(north("nightstand", c + sideOff));
        const wardW = fit(W - 500, 900, 2400);
        out.push(south(W >= 3600 ? "wardrobeSliding" : "wardrobe", wardW / 2 + 150, D, { w: wardW }));
        if (W >= 4400) out.push(east("dresser", 1700, W));
        out.push(put("rug", c, bed.d - 200, 0, { w: fit(bed.w + 1200, 1600, W - 600), d: 1500 }));
        out.push(ceilingRun("coveLight", W, D));
        out.push(north("artPanel", c, { z: 1500, w: 1200 }));
        return out;
      },
    },
    {
      id: "studywall",
      name: "Bed with a study corner",
      note: "Bed on a side wall, desk under the window, wardrobe on the return",
      min: { w: 3200, d: 3200 },
      make: (W, D) => {
        const bedKey = D >= 3800 ? "bedKing" : "bedQueen";
        const bed = size(bedKey);
        const m = D / 2 + 250;
        const out: Candidate[] = [west(bedKey, m)];
        if (m + bed.w / 2 + 250 < D - 100) out.push(west("nightstand", m + bed.w / 2 + 250));
        if (m - bed.w / 2 - 250 > 100) out.push(west("nightstand", m - bed.w / 2 - 250));
        const wardW = fit(W - 2300, 900, 2000);
        out.push(south("wardrobe", W - wardW / 2 - 100, D, { w: wardW }));
        out.push(north("desk", W - 800, { w: fit(W - bed.d - 500, 900, 1500) }));
        out.push(put("studyChair", W - 800, 1000, 180));
        out.push(ceilingRun("coveLight", W, D));
        return out;
      },
    },
    {
      id: "hotel",
      name: "Hotel-style suite",
      note: "Bed on axis, bench at the foot, TV panel opposite, reading lights both sides",
      min: { w: 3800, d: 4000 },
      make: (W, D) => {
        const c = W / 2;
        const out: Candidate[] = [north("bedKing", c)];
        const bed = size("bedKing");
        out.push(north("nightstand", c - bed.w / 2 - 250));
        out.push(north("nightstand", c + bed.w / 2 + 250));
        out.push(put("bedBench", c, bed.d + 350, 0, { w: fit(bed.w - 300, 900, 1600) }));
        out.push(south("tvUnit", c, D, { w: fit(W - 700, 1200, 2800) }));
        out.push(put("rug", c, bed.d + 100, 0, { w: fit(W - 700, 1800, 3000), d: 2000 }));
        if (W >= 4600) out.push(east("armchair", D - 900, W));
        out.push(ceilingRun("coveLight", W, D));
        return out;
      },
    },
    {
      id: "compact",
      name: "Compact bedroom",
      note: "Queen bed hard against one wall with a single wardrobe run — for a small second bedroom",
      min: { w: 2400, d: 2800 },
      make: (W, D) => {
        const out: Candidate[] = [put("bedQueen", 950, 1150, 0)];
        out.push(north("nightstand", 1950));
        const wardW = fit(W - 400, 900, 1800);
        out.push(south("wardrobe", W - wardW / 2 - 100, D, { w: wardW }));
        out.push(ceilingRun("coveLight", W, D));
        return out;
      },
    },
  ],

  kids: [
    {
      id: "twin",
      name: "Twin beds",
      note: "Two single beds with a shared nightstand between",
      min: { w: 3000, d: 2600 },
      make: (W, D) => {
        const gap = (W - 2100) / 3;
        const out: Candidate[] = [
          north("bedSingle", gap + 525),
          north("bedSingle", 2 * gap + 1575),
          north("nightstand", W / 2),
        ];
        const wardW = fit(W - 600, 900, 1800);
        out.push(south("wardrobe", W / 2, D, { w: wardW }));
        out.push(ceilingRun("coveLight", W, D));
        return out;
      },
    },
    {
      id: "bunk",
      name: "Bunk bed with a desk",
      note: "Bunk in the corner, desk under the window, toy storage below",
      min: { w: 2800, d: 2800 },
      make: (W, D) => {
        const out: Candidate[] = [west("bunkBed", D / 2)];
        out.push(north("desk", W - 800, { w: fit(W - 1400, 900, 1400) }));
        out.push(put("studyChair", W - 800, 1000, 180));
        out.push(south("kidsStorage", W - 600, D));
        out.push(put("rug", W / 2 + 400, D / 2 + 300, 0, { w: 1600, d: 1200 }));
        out.push(ceilingRun("coveLight", W, D));
        return out;
      },
    },
    {
      id: "single",
      name: "Single bed and study",
      note: "One bed, a desk and a wardrobe — a study bedroom for an older child",
      min: { w: 2600, d: 2800 },
      make: (W, D) => {
        const out: Candidate[] = [north("bedSingle", 625)];
        out.push(north("nightstand", 1400));
        out.push(east("desk", D - 900, W, { w: fit(D - 1600, 900, 1400) }));
        const wardW = fit(W - 1600, 900, 1800);
        out.push(south("wardrobe", wardW / 2 + 100, D, { w: wardW }));
        out.push(ceilingRun("coveLight", W, D));
        return out;
      },
    },
  ],

  bath: [
    {
      id: "compact",
      name: "Shower at the far end",
      note: "Vanity and WC on facing walls with a walk-in shower across the end",
      min: { w: 1200, d: 1800 },
      make: (W, D) => {
        const out: Candidate[] = [
          east("vanity", 750, W, { w: fit(D - 1500, 600, 1200) }),
          west("wc", 1000),
        ];
        out.push(south("shower", W / 2, D, { w: W, d: Math.min(1100, D - 1500) }));
        out.push(east("towelRail", 1600, W));
        return out;
      },
    },
    {
      id: "side",
      name: "Wet and dry split",
      note: "Vanity and WC in the dry zone, shower partitioned off behind glass",
      min: { w: 1500, d: 2000 },
      make: (W, D) => {
        const out: Candidate[] = [west("vanity", 700, { w: fit(D - 1800, 600, 1100) }), west("wc", 1600)];
        out.push(east("shower", D - 700, W, { w: 1200, d: Math.min(1000, W - 800) }));
        out.push(west("towelRail", D - 400));
        return out;
      },
    },
    {
      id: "master",
      name: "Master bathroom with a tub",
      note: "Twin vanity, separate shower and a freestanding tub",
      min: { w: 2400, d: 3000 },
      make: (W, D) => {
        const out: Candidate[] = [
          north("vanity", W / 2, { w: fit(W - 700, 1200, 2000) }),
          west("wc", D - 700),
        ];
        out.push(east("shower", D - 800, W, { w: 1200, d: 1000 }));
        out.push(put("bathtub", W / 2, D / 2 + 200, 0, { w: fit(W - 900, 1500, 1800) }));
        out.push(north("towelRail", 350));
        return out;
      },
    },
  ],

  utility: [
    {
      id: "laundry",
      name: "Laundry and store",
      note: "Washing machine on one wall, storage rack opposite, sink if the room allows",
      min: { w: 1200, d: 1000 },
      make: (W, D) => {
        // washer hard into the right-hand corner, rack on the facing wall at the
        // left-hand end, so neither stands in the other's working space
        const out: Candidate[] = [north("washer", W - 350)];
        if (W >= 2400) out.push(north("utilitySink", W - 1050));
        const rackW = fit(Math.min(W - 700, 1400), 600, 1400);
        out.push(south("storageRack", rackW / 2 + 50, D, { w: rackW }));
        out.push(ceilingRun("trackLight", W, D, 2550));
        return out;
      },
    },
    {
      id: "stacked",
      name: "Stacked washer and dryer",
      note: "Washer and dryer stacked to free up floor for storage",
      min: { w: 1000, d: 900 },
      make: (W, D) => [
        north("washer", W - 350),
        north("dryer", W - 350, { z: 880 }),
        north("storageRack", 550, { w: fit(W - 1100, 600, 1400) }),
      ],
    },
  ],

  study: [
    {
      id: "desk",
      name: "Desk and bookshelves",
      note: "Desk on the window wall with shelving beside and a reading chair",
      min: { w: 2400, d: 2400 },
      make: (W, D) => {
        const out: Candidate[] = [
          north("desk", W / 2, { w: fit(W - 900, 1000, 1800) }),
          put("studyChair", W / 2, 1000, 180),
        ];
        out.push(west("bookshelf", D / 2, { w: fit(D - 1200, 600, 1800) }));
        if (W >= 3000) out.push(south("armchair", W - 600, D));
        out.push(put("rug", W / 2, D / 2 + 300, 0, { w: fit(W - 1200, 1200, 2200), d: 1500 }));
        out.push(ceilingRun("coveLight", W, D));
        return out;
      },
    },
    {
      id: "wall",
      name: "Full study wall",
      note: "A single built-in run with drawers, open shelves and closed storage",
      min: { w: 2600, d: 2200 },
      make: (W, D) => {
        const out: Candidate[] = [north("studyUnit", W / 2, { w: fit(W - 400, 900, 4000) })];
        out.push(put("studyChair", W / 2, 1100, 180));
        if (D >= 3000) out.push(south("meetingTable", W / 2, D));
        out.push(ceilingAt("trackLight", W / 2, 700, 2700, { w: fit(W - 500, 600, 4800) }));
        return out;
      },
    },
  ],

  foyer: [
    {
      id: "entry",
      name: "Entry console and shoe storage",
      note: "Shoe cabinet, console with a mirror above and a runner rug",
      min: { w: 1200, d: 1000 },
      make: (W, D) => {
        const out: Candidate[] = [north("shoeCabinet", Math.min(600, W - 500))];
        if (W >= 2400) out.push(north("console", W - 700));
        out.push(east("mirrorPanel", D / 2, W, { z: 900 }));
        out.push(put("rugRunner", W / 2, D / 2, 0, { w: fit(W - 400, 900, 2400), d: fit(D - 400, 500, 900) }));
        out.push(ceilingAt("pendantCluster", W / 2, D / 2, 2700));
        return out;
      },
    },
    {
      id: "pooja",
      name: "Foyer with a pooja unit",
      note: "Pooja unit on the east wall with shoe storage opposite",
      min: { w: 1600, d: 1600 },
      make: (W, D) => {
        const out: Candidate[] = [east("poojaUnit", D / 2, W)];
        out.push(west("shoeCabinet", D / 2));
        out.push(put("rugRunner", W / 2, D / 2, 0, { w: fit(W - 1400, 600, 1600), d: 700 }));
        out.push(ceilingRun("coveLight", W, D));
        return out;
      },
    },
  ],

  balcony: [
    {
      id: "sitout",
      name: "Balcony sit-out",
      note: "Two chairs, a small table and planters along the rail",
      min: { w: 1400, d: 1000 },
      make: (W, D) => {
        const out: Candidate[] = [
          put("armchair", W / 2 - 600, D / 2, 0),
          put("armchair", W / 2 + 600, D / 2, 0),
          put("sideTable", W / 2, D / 2, 0),
        ];
        for (let x = 350; x < W - 200; x += 700) out.push(south("planter", x, D));
        return out;
      },
    },
    {
      id: "swing",
      name: "Balcony with a swing",
      note: "A jhoola with planters — the most-requested balcony in Indian flats",
      min: { w: 1800, d: 1400 },
      make: (W, D) => {
        const out: Candidate[] = [put("swing", W / 2, D / 2, 0, { w: fit(W - 700, 1200, 1800) })];
        out.push(south("fullHeightPlant", W - 550, D));
        return out;
      },
    },
  ],

  passage: [
    {
      id: "gallery",
      name: "Gallery passage",
      note: "A runner with artwork along one wall",
      make: (W, D) => {
        const out: Candidate[] = [
          put("rugRunner", W / 2, D / 2, 0, { w: fit(W - 400, 900, 3600), d: fit(D - 400, 500, 800) }),
        ];
        out.push(north("artTriptych", W / 2, { z: 1000, w: fit(W - 800, 1200, 2400) }));
        out.push(ceilingRun("trackLight", W, D));
        return out;
      },
    },
  ],
};

export const templatesFor = (type: RoomType): LayoutTemplate[] => TEMPLATES[type] ?? [];
