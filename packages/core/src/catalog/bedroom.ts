import type { CatalogItem, Mm, Part } from "../types.js";
import {
  artwork,
  ball,
  bedding,
  box,
  cushion,
  cyl,
  drawers,
  lathe,
  legs4,
  pillows,
  sheet,
  shutters,
  slab,
} from "./primitives.js";

/**
 * Bed, authored facing +y: headboard at y = 0, foot at y = d.
 * Mattress, duvet and pillows are separate soft volumes, which is what makes a
 * bedroom render look slept-in rather than CAD-modelled.
 */
function bedParts(pillowCount: 1 | 2, headboardStyle: "panel" | "upholstered") {
  return (w: Mm, d: Mm): Part[] => {
    const frameZ = 340;
    const mattressZ = frameZ + 20;
    const out: Part[] = [
      // plinth frame, inset so the bed appears to float
      box(40, 100, 60, w - 40, d - 40, frameZ, "woodDark", { bevel: 2 }),
      box(70, 130, 0, w - 70, d - 70, 60, "metalDark", { bevel: 0 }),
      // mattress
      cushion(30, 110, frameZ, w - 30, d - 50, mattressZ + 210, "lacquer", 10, 26),
    ];

    if (headboardStyle === "upholstered") {
      out.push(box(0, 0, 60, w, 120, 1180, "woodDark", { bevel: 2 }));
      // buttoned panels
      const panels = Math.max(3, Math.round(w / 520));
      const pw = (w - 60) / panels;
      for (let i = 0; i < panels; i++) {
        const a = 30 + i * pw;
        out.push(cushion(a + 6, 110, 420, a + pw - 6, 170, 1150, "fabric", 20, 26));
      }
    } else {
      out.push(box(0, 0, 60, w, 110, 1150, "woodDark", { bevel: 3 }));
      for (let x = 40; x < w - 40; x += 150) {
        out.push(box(x, 110, 400, x + 100, 128, 1130, "woodMid", { radius: 40, noShadow: true }));
      }
    }

    out.push(...bedding(30, w - 30, 420, d - 50, mattressZ + 210, "fabricAlt"));
    out.push(...pillows(w / 2, 150, mattressZ + 230, pillowCount, "lacquer"));
    // a folded throw across the foot
    out.push(cushion(60, d - 560, mattressZ + 250, w - 60, d - 180, mattressZ + 300, "fabricAccent", 12, 20));
    return out;
  };
}

