import type { CatalogItem, Mm, Part } from "../types.js";
import { ball, box, cushion, cyl, drawers, lathe, sheet, shutters, slab } from "./primitives.js";

/** Bathrooms and utility rooms: small, code-driven, and very visible on a quote. */

export const BATH: CatalogItem[] = [
  {
    key: "vanity",
    name: "Vanity with counter basin and mirror",
    category: "Bath",
    w: 900,
    d: 520,
    h: 1900,
    price: 32000,
    unit: "perMetre",
    resize: "w",
    wRange: [600, 2400],
    clearance: 700,
    compatible: ["wc"],
    spec: "Marine-ply carcass, laminate shutters, stone counter, counter-top basin",
    leadWeeks: 6,
    parts: (w, d) => [
      box(0, 0, 350, w, d, 830, "laminate", { bevel: 2 }),
      slab(0, 0, 830, w, d + 20, 870, "marble", "eased"),
      ...shutters(0, w, 360, 820, d, 2, "laminate", { handle: "chrome", handleStyle: "edge" }),
      // counter-top basin
      lathe(w / 2, d / 2, 870, 1010, [
        [185, 0],
        [200, 0.35],
        [196, 0.9],
        [186, 1],
      ], "ceramic"),
      cyl(w / 2, d / 2, 950, 1000, 160, "metalDark", { segments: 24, noShadow: true }),
      // wall mixer
      cyl(w / 2, 70, 870, 1130, 16, "chrome", { segments: 12, mount: "wall" }),
      box(w / 2 - 14, 70, 1100, w / 2 + 14, 230, 1130, "chrome", { radius: 12, mount: "wall" }),
      // mirror with a backlit edge
      box(w / 2 - 330, 0, 1230, w / 2 + 330, 22, 1900, "laminate", { mount: "wall", bevel: 2 }),
      sheet(w / 2 - 310, 24, 1250, w / 2 + 310, 24, 1880, "mirror", "y", { mount: "wall" }),
      box(w / 2 - 340, 0, 1220, w / 2 + 340, 18, 1236, "emissive", { mount: "wall", noShadow: true }),
    ],
    lights: (w) => [
      { x: w / 2, y: 120, z: 1560, intensity: 2.6, kelvin: 4000, distance: 2200, kind: "point" },
    ],
  },
  {
    key: "wc",
    name: "Wall-hung WC",
    category: "Bath",
    w: 400,
    d: 680,
    h: 850,
    price: 17500,
    unit: "each",
    clearance: 600,
    compatible: ["vanity"],
    spec: "Wall-hung pan with concealed cistern and dual flush plate",
    leadWeeks: 4,
    parts: (w, d) => [
      // concealed cistern wall
      box(0, 0, 0, w, 200, 850, "wall", { mount: "wall", bevel: 0 }),
      box(w / 2 - 110, 200, 640, w / 2 + 110, 212, 790, "chrome", { mount: "wall", radius: 8 }),
      // pan
      box(40, 180, 340, w - 40, d - 60, 420, "ceramic", { radius: 70 }),
      lathe(w / 2, 420, 340, 420, [
        [150, 0],
        [160, 0.5],
        [150, 1],
      ], "ceramic"),
      box(30, 170, 400, w - 30, d - 30, 430, "ceramic", { radius: 90 }),
      box(36, 176, 430, w - 36, d - 36, 444, "lacquer", { radius: 90 }),
      // health faucet
      cyl(w - 20, 230, 300, 330, 14, "chrome", { segments: 10, mount: "wall" }),
    ],
  },
  {
    key: "shower",
    name: "Shower area with glass partition",
    category: "Bath",
    w: 1200,
    d: 950,
    h: 2100,
    price: 42000,
    unit: "each",
    resize: "wd",
    // the tray is floor you step into, not an obstacle to walk around
    standIn: true,
    compatible: ["vanity", "wc", "towelRail", "bathtub"],
    spec: "Tiled shower tray, 10 mm toughened glass partition, overhead and hand shower",
    leadWeeks: 5,
    parts: (w, d) => [
      // tray and tile fall
      box(0, 0, 0, w, d, 40, "tile", { bevel: 0 }),
      cyl(w / 2, d / 2, 30, 44, 60, "chrome", { segments: 16, noShadow: true }),
      // partition: a fixed panel plus a slim post
      sheet(0, d - 20, 0, w * 0.62, d - 20, 2000, "glass", "y"),
      cyl(w * 0.62, d - 20, 0, 2000, 22, "chrome", { segments: 12 }),
      box(0, d - 30, 1990, w * 0.62, d - 8, 2010, "chrome", { bevel: 1 }),
      // overhead rain shower and mixer
      box(w / 2 - 140, 60, 2060, w / 2 + 140, 340, 2090, "chrome", { mount: "wall", radius: 10 }),
      cyl(w / 2, 90, 2090, 2100, 20, "chrome", { segments: 10, mount: "wall" }),
      box(w / 2 - 60, 0, 1050, w / 2 + 60, 80, 1250, "chrome", { mount: "wall", radius: 14 }),
      // niche
      box(140, 0, 1100, 500, 90, 1420, "tile", { mount: "wall", bevel: 0 }),
    ],
  },
  {
    key: "bathtub",
    name: "Freestanding bathtub",
    category: "Bath",
    w: 1700,
    d: 800,
    h: 580,
    price: 86000,
    unit: "each",
    clearance: 600,
    spec: "Acrylic freestanding tub with floor-mounted mixer",
    leadWeeks: 10,
    parts: (w, d) => [
      box(0, 0, 60, w, d, 580, "ceramic", { radius: 280, bevel: 4 }),
      box(70, 70, 420, w - 70, d - 70, 584, "lacquer", { radius: 240, noShadow: true }),
      cyl(w - 120, d / 2, 0, 900, 18, "chrome", { segments: 12 }),
      // the spout arm reaches back in over the tub from the riser
      box(w - 300, d / 2 - 16, 860, w - 140, d / 2 + 16, 896, "chrome", { radius: 14 }),
    ],
  },
  {
    key: "towelRail",
    name: "Heated towel rail",
    category: "Bath",
    w: 600,
    d: 110,
    h: 900,
    price: 12000,
    unit: "each",
    wallHung: true,
    leadWeeks: 4,
    parts: (w) => {
      const out: Part[] = [
        box(40, 0, 0, 70, 40, 900, "chrome", { mount: "wall", bevel: 1 }),
        box(w - 70, 0, 0, w - 40, 40, 900, "chrome", { mount: "wall", bevel: 1 }),
      ];
      for (let i = 0; i < 6; i++) {
        out.push(cyl(w / 2, 40, 80 + i * 150, 80 + i * 150, 14, "chrome", { segments: 8, mount: "wall" }));
        out.push(box(55, 26, 70 + i * 150, w - 55, 54, 98 + i * 150, "chrome", { mount: "wall", radius: 14 }));
      }
      out.push(cushion(90, 54, 320, w - 180, 120, 700, "fabricAlt", 10, 20));
      return out;
    },
  },
];

