import type { CatalogItem, Mm, Part } from "../types.js";
import {
  artwork,
  ball,
  box,
  cushion,
  cyl,
  lathe,
  legs4,
  pottedPlant,
  scatter,
  sheet,
  shelfRun,
  slab,
} from "./primitives.js";

/**
 * A sofa built the way a sofa is actually built: a frame on legs, an
 * upholstered shell, separate seat and back cushions with a gap you can see
 * into, and rolled arms. The separate cushions are what sell it — a single
 * box reads as a kerb.
 */
function sofaParts(seats: number) {
  return (w: Mm, d: Mm): Part[] => {
    const armW = Math.min(195, w * 0.12);
    const seatZ = 330;
    const backTop = 760;
    const out: Part[] = [
      ...legs4(w, d, 145, "woodDark", { inset: 95, r: 20, taper: 0.62 }),
      // frame
      box(0, 55, 130, w, d - 25, seatZ, "fabric", { radius: 18 }),
      // arms, rolled
      box(0, 10, 130, armW, d, 650, "fabric", { radius: 80 }),
      box(w - armW, 10, 130, w, d, 650, "fabric", { radius: 80 }),
      // back shell
      box(armW - 10, 10, 130, w - armW + 10, 205, backTop, "fabric", { radius: 40 }),
    ];
    const innerW = w - 2 * armW;
    const seatW = innerW / seats;
    for (let i = 0; i < seats; i++) {
      const a = armW + i * seatW;
      out.push(cushion(a + 8, 200, seatZ, a + seatW - 8, d - 45, seatZ + 160, "fabric", 16, 34));
      out.push(
        cushion(a + 14, 110, seatZ + 150, a + seatW - 14, 230, backTop - 40, "fabricAlt", 22, 40),
      );
    }
    const cushionSpots: Array<[Mm, Mm]> =
      seats >= 3
        ? [
            [armW + 150, 300],
            [w - armW - 150, 300],
          ]
        : [[w / 2, 300]];
    out.push(...scatter(cushionSpots, seatZ + 140, "fabricAccent", 250));
    return out;
  };
}