export const BEDROOM: CatalogItem[] = [
  {
    key: "bedKing",
    name: "King bed, 1830 × 2000 mm",
    category: "Bedroom",
    w: 1980,
    d: 2200,
    h: 1180,
    price: 82000,
    unit: "each",
    // 600 mm is the accepted minimum to walk and make the bed
    clearance: 600,
    compatible: ["nightstand", "rug", "bedBench"],
    spec: "Ply and veneer frame, upholstered headboard, hydraulic storage",
    leadWeeks: 8,
    parts: bedParts(2, "upholstered"),
  },
  {
    key: "bedQueen",
    name: "Queen bed, 1525 × 2000 mm",
    category: "Bedroom",
    w: 1680,
    d: 2200,
    h: 1180,
    price: 62000,
    unit: "each",
    clearance: 600,
    compatible: ["nightstand", "rug", "bedBench"],
    spec: "Ply and veneer frame, upholstered headboard, hydraulic storage",
    leadWeeks: 8,
    parts: bedParts(2, "upholstered"),
  },
  {
    key: "bedSingle",
    name: "Single bed, 900 × 1900 mm",
    category: "Bedroom",
    w: 1050,
    d: 2080,
    h: 1150,
    price: 28000,
    unit: "each",
    clearance: 600,
    compatible: ["nightstand", "rug"],
    spec: "Ply frame with a fluted headboard and drawer storage",
    leadWeeks: 7,
    parts: bedParts(1, "panel"),
  },
  {
    key: "nightstand",
    name: "Bedside table",
    category: "Bedroom",
    w: 450,
    d: 420,
    h: 560,
    price: 9500,
    unit: "each",
    compatible: ["bedKing", "bedQueen", "bedSingle", "rug"],
    spec: "Two soft-close drawers, veneer finish",
    leadWeeks: 6,
    parts: (w, d) => [
      ...legs4(w, d, 140, "metalDark", { inset: 40, r: 12, taper: 1 }),
      box(0, 0, 130, w, d, 540, "woodDark", { bevel: 2 }),
      slab(-10, -10, 540, w + 10, d + 10, 560, "woodDark", "eased"),
      ...drawers(0, w, 150, 530, d, 2, "woodDark", "brass"),
      // a small lamp, because bedside tables are never bare
      cyl(w / 2, d / 2, 560, 700, 28, "brass", { segments: 14 }),
      lathe(w / 2, d / 2, 700, 860, [
        [95, 1],
        [130, 0.2],
        [136, 0],
      ], "lampshade"),
      ball(w / 2, d / 2, 760, 50, "emissive", 1, true),
    ],
    lights: (w, d) => [
      { x: w / 2, y: d / 2, z: 770, intensity: 3.2, kelvin: 2700, distance: 2400, kind: "point" },
    ],
  },
  {
    key: "wardrobe",
    name: "Wardrobe, hinged shutters",
    category: "Bedroom",
    w: 1800,
    d: 620,
    h: 2400,
    price: 64000,
    unit: "perMetre",
    resize: "w",
    wRange: [600, 5000],
    clearance: 800,
    spec: "Full-height BWP ply carcass, laminate shutters, internal drawers and hanging",
    leadWeeks: 8,
    parts: (w, d) => {
      const bays = Math.max(2, Math.round(w / 600));
      return [
        box(30, 40, 0, w - 30, d - 20, 90, "metalDark", { bevel: 0 }),
        box(0, 0, 90, w, d - 20, 2400, "laminate", { bevel: 2 }),
        ...shutters(0, w, 100, 2390, d - 20, bays, "laminate", {
          handle: "metal",
          handleStyle: "bar",
        }),
      ];
    },
  },
  {
    key: "wardrobeSliding",
    name: "Wardrobe, sliding shutters",
    category: "Bedroom",
    w: 2400,
    d: 680,
    h: 2400,
    price: 72000,
    unit: "perMetre",
    resize: "w",
    // sliding leaves need standing room only, not swing space
    wRange: [1500, 5000],
    clearance: 550,
    spec: "Sliding track, mirror on one leaf, no swing clearance needed",
    leadWeeks: 9,
    parts: (w, d) => [
      box(30, 40, 0, w - 30, d - 40, 90, "metalDark", { bevel: 0 }),
      box(0, 0, 90, w, d - 60, 2400, "laminate", { bevel: 2 }),
      // two overlapping leaves on a track
      box(0, d - 62, 100, w / 2 + 40, d - 32, 2390, "laminate", { bevel: 1.5 }),
      box(w / 2 - 40, d - 30, 100, w, d, 2390, "laminate", { bevel: 1.5 }),
      sheet(w / 2 + 20, d + 1, 400, w - 60, d + 1, 2100, "mirror", "y"),
      box(0, d - 70, 2390, w, d + 4, 2400, "metal", { bevel: 1 }),
    ],
  },
  {
    key: "dresser",
    name: "Dresser with mirror",
    category: "Bedroom",
    w: 1050,
    d: 480,
    h: 1750,
    price: 26000,
    unit: "each",
    clearance: 700,
    compatible: ["studyChair", "pouffe"],
    spec: "Four drawers with a frameless mirror above",
    leadWeeks: 7,
    parts: (w, d) => [
      box(30, 40, 0, w - 30, d - 20, 90, "metalDark", { bevel: 0 }),
      box(0, 0, 90, w, d, 760, "woodMid", { bevel: 2 }),
      slab(-10, -10, 760, w + 10, d + 10, 790, "marble", "eased"),
      ...drawers(0, w, 100, 750, d, 4, "woodMid", "brass"),
      box(w / 2 - 330, 0, 900, w / 2 + 330, 24, 1750, "woodDark", { mount: "wall", bevel: 2 }),
      sheet(w / 2 - 300, 26, 930, w / 2 + 300, 26, 1720, "mirror", "y", { mount: "wall" }),
      lathe(w - 180, d / 2, 790, 900, [
        [60, 0],
        [86, 0.55],
        [70, 1],
      ], "ceramic"),
    ],
  },
  {
    key: "bedBench",
    name: "Bench at the foot of the bed",
    category: "Bedroom",
    w: 1200,
    d: 420,
    h: 460,
    price: 16000,
    unit: "each",
    compatible: ["bedKing", "bedQueen", "rug"],
    leadWeeks: 5,
    parts: (w, d) => [
      ...legs4(w, d, 300, "brass", { inset: 60, r: 14, taper: 0.9 }),
      cushion(0, 0, 290, w, d, 460, "fabricAccent", 18, 40),
    ],
  },
  {
    key: "bunkBed",
    name: "Bunk bed",
    category: "Bedroom",
    w: 1050,
    d: 2080,
    h: 1750,
    price: 56000,
    unit: "each",
    clearance: 600,
    spec: "Solid frame with ladder and guard rail",
    leadWeeks: 8,
    parts: (w, d) => {
      const out: Part[] = [];
      for (const [z, pz] of [
        [320, 1],
        [1350, 2],
      ] as const) {
        out.push(box(40, 60, z - 60, w - 40, d - 60, z, "woodMid", { bevel: 2 }));
        out.push(cushion(50, 70, z, w - 50, d - 70, z + 180, "lacquer", 8, 20));
        out.push(...bedding(50, w - 50, 400, d - 70, z + 180, pz === 1 ? "fabricAlt" : "fabricAccent"));
        out.push(...pillows(w / 2, 100, z + 195, 1, "lacquer"));
      }
      // posts, guard rail and ladder
      for (const [x, y] of [
        [45, 65],
        [w - 45, 65],
        [45, d - 65],
        [w - 45, d - 65],
      ] as const) {
        out.push(box(x - 32, y - 32, 0, x + 32, y + 32, 1750, "woodMid", { bevel: 2 }));
      }
      out.push(box(60, 50, 1560, w - 60, 86, 1680, "woodMid", { bevel: 2 }));
      for (let i = 0; i < 4; i++) {
        out.push(box(w - 120, d - 140, 420 + i * 240, w - 40, d - 90, 460 + i * 240, "woodMid", { bevel: 2 }));
      }
      return out;
    },
  },
  {
    key: "kidsStorage",
    name: "Kids' toy storage",
    category: "Bedroom",
    w: 900,
    d: 400,
    h: 900,
    price: 18000,
    unit: "each",
    clearance: 500,
    leadWeeks: 6,
    parts: (w, d) => {
      const out: Part[] = [box(0, 0, 0, w, d, 900, "lacquer", { bevel: 2 })];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          const x = 20 + c * ((w - 40) / 3);
          const z = 40 + r * 420;
          out.push(
            box(x + 10, d - 20, z, x + (w - 40) / 3 - 10, d + 10, z + 360, "fabricAccent", {
              radius: 20,
            }),
          );
        }
      }
      return out;
    },
  },
];
