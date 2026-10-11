import type { CatalogItem, Part } from "../types.js";
import { artwork, ball, box, cushion, cyl, drawers, lathe, legs4, shelfRun, slab } from "./primitives.js";

export const STUDY: CatalogItem[] = [
  {
    key: "desk",
    name: "Study desk",
    category: "Study",
    w: 1350,
    d: 650,
    h: 760,
    price: 22000,
    unit: "each",
    clearance: 750,
    compatible: ["studyChair", "rug"],
    spec: "Veneer top on a powder-coated steel frame, cable tray",
    leadWeeks: 6,
    parts: (w, d) => [
      // steel A-frame legs
      box(50, 60, 0, 78, d - 60, 720, "metalDark", { bevel: 1 }),
      box(w - 78, 60, 0, w - 50, d - 60, 720, "metalDark", { bevel: 1 }),
      box(50, 60, 0, 78 + 120, 88, 26, "metalDark", { bevel: 1 }),
      box(w - 198, 60, 0, w - 50, 88, 26, "metalDark", { bevel: 1 }),
      box(78, d / 2 - 22, 600, w - 78, d / 2 + 22, 640, "metalDark", { bevel: 1 }),
      slab(0, 0, 720, w, d, 760, "woodMid", "eased"),
      // monitor, keyboard and a lamp
      cyl(w / 2, 150, 760, 790, 90, "metalDark", { segments: 20 }),
      box(w / 2 - 30, 130, 790, w / 2 + 30, 170, 980, "metalDark", { bevel: 2 }),
      box(w / 2 - 320, 150, 980, w / 2 + 320, 172, 1340, "screen", { bevel: 1 }),
      box(w / 2 - 328, 142, 972, w / 2 + 328, 152, 1348, "metalDark", { bevel: 1 }),
      box(w / 2 - 200, 300, 760, w / 2 + 200, 450, 780, "metalDark", { radius: 6 }),
      cyl(140, 180, 760, 1080, 14, "brass", { segments: 10 }),
      lathe(140, 180, 1080, 1180, [
        [110, 1],
        [120, 0.3],
        [116, 0],
      ], "brass"),
      ball(140, 180, 1110, 40, "emissive", 1, true),
    ],
    lights: () => [{ x: 140, y: 180, z: 1100, intensity: 2.4, kelvin: 4000, distance: 2000, kind: "point" }],
  },
  {
    key: "studyChair",
    name: "Task chair",
    category: "Study",
    w: 620,
    d: 620,
    h: 1050,
    price: 14000,
    unit: "each",
    compatible: ["desk", "dresser", "rug"],
    spec: "Mesh back, gas lift, castors",
    leadWeeks: 4,
    parts: (w, d) => {
      const out: Part[] = [
        cyl(w / 2, d / 2, 60, 440, 34, "metalDark", { segments: 14 }),
        cyl(w / 2, d / 2, 440, 470, 110, "metalDark", { segments: 20 }),
      ];
      // five-star base with castors
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const ex = w / 2 + Math.cos(a) * 250;
        const ey = d / 2 + Math.sin(a) * 250;
        out.push(cyl(ex, ey, 40, 70, 26, "metalDark", { segments: 8 }));
        out.push(cyl(ex, ey, 0, 50, 32, "metalDark", { segments: 10 }));
        out.push(
          box(
            Math.min(w / 2, ex) - 20,
            Math.min(d / 2, ey) - 20,
            50,
            Math.max(w / 2, ex) + 20,
            Math.max(d / 2, ey) + 20,
            74,
            "metalDark",
            { bevel: 1, noShadow: true },
          ),
        );
      }
      out.push(cushion(60, 60, 470, w - 60, d - 60, 540, "fabric", 14, 50));
      out.push(box(110, 70, 540, w - 110, 130, 1030, "fabricAlt", { radius: 80 }));
      out.push(box(80, 110, 620, 120, 200, 680, "metalDark", { radius: 16 }));
      out.push(box(w - 120, 110, 620, w - 80, 200, 680, "metalDark", { radius: 16 }));
      return out;
    },
  },
  {
    key: "studyUnit",
    name: "Study wall unit",
    category: "Study",
    w: 1800,
    d: 400,
    h: 2250,
    price: 52000,
    unit: "perMetre",
    resize: "w",
    wRange: [900, 4200],
    clearance: 700,
    spec: "Base drawers with open shelving and closed upper storage above",
    leadWeeks: 8,
    parts: (w, d) => [
      box(30, 40, 0, w - 30, d - 20, 100, "metalDark", { bevel: 0 }),
      box(0, 0, 100, w, d, 760, "laminate", { bevel: 2 }),
      slab(0, 0, 760, w, d + 20, 790, "woodMid", "eased"),
      ...drawers(0, w, 110, 750, d, 3, "laminate", "metal"),
      ...shelfRun(w, d - 80, 790, 1700, "woodMid", 2, { books: true, back: true }),
      box(0, 0, 1700, w, d - 80, 2250, "laminate", { bevel: 2 }),
    ],
  },
  {
    key: "filingCabinet",
    name: "Filing cabinet",
    category: "Study",
    w: 450,
    d: 550,
    h: 700,
    price: 11000,
    unit: "each",
    clearance: 600,
    leadWeeks: 5,
    parts: (w, d) => [
      box(0, 0, 60, w, d, 700, "metalDark", { bevel: 2 }),
      ...drawers(0, w, 70, 690, d, 3, "metalDark", "chrome"),
    ],
  },
  {
    key: "meetingTable",
    name: "Round meeting table",
    category: "Study",
    w: 1100,
    d: 1100,
    h: 740,
    price: 28000,
    unit: "each",
    compatible: ["studyChair", "diningChair", "rug"],
    leadWeeks: 6,
    parts: (w, d) => [
      cyl(w / 2, d / 2, 0, 24, 260, "metalDark", { segments: 32 }),
      cyl(w / 2, d / 2, 24, 700, 55, "metalDark", { segments: 16 }),
      cyl(w / 2, d / 2, 700, 740, w / 2, "woodMid", { segments: 48 }),
    ],
  },
];