export const LIVING: CatalogItem[] = [
  {
    key: "sofa3",
    name: "3-seater sofa",
    category: "Living",
    w: 2100,
    d: 900,
    h: 800,
    price: 62000,
    unit: "each",
    clearance: 400,
    compatible: ["coffee", "rug", "sideTable", "pouffe"],
    spec: "Hardwood frame, high-resilience foam, removable covers",
    leadWeeks: 6,
    parts: sofaParts(3),
  },
  {
    key: "sofa2",
    name: "2-seater sofa",
    category: "Living",
    w: 1550,
    d: 880,
    h: 800,
    price: 46000,
    unit: "each",
    clearance: 400,
    compatible: ["coffee", "rug", "sideTable", "pouffe"],
    spec: "Hardwood frame, high-resilience foam",
    leadWeeks: 6,
    parts: sofaParts(2),
  },
  {
    key: "sofaL",
    name: "L-shaped sofa",
    category: "Living",
    w: 2700,
    d: 1750,
    h: 800,
    price: 96000,
    unit: "each",
    compatible: ["coffee", "rug", "sideTable", "pouffe"],
    spec: "Chaise to the right as drawn; mirror on site if required",
    leadWeeks: 8,
    parts: (w, d) => {
      const armW = 190;
      const seatZ = 330;
      const mainD = 900;
      const out: Part[] = [
        ...legs4(w, mainD, 145, "woodDark", { inset: 95, r: 20, taper: 0.62 }),
        // two extra legs under the chaise return
        cyl(w - 805, d - 95, 0, 145, 20, "woodDark", { r1: 12, segments: 12 }),
        cyl(w - 95, d - 95, 0, 145, 20, "woodDark", { r1: 12, segments: 12 }),
        box(0, 55, 130, w, mainD - 25, seatZ, "fabric", { radius: 18 }),
        box(w - 900, mainD - 25, 130, w, d - 25, seatZ, "fabric", { radius: 18 }),
        box(0, 10, 130, armW, mainD, 650, "fabric", { radius: 80 }),
        box(armW - 10, 10, 130, w - 10, 205, 760, "fabric", { radius: 40 }),
        box(w - armW, 205, 130, w, d, 650, "fabric", { radius: 80 }),
      ];
      // three seat cushions on the long run, one long chaise pad
      const innerW = w - armW - 900;
      for (let i = 0; i < 2; i++) {
        const a = armW + (innerW / 2) * i;
        out.push(cushion(a + 8, 200, seatZ, a + innerW / 2 - 8, mainD - 45, seatZ + 160, "fabric", 16, 34));
        out.push(
          cushion(a + 14, 110, seatZ + 150, a + innerW / 2 - 14, 230, 720, "fabricAlt", 22, 40),
        );
      }
      out.push(cushion(w - 890, 200, seatZ, w - armW - 10, d - 45, seatZ + 160, "fabric", 16, 34));
      out.push(...scatter([[armW + 200, 300], [w - 500, 420]], seatZ + 140, "fabricAccent", 250));
      return out;
    },
  },
  {
    key: "armchair",
    name: "Accent armchair",
    category: "Living",
    w: 820,
    d: 840,
    h: 820,
    price: 18500,
    unit: "each",
    clearance: 350,
    compatible: ["rug", "sideTable"],
    spec: "Bouclé or leather upholstery, solid wood splayed legs",
    leadWeeks: 5,
    parts: (w, d) => [
      ...legs4(w, d, 160, "woodMid", { inset: 95, r: 18, taper: 0.6 }),
      box(30, 60, 145, w - 30, d - 40, 340, "fabric", { radius: 30 }),
      box(0, 30, 145, 130, d, 620, "fabric", { radius: 60 }),
      box(w - 130, 30, 145, w, d, 620, "fabric", { radius: 60 }),
      box(100, 20, 145, w - 100, 190, 800, "fabric", { radius: 70 }),
      cushion(120, 180, 340, w - 120, d - 55, 480, "fabric", 16, 30),
      cushion(130, 100, 470, w - 130, 215, 740, "fabricAlt", 20, 36),
    ],
  },
  {
    key: "pouffe",
    name: "Upholstered pouffe",
    category: "Living",
    w: 520,
    d: 520,
    h: 400,
    price: 7500,
    unit: "each",
    compatible: ["rug", "coffee"],
    leadWeeks: 4,
    parts: (w, d) => [
      lathe(w / 2, d / 2, 0, 390, [
        [w * 0.4, 0],
        [w * 0.48, 0.3],
        [w * 0.49, 0.78],
        [w * 0.42, 1],
      ], "fabricAccent"),
    ],
  },
  {
    key: "coffee",
    name: "Coffee table",
    category: "Living",
    w: 1150,
    d: 620,
    h: 400,
    price: 14000,
    unit: "each",
    // a coffee table is meant to be within reach of the seating around it
    compatible: ["rug", "sofa3", "sofa2", "sofaL", "pouffe", "armchair", "sideTable"],
    spec: "Veneered top on a powder-coated steel frame",
    leadWeeks: 5,
    parts: (w, d) => [
      // steel frame
      box(55, 55, 0, 75, d - 55, 370, "metalDark", { bevel: 1 }),
      box(w - 75, 55, 0, w - 55, d - 55, 370, "metalDark", { bevel: 1 }),
      box(55, 55, 0, w - 55, 75, 24, "metalDark", { bevel: 1 }),
      box(55, d - 75, 0, w - 55, d - 55, 24, "metalDark", { bevel: 1 }),
      // lower shelf and top
      slab(90, 80, 150, w - 90, d - 80, 166, "woodMid", "eased"),
      slab(0, 0, 370, w, d, 400, "woodMid", "bullnose"),
      // a tray and a bowl, because an empty table reads as unfinished
      box(w / 2 - 170, d / 2 - 110, 400, w / 2 + 170, d / 2 + 110, 414, "brass", { bevel: 1 }),
      lathe(w / 2 + 240, d / 2, 400, 470, [
        [60, 0],
        [95, 0.6],
        [92, 1],
      ], "ceramic"),
    ],
  },
  {
    key: "sideTable",
    name: "Side table",
    category: "Living",
    w: 420,
    d: 420,
    h: 550,
    price: 8500,
    unit: "each",
    compatible: ["sofa3", "sofa2", "sofaL", "armchair", "rug", "coffee"],
    leadWeeks: 4,
    parts: (w, d) => [
      cyl(w / 2, d / 2, 0, 24, 150, "metalDark", { segments: 20 }),
      cyl(w / 2, d / 2, 24, 520, 26, "metalDark", { segments: 12 }),
      slab(0, 0, 520, w, d, 550, "marble", "bullnose"),
    ],
  },
  {
    key: "tvUnit",
    name: "TV unit with floating console",
    category: "Living",
    w: 2400,
    d: 450,
    h: 1500,
    price: 42000,
    unit: "perMetre",
    resize: "w",
    wRange: [1200, 4800],
    clearance: 500,
    spec: "18 mm BWP ply carcass, laminate finish, soft-close drawers",
    leadWeeks: 7,
    parts: (w) => {
      const panelW = Math.min(w, 2400);
      const px = (w - panelW) / 2;
      const tvW = Math.min(1500, panelW - 300);
      const out: Part[] = [
        // back panel, fluted
        box(px, 0, 150, px + panelW, 42, 1500, "woodDark", { bevel: 2 }),
        // floating console
        box(80, 30, 420, w - 80, 420, 760, "laminate", { radius: 6 }),
        box(80, 420, 428, w - 80, 446, 752, "laminate", { bevel: 1 }),
        // screen
        box((w - tvW) / 2, 44, 880, (w + tvW) / 2, 70, 880 + tvW * 0.5625, "screen", { bevel: 1 }),
        box((w - tvW) / 2 - 8, 42, 872, (w + tvW) / 2 + 8, 52, 888 + tvW * 0.5625, "metalDark"),
        // soundbar and props
        box(w / 2 - 350, 110, 780, w / 2 + 350, 200, 850, "metalDark", { radius: 20 }),
        lathe(px + 160, 250, 760, 940, [
          [48, 0],
          [78, 0.45],
          [52, 1],
        ], "ceramic"),
      ];
      // vertical flutes on the back panel
      for (let x = px + 60; x < px + panelW - 40; x += 120) {
        out.push(box(x, 42, 160, x + 60, 62, 1490, "woodDark", { radius: 28, noShadow: true }));
      }
      return out;
    },
  },
  {
    key: "console",
    name: "Console table",
    category: "Living",
    w: 1200,
    d: 350,
    h: 800,
    price: 16000,
    unit: "each",
    clearance: 350,
    leadWeeks: 5,
    parts: (w, d) => [
      ...legs4(w, d, 770, "woodDark", { inset: 55, r: 24, taper: 0.8 }),
      box(70, 40, 300, w - 70, d - 20, 318, "woodDark"),
      slab(0, 0, 770, w, d, 800, "woodDark", "eased"),
      ...artwork(w / 2 - 320, w / 2 + 320, 1050, 1750, 0),
    ],
  },
  {
    key: "shoeCabinet",
    name: "Shoe cabinet",
    category: "Living",
    w: 1000,
    d: 380,
    h: 1050,
    price: 15500,
    unit: "each",
    clearance: 600,
    spec: "Ventilated shutters, three internal shelves",
    leadWeeks: 6,
    parts: (w, d) => {
      const out: Part[] = [box(0, 0, 90, w, d, 1050, "laminate", { bevel: 2 })];
      out.push(box(28, 28, 0, w - 28, d - 10, 90, "metalDark", { bevel: 0 }));
      for (let i = 0; i < 2; i++) {
        const a = i * (w / 2);
        out.push(box(a + 4, d, 96, a + w / 2 - 4, d + 18, 1044, "laminate", { bevel: 1.5 }));
        out.push(box(a + 40, d + 18, 560, a + w / 2 - 40, d + 26, 574, "brass"));
      }
      return out;
    },
  },
  {
    key: "bookshelf",
    name: "Open bookshelf",
    category: "Living",
    w: 900,
    d: 350,
    h: 1950,
    price: 23000,
    unit: "each",
    clearance: 500,
    resize: "w",
    wRange: [600, 2400],
    spec: "Ply carcass with veneer, five open bays",
    leadWeeks: 6,
    parts: (w, d) => shelfRun(w, d, 0, 1950, "woodMid", 5, { books: true }),
  },
  {
    key: "rug",
    name: "Area rug",
    category: "Living",
    w: 2400,
    d: 1700,
    h: 14,
    price: 11000,
    unit: "perSqm",
    flat: true,
    resize: "wd",
    spec: "Hand-tufted wool, 14 mm pile",
    leadWeeks: 4,
    parts: (w, d) => [
      box(0, 0, 0, w, d, 14, "rug", { bevel: 0, noShadow: true }),
      // a visible bound border reads as a rug rather than a painted rectangle
      box(0, 0, 14, w, 60, 17, "rug", { bevel: 0, noShadow: true }),
      box(0, d - 60, 14, w, d, 17, "rug", { bevel: 0, noShadow: true }),
      box(0, 0, 14, 60, d, 17, "rug", { bevel: 0, noShadow: true }),
      box(w - 60, 0, 14, w, d, 17, "rug", { bevel: 0, noShadow: true }),
    ],
  },
  {
    key: "planter",
    name: "Floor planter",
    // styling rather than furniture: it belongs in the corner beside the
    // joinery, so it must not be measured as an obstruction
    category: "Decor",
    w: 480,
    d: 480,
    h: 1500,
    price: 4200,
    unit: "each",
    spec: "Terracotta pot, live or artificial foliage",
    leadWeeks: 1,
    parts: (w, d) => pottedPlant(w / 2, d / 2, 420, 620, 1500),
  },
  {
    key: "mirrorPanel",
    name: "Decorative wall mirror",
    category: "Living",
    w: 900,
    d: 40,
    h: 1600,
    price: 18000,
    unit: "each",
    wallHung: true,
    spec: "6 mm bevelled mirror on ply backing, brass trim",
    leadWeeks: 4,
    parts: (w, d) => [
      box(0, 0, 0, w, 24, 1600, "woodDark", { mount: "wall", bevel: 2 }),
      box(-14, 0, -14, w + 14, 20, 1614, "brass", { mount: "wall", bevel: 1 }),
      sheet(30, 25, 30, w - 30, 25, 1570, "mirror", "y", { mount: "wall" }),
    ],
  },
];
