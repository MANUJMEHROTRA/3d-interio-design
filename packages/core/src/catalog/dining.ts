import type { CatalogItem, Mm, Part } from "../types.js";
import { ball, box, cushion, cyl, drawers, lathe, legs4, shutters, slab } from "./primitives.js";

/** Chair: tapered legs, a crowned seat pad and a shaped back — not a slab. */
function chairParts(w: Mm, d: Mm, seatZ: Mm, backTop: Mm, upholstered: boolean): Part[] {
  const out: Part[] = [
    ...legs4(w, d, seatZ, "woodMid", { inset: 42, r: 17, taper: 0.66 }),
    // seat rails
    box(38, 38, seatZ - 58, w - 38, 58, seatZ - 20, "woodMid", { bevel: 1 }),
    box(38, d - 58, seatZ - 58, w - 38, d - 38, seatZ - 20, "woodMid", { bevel: 1 }),
    box(38, 38, seatZ - 58, 58, d - 38, seatZ - 20, "woodMid", { bevel: 1 }),
    box(w - 58, 38, seatZ - 58, w - 38, d - 38, seatZ - 20, "woodMid", { bevel: 1 }),
    // back uprights, raked
    cyl(50, 50, seatZ, backTop, 18, "woodMid", { r1: 15, segments: 10 }),
    cyl(w - 50, 50, seatZ, backTop, 18, "woodMid", { r1: 15, segments: 10 }),
  ];
  if (upholstered) {
    out.push(cushion(16, 16, seatZ - 20, w - 16, d - 16, seatZ + 48, "fabric", 14, 22));
    out.push(cushion(44, 34, backTop - 300, w - 44, 92, backTop - 30, "fabric", 16, 26));
  } else {
    out.push(slab(10, 10, seatZ - 20, w - 10, d - 10, seatZ + 16, "woodMid", "bullnose"));
    out.push(box(44, 42, backTop - 260, w - 44, 72, backTop - 40, "woodMid", { radius: 30 }));
  }
  return out;
}

/** Rectangular table: trestle or four-leg, with a proper apron under the top. */
function tableParts(topZ: Mm) {
  return (w: Mm, d: Mm): Part[] => [
    ...legs4(w, d, topZ - 38, "woodDark", { inset: 95, r: 32, taper: 0.78 }),
    box(70, 70, topZ - 110, w - 70, 100, topZ - 38, "woodDark", { bevel: 2 }),
    box(70, d - 100, topZ - 110, w - 70, d - 70, topZ - 38, "woodDark", { bevel: 2 }),
    slab(0, 0, topZ - 38, w, d, topZ, "woodDark", "eased"),
  ];
}

