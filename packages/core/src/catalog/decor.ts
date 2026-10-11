import type { CatalogItem, Part } from "../types.js";
import { artwork, ball, box, curtains, cushion, cyl, lathe, pottedPlant, sheet } from "./primitives.js";

/**
 * Soft furnishing and decor. These items carry little cost but a great deal of
 * perceived value in a client presentation — an empty wall is what makes a
 * render look unfinished.
 */
export const DECOR: CatalogItem[] = [
  {
    key: "artPanel",
    name: "Framed artwork",
    category: "Decor",
    w: 900,
    d: 50,
    h: 700,
    price: 9000,
    unit: "each",
    wallHung: true,
    spec: "Print on canvas in a hardwood box frame",
    leadWeeks: 3,
    parts: (w, d, h) => artwork(0, w, 0, h, 0),
  },
  {
    key: "artTriptych",
    name: "Artwork, set of three",
    category: "Decor",
    w: 1800,
    d: 50,
    h: 700,
    price: 21000,
    unit: "each",
    wallHung: true,
    resize: "w",
    wRange: [1200, 3600],
    leadWeeks: 4,
    parts: (w, d, h) => {
      const out: Part[] = [];
      const gap = 80;
      const pw = (w - gap * 2) / 3;
      for (let i = 0; i < 3; i++) out.push(...artwork(i * (pw + gap), i * (pw + gap) + pw, 0, h, 0));
      return out;
    },
  },
  {
    key: "curtainPair",
    name: "Curtains with sheers",
    category: "Decor",
    w: 2100,
    d: 220,
    h: 2600,
    price: 2400,
    unit: "perSqm",
    wallHung: true,
    resize: "w",
    wRange: [900, 5000],
    spec: "Blackout curtain with a sheer behind, on a concealed track",
    leadWeeks: 4,
    parts: (w, d, h) => curtains(0, w, h, 0),
  },
  {
    key: "wallClock",
    name: "Wall clock",
    category: "Decor",
    w: 400,
    d: 60,
    h: 400,
    price: 4500,
    unit: "each",
    wallHung: true,
    leadWeeks: 2,
    parts: (w, d, h) => [
      cyl(w / 2, 0, h / 2, h / 2, w / 2, "woodDark", { segments: 32, mount: "wall" }),
      box(w / 2 - 10, 28, h / 2 - 10, w / 2 + 10, 40, h / 2 + 130, "metalDark", { mount: "wall", noShadow: true }),
      box(w / 2 - 8, 28, h / 2 - 8, w / 2 + 95, 40, h / 2 + 8, "metalDark", { mount: "wall", noShadow: true }),
    ],
  },
  {
    key: "sculpture",
    name: "Decorative sculpture",
    category: "Decor",
    w: 300,
    d: 300,
    h: 520,
    price: 8500,
    unit: "each",
    leadWeeks: 3,
    parts: (w, d) => [
      cyl(w / 2, d / 2, 0, 40, 120, "marble", { segments: 24 }),
      lathe(w / 2, d / 2, 40, 520, [
        [96, 0],
        [52, 0.3],
        [84, 0.62],
        [34, 0.9],
        [18, 1],
      ], "brass"),
    ],
  },
  {
    key: "barCart",
    name: "Bar cart",
    category: "Decor",
    w: 760,
    d: 420,
    h: 820,
    price: 16500,
    unit: "each",
    leadWeeks: 5,
    parts: (w, d) => {
      const out: Part[] = [];
      for (const [x, y] of [
        [45, 45],
        [w - 45, 45],
        [45, d - 45],
        [w - 45, d - 45],
      ] as const) {
        out.push(cyl(x, y, 70, 800, 16, "brass", { segments: 10 }));
        out.push(cyl(x, y, 0, 70, 44, "metalDark", { segments: 12 }));
      }
      out.push(box(20, 20, 260, w - 20, d - 20, 278, "glass", { bevel: 1 }));
      out.push(box(20, 20, 790, w - 20, d - 20, 812, "glass", { bevel: 1 }));
      // bottles and glasses
      for (let i = 0; i < 4; i++) {
        out.push(
          lathe(100 + i * 100, d / 2, 812, 1090, [
            [38, 0],
            [40, 0.6],
            [14, 0.78],
            [13, 1],
          ], i % 2 ? "glass" : "ceramic"),
        );
      }
      return out;
    },
  },
  {
    key: "fullHeightPlant",
    name: "Statement indoor tree",
    category: "Decor",
    w: 900,
    d: 900,
    h: 2200,
    price: 12000,
    unit: "each",
    spec: "Live ficus or artificial equivalent in a glazed planter",
    leadWeeks: 2,
    parts: (w, d) => pottedPlant(w / 2, d / 2, 520, 900, 2200),
  },
  {
    key: "rugRunner",
    name: "Runner rug",
    category: "Decor",
    w: 2000,
    d: 700,
    h: 12,
    price: 6000,
    unit: "perSqm",
    flat: true,
    resize: "wd",
    leadWeeks: 3,
    parts: (w, d) => [box(0, 0, 0, w, d, 12, "rug", { bevel: 0, noShadow: true })],
  },
  {
    key: "poojaUnit",
    name: "Pooja unit",
    category: "Decor",
    w: 900,
    d: 450,
    h: 2100,
    price: 48000,
    unit: "each",
    clearance: 900,
    spec: "Carved teak frame with marble base, jaali doors and concealed lighting",
    leadWeeks: 9,
    parts: (w, d) => {
      const out: Part[] = [
        box(0, 0, 0, w, d, 760, "woodDark", { bevel: 2 }),
        box(-20, -20, 760, w + 20, d, 800, "marble", { bevel: 2 }),
        box(0, 0, 800, w, d - 100, 2100, "woodDark", { bevel: 2 }),
        box(60, 40, 860, w - 60, d - 140, 1900, "marble", { bevel: 1 }),
        // jaali screen panels either side
        box(-60, 0, 800, 0, d - 100, 2100, "woodMid", { bevel: 2 }),
        box(w, 0, 800, w + 60, d - 100, 2100, "woodMid", { bevel: 2 }),
        box(20, 20, 2060, w - 20, d - 80, 2100, "emissive", { noShadow: true }),
      ];
      // diya lamps on the marble shelf
      for (const x of [160, w - 160]) {
        out.push(
          lathe(x, d / 2 - 60, 800, 880, [
            [54, 0],
            [66, 0.6],
            [58, 1],
          ], "brass"),
        );
        out.push(ball(x, d / 2 - 60, 900, 24, "emissive", 1, true));
      }
      return out;
    },
    lights: (w, d) => [
      { x: w / 2, y: d / 2 - 60, z: 1200, intensity: 3.2, kelvin: 2600, distance: 2600, kind: "point" },
    ],
  },
  {
    key: "swing",
    name: "Indoor swing (jhoola)",
    category: "Decor",
    w: 1500,
    d: 700,
    h: 2400,
    price: 54000,
    unit: "each",
    clearance: 700,
    spec: "Teak seat on brass chains, ceiling-fixed",
    leadWeeks: 8,
    parts: (w, d) => {
      const out: Part[] = [];
      for (const x of [140, w - 140]) {
        for (const y of [120, d - 120]) {
          out.push(cyl(x, y, 520, 2400, 9, "brass", { segments: 6, mount: "wall" }));
        }
      }
      out.push(box(0, 0, 440, w, d, 490, "woodDark", { bevel: 3 }));
      out.push(cushion(30, 30, 490, w - 30, d - 30, 580, "fabricAccent", 16, 30));
      out.push(box(0, 0, 580, w, 110, 1080, "woodDark", { bevel: 3 }));
      out.push(cushion(40, 100, 620, w - 40, 170, 1020, "fabric", 18, 30));
      return out;
    },
  },
];