export const UTILITY: CatalogItem[] = [
  {
    key: "washer",
    name: "Washing machine",
    category: "Utility",
    w: 600,
    d: 620,
    h: 860,
    price: 0,
    unit: "clientSupplied",
    clearance: 600,
    spec: "Client supplied; needs a 15 A point and a floor drain within 1 m",
    parts: (w, d) => [
      box(0, 0, 0, w, d, 860, "lacquer", { radius: 8, bevel: 2 }),
      cyl(w / 2, d, 380, 380, 190, "metalDark", { segments: 28 }),
      box(w / 2 - 195, d, 185, w / 2 + 195, d + 24, 575, "glass", { radius: 190 }),
      box(20, d, 760, w - 20, d + 18, 840, "screen", { bevel: 1 }),
    ],
  },
  {
    key: "dryer",
    name: "Dryer, stacked",
    category: "Utility",
    w: 600,
    d: 620,
    h: 860,
    price: 0,
    unit: "clientSupplied",
    spec: "Client supplied; stacks over the washer on a bracket kit",
    parts: (w, d) => [
      box(0, 0, 0, w, d, 860, "lacquer", { radius: 8, bevel: 2 }),
      cyl(w / 2, d, 420, 420, 175, "metalDark", { segments: 28 }),
      box(w / 2 - 180, d, 240, w / 2 + 180, d + 22, 600, "glass", { radius: 175 }),
    ],
  },
  {
    key: "storageRack",
    name: "Utility storage rack",
    category: "Utility",
    w: 900,
    d: 420,
    h: 1900,
    price: 13500,
    unit: "each",
    resize: "w",
    wRange: [600, 2400],
    clearance: 400,
    spec: "Powder-coated steel frame with four ply shelves",
    leadWeeks: 3,
    parts: (w, d) => {
      const out: Part[] = [];
      for (const [x, y] of [
        [25, 25],
        [w - 25, 25],
        [25, d - 25],
        [w - 25, d - 25],
      ] as const) {
        out.push(box(x - 18, y - 18, 0, x + 18, y + 18, 1900, "metalDark", { bevel: 1 }));
      }
      for (let i = 0; i < 4; i++) {
        const z = 220 + i * 520;
        out.push(box(10, 10, z, w - 10, d - 10, z + 24, "woodLight", { bevel: 1 }));
      }
      return out;
    },
  },
  {
    key: "utilitySink",
    name: "Utility sink with counter",
    category: "Utility",
    w: 700,
    d: 500,
    h: 1200,
    price: 16000,
    unit: "each",
    clearance: 700,
    spec: "Granite counter with a deep single-bowl sink",
    leadWeeks: 5,
    parts: (w, d) => [
      box(60, 60, 0, w - 60, d - 40, 820, "stone", { bevel: 2 }),
      slab(0, 0, 820, w, d, 860, "stone", "square"),
      box(60, 80, 640, w - 60, d - 60, 824, "ceramic", { radius: 30 }),
      cyl(w / 2, 90, 860, 1180, 16, "chrome", { segments: 12, mount: "wall" }),
      box(w / 2 - 14, 90, 1150, w / 2 + 14, 260, 1182, "chrome", { radius: 12, mount: "wall" }),
    ],
  },
  {
    key: "ironingStation",
    name: "Fold-down ironing station",
    category: "Utility",
    w: 1200,
    d: 350,
    h: 1400,
    price: 14000,
    unit: "each",
    wallHung: true,
    clearance: 900,
    leadWeeks: 5,
    parts: (w, d) => [
      box(0, 0, 0, w, d, 1400, "laminate", { mount: "wall", bevel: 2 }),
      ...shutters(0, w, 10, 700, d, 2, "laminate", { handle: "metal", handleStyle: "edge" }).map(
        (p) => ({ ...p, mount: "wall" as const }),
      ),
      box(40, d, 860, w - 40, d + 24, 1360, "laminate", { mount: "wall", bevel: 1 }),
    ],
  },
];