export const DINING: CatalogItem[] = [
  {
    key: "dining4",
    name: "4-seater dining table",
    category: "Dining",
    w: 1200,
    d: 800,
    h: 760,
    price: 32000,
    unit: "each",
    compatible: ["diningChair", "rug"],
    spec: "Solid wood top, 38 mm, oil finish",
    leadWeeks: 6,
    parts: tableParts(760),
  },
  {
    key: "dining6",
    name: "6-seater dining table",
    category: "Dining",
    w: 1800,
    d: 900,
    h: 760,
    price: 48000,
    unit: "each",
    compatible: ["diningChair", "rug", "bench"],
    spec: "Solid wood top, 38 mm, oil finish",
    leadWeeks: 7,
    parts: tableParts(760),
  },
  {
    key: "dining8",
    name: "8-seater dining table",
    category: "Dining",
    w: 2400,
    d: 1000,
    h: 760,
    price: 68000,
    unit: "each",
    compatible: ["diningChair", "rug", "bench"],
    leadWeeks: 8,
    parts: tableParts(760),
  },
  {
    key: "diningRound",
    name: "Round dining table, 4 seats",
    category: "Dining",
    w: 1200,
    d: 1200,
    h: 755,
    price: 38000,
    unit: "each",
    compatible: ["diningChair", "rug"],
    spec: "Marble top on a turned pedestal",
    leadWeeks: 7,
    parts: (w, d) => [
      lathe(w / 2, d / 2, 0, 700, [
        [230, 0],
        [210, 0.05],
        [78, 0.22],
        [72, 0.85],
        [120, 1],
      ], "woodDark"),
      cyl(w / 2, d / 2, 700, 755, w / 2, "marble", { segments: 48 }),
    ],
  },
  {
    key: "diningChair",
    name: "Dining chair",
    category: "Dining",
    w: 460,
    d: 520,
    h: 900,
    price: 7200,
    unit: "each",
    // chairs sit shoulder to shoulder around a table; that is not a walkway
    compatible: ["dining4", "dining6", "dining8", "diningRound", "rug", "diningChair", "bench"],
    spec: "Solid wood frame, upholstered seat and back pad",
    leadWeeks: 5,
    parts: (w, d) => chairParts(w, d, 450, 900, true),
  },
  {
    key: "bench",
    name: "Dining bench",
    category: "Dining",
    w: 1400,
    d: 380,
    h: 450,
    price: 14000,
    unit: "each",
    compatible: ["dining6", "dining8", "rug", "diningChair"],
    leadWeeks: 5,
    parts: (w, d) => [
      box(60, 40, 0, 110, d - 40, 430, "woodDark", { bevel: 2 }),
      box(w - 110, 40, 0, w - 60, d - 40, 430, "woodDark", { bevel: 2 }),
      box(110, d / 2 - 30, 180, w - 110, d / 2 + 30, 240, "woodDark", { bevel: 2 }),
      cushion(0, 0, 430, w, d, 480, "fabric", 10, 16),
    ],
  },
  {
    key: "crockeryUnit",
    name: "Crockery unit",
    category: "Dining",
    w: 1200,
    d: 450,
    h: 2100,
    price: 42000,
    unit: "perMetre",
    resize: "w",
    wRange: [600, 3000],
    clearance: 700,
    spec: "Ply carcass, glass-fronted upper, drawers below",
    leadWeeks: 7,
    parts: (w, d) => {
      const out: Part[] = [
        box(28, 28, 0, w - 28, d - 10, 100, "metalDark", { bevel: 0 }),
        box(0, 0, 100, w, d, 900, "laminate", { bevel: 2 }),
        slab(0, 0, 900, w, d + 20, 940, "quartz", "eased"),
        box(0, 0, 940, w, d - 80, 2100, "laminate", { bevel: 2 }),
        ...drawers(0, w, 110, 890, d, 3, "laminate", "brass"),
      ];
      // glazed upper shutters with internal shelves
      const bays = Math.max(2, Math.round(w / 600));
      for (let i = 1; i < 3; i++) {
        out.push(box(18, 20, 940 + (1160 / 3) * i, w - 18, d - 80, 958 + (1160 / 3) * i, "laminate"));
      }
      out.push(...shutters(0, w, 960, 2090, d - 80, bays, "glass", { handle: "brass", handleStyle: "bar", thickness: 10 }));
      return out;
    },
  },
  {
    key: "barStool",
    name: "Bar stool",
    category: "Dining",
    w: 400,
    d: 400,
    h: 1050,
    price: 9500,
    unit: "each",
    compatible: ["breakfastCounter", "island", "barStool"],
    leadWeeks: 5,
    parts: (w, d) => [
      cyl(w / 2, d / 2, 0, 20, 185, "metalDark", { segments: 24 }),
      cyl(w / 2, d / 2, 20, 680, 30, "metalDark", { segments: 14 }),
      cyl(w / 2, d / 2, 300, 316, 150, "metalDark", { segments: 20 }),
      cushion(20, 20, 680, w - 20, d - 20, 750, "leather", 14, 60),
      box(60, 40, 750, w - 60, 100, 1050, "leather", { radius: 50 }),
    ],
  },
];
