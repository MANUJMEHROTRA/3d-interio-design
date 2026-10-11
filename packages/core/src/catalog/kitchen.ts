import type { CatalogItem, Mm, Part } from "../types.js";
import { ball, box, cyl, drawers, lathe, shutters, slab } from "./primitives.js";

const COUNTER_H: Mm = 900;
const COUNTER_D: Mm = 600;
const BACKSPLASH_TO: Mm = 1500;
const WALL_UNIT_BOTTOM: Mm = 1500;
const WALL_UNIT_TOP: Mm = 2250;

/**
 * A kitchen run is the single most-quoted item in an Indian fit-out, so it is
 * modelled properly: recessed plinth, carcass, drawer and shutter fronts with
 * shadow gaps, a stone counter with an eased edge and an upstand, tiled
 * backsplash, and wall cabinets above.
 */
function counterRun(opts: { wall: boolean; tall?: boolean }) {
  return (w: Mm, d: Mm): Part[] => {
    const out: Part[] = [
      // plinth, set back so the run appears to float a little
      box(30, 40, 0, w - 30, d - 20, 110, "metalDark", { bevel: 0 }),
      // carcass
      box(0, 0, 110, w, d - 30, COUNTER_H - 40, "laminate", { bevel: 2 }),
      // counter with upstand against the wall
      slab(0, 0, COUNTER_H - 40, w, d, COUNTER_H, "quartz", "eased"),
      box(0, 0, COUNTER_H, w, 24, COUNTER_H + 70, "quartz", { bevel: 2 }),
      // tiled backsplash
      box(0, 0, COUNTER_H + 60, w, 16, BACKSPLASH_TO, "tile", { bevel: 0, mount: "wall" }),
    ];

    // fronts: alternate a drawer bank and a pair of shutters along the run
    let x = 0;
    let bank = 0;
    while (x < w - 60) {
      const segW = Math.min(w - x, bank % 2 === 0 ? 900 : 600);
      if (bank % 2 === 0) {
        out.push(...drawers(x, x + segW, 120, COUNTER_H - 45, d - 30, 3, "laminate", "metal"));
      } else {
        out.push(
          ...shutters(x, x + segW, 120, COUNTER_H - 45, d - 30, 1, "laminate", {
            handle: "metal",
            handleStyle: "bar",
          }),
        );
      }
      x += segW;
      bank++;
    }

    if (opts.wall) {
      const bays = Math.max(1, Math.round(w / 600));
      out.push(
        box(0, 0, WALL_UNIT_BOTTOM, w, 350, WALL_UNIT_TOP, "laminate", { bevel: 2, mount: "wall" }),
      );
      out.push(
        ...shutters(0, w, WALL_UNIT_BOTTOM + 8, WALL_UNIT_TOP - 8, 350, bays, "lacquer", {
          handle: "metal",
          handleStyle: "edge",
        }).map((p) => ({ ...p, mount: "wall" as const })),
      );
      // under-cabinet light strip: the detail that makes a kitchen render read as real
      out.push(
        box(40, 60, WALL_UNIT_BOTTOM - 22, w - 40, 300, WALL_UNIT_BOTTOM - 6, "emissive", {
          mount: "wall",
          noShadow: true,
        }),
      );
    }
    return out;
  };
}

export const KITCHEN: CatalogItem[] = [
  {
    key: "counterRun",
    name: "Kitchen run, base and wall units",
    category: "Kitchen",
    w: 2400,
    d: COUNTER_D,
    h: WALL_UNIT_TOP,
    price: 34000,
    unit: "perMetre",
    resize: "w",
    wRange: [600, 6000],
    clearance: 1000,
    compatible: ["counterRun", "fridge", "sink", "hob", "dishwasher", "tallUnit"],
    spec: "BWP ply carcass, acrylic shutters, quartz counter, soft-close hardware",
    leadWeeks: 8,
    parts: counterRun({ wall: true }),
  },
  {
    key: "counterBase",
    name: "Kitchen base run only",
    category: "Kitchen",
    w: 1800,
    d: COUNTER_D,
    h: COUNTER_H + 70,
    price: 24000,
    unit: "perMetre",
    resize: "w",
    wRange: [600, 6000],
    clearance: 1000,
    compatible: ["counterRun", "counterBase", "fridge", "sink", "hob", "dishwasher"],
    spec: "BWP ply carcass, acrylic shutters, quartz counter",
    leadWeeks: 8,
    parts: counterRun({ wall: false }),
  },
  {
    key: "island",
    name: "Kitchen island with breakfast overhang",
    category: "Kitchen",
    w: 2000,
    d: 1000,
    h: 920,
    price: 58000,
    unit: "perMetre",
    resize: "w",
    wRange: [1200, 4000],
    clearance: 1000,
    compatible: ["barStool"],
    spec: "Island carcass with 300 mm counter overhang for seating",
    leadWeeks: 9,
    parts: (w, d) => [
      box(30, 30, 0, w - 30, d - 330, 110, "metalDark", { bevel: 0 }),
      box(0, 0, 110, w, d - 300, 880, "laminate", { bevel: 2 }),
      slab(-20, -20, 880, w + 20, d, 920, "marble", "eased"),
      ...drawers(0, w / 2, 120, 860, d - 300, 3, "laminate", "brass"),
      ...shutters(w / 2, w, 120, 860, d - 300, 2, "laminate", { handle: "brass", handleStyle: "bar" }),
    ],
  },
  {
    key: "tallUnit",
    name: "Tall pantry unit",
    category: "Kitchen",
    w: 600,
    d: 600,
    h: 2250,
    price: 46000,
    unit: "each",
    clearance: 900,
    compatible: ["counterRun", "counterBase"],
    spec: "Full-height pantry with pull-out baskets",
    leadWeeks: 8,
    parts: (w, d) => [
      box(30, 40, 0, w - 30, d - 20, 110, "metalDark", { bevel: 0 }),
      box(0, 0, 110, w, d - 20, 2250, "laminate", { bevel: 2 }),
      ...shutters(0, w, 120, 1180, d - 20, 1, "laminate", { handle: "metal" }),
      ...shutters(0, w, 1190, 2240, d - 20, 1, "laminate", { handle: "metal" }),
    ],
  },
  {
    key: "sink",
    name: "Sink with mixer tap",
    category: "Kitchen",
    w: 800,
    d: 500,
    h: 1050,
    price: 18500,
    unit: "each",
    compatible: ["counterRun", "counterBase", "island"],
    spec: "Single-bowl stainless sink, undermount, pull-out mixer",
    leadWeeks: 3,
    parts: (w, d) => [
      box(40, 60, 820, w - 40, d - 40, 900, "metal", { radius: 24 }),
      box(60, 80, 830, w - 60, d - 60, 902, "metalDark", { radius: 20, noShadow: true }),
      cyl(w / 2, 120, 900, 1210, 18, "chrome", { segments: 14 }),
      box(w / 2 - 16, 120, 1180, w / 2 + 16, 320, 1214, "chrome", { radius: 14 }),
      lathe(w - 150, 150, 900, 1010, [
        [34, 0],
        [26, 0.8],
        [30, 1],
      ], "chrome"),
    ],
  },
  {
    key: "hob",
    name: "Hob with chimney",
    category: "Kitchen",
    w: 900,
    d: 550,
    h: 2300,
    price: 46000,
    unit: "each",
    compatible: ["counterRun", "counterBase", "island"],
    spec: "4-burner glass hob, 90 cm auto-clean chimney",
    leadWeeks: 3,
    parts: (w, d) => {
      const out: Part[] = [
        box(30, 60, 898, w - 30, d - 30, 912, "screen", { bevel: 1 }),
      ];
      // burners
      for (const [bx, by] of [
        [0.27, 0.35],
        [0.73, 0.35],
        [0.27, 0.72],
        [0.73, 0.72],
      ] as const) {
        out.push(cyl(w * bx, 60 + (d - 90) * by, 912, 926, 62, "metalDark", { segments: 18 }));
        out.push(cyl(w * bx, 60 + (d - 90) * by, 926, 936, 44, "metalDark", { segments: 14 }));
      }
      // chimney hood
      out.push(box(0, 0, 1550, w, d - 60, 1700, "metal", { bevel: 3, mount: "wall" }));
      out.push(box(20, 20, 1530, w - 20, d - 80, 1556, "screen", { bevel: 1, mount: "wall" }));
      out.push(box(w / 2 - 130, 40, 1700, w / 2 + 130, 320, 2300, "metal", { bevel: 2, mount: "wall" }));
      return out;
    },
  },
  {
    key: "fridge",
    name: "Refrigerator",
    category: "Kitchen",
    w: 750,
    d: 720,
    h: 1850,
    price: 0,
    unit: "clientSupplied",
    clearance: 900,
    compatible: ["counterRun", "counterBase", "tallUnit"],
    spec: "Client supplied; 750 × 720 mm niche with 50 mm rear clearance",
    parts: (w, d) => [
      box(0, 0, 0, w, d, 1850, "metal", { radius: 10, bevel: 2 }),
      box(4, d, 520, w - 4, d + 22, 1846, "metal", { radius: 8 }),
      box(4, d, 6, w - 4, d + 22, 508, "metal", { radius: 8 }),
      box(w - 90, d + 22, 620, w - 60, d + 46, 1700, "chrome", { radius: 12 }),
      box(w - 90, d + 22, 90, w - 60, d + 46, 430, "chrome", { radius: 12 }),
    ],
  },
  {
    key: "dishwasher",
    name: "Dishwasher, built under",
    category: "Kitchen",
    w: 600,
    d: 600,
    h: 850,
    price: 0,
    unit: "clientSupplied",
    clearance: 900,
    compatible: ["counterRun", "counterBase"],
    spec: "Client supplied; integrated front to match shutters",
    parts: (w, d) => [
      box(0, 0, 110, w, d - 30, 860, "laminate", { bevel: 2 }),
      box(6, d - 30, 120, w - 6, d - 12, 850, "laminate", { bevel: 1 }),
      box(40, d - 12, 790, w - 40, d - 2, 806, "metal"),
    ],
  },
  {
    key: "breakfastCounter",
    name: "Breakfast counter",
    category: "Kitchen",
    w: 1500,
    d: 450,
    h: 1050,
    price: 26000,
    unit: "perMetre",
    resize: "w",
    wRange: [900, 3000],
    clearance: 900,
    compatible: ["barStool"],
    spec: "Cantilevered stone counter on a half-height dwarf wall",
    leadWeeks: 6,
    parts: (w, d) => [
      box(60, 60, 0, w - 60, d - 60, 1010, "laminate", { bevel: 2 }),
      slab(0, -250, 1010, w, d, 1050, "marble", "bullnose"),
    ],
  },
  {
    key: "microwaveShelf",
    name: "Microwave shelf",
    category: "Kitchen",
    w: 600,
    d: 400,
    h: 450,
    price: 9000,
    unit: "each",
    wallHung: true,
    compatible: ["counterRun", "counterBase"],
    leadWeeks: 4,
    parts: (w, d) => [
      box(0, 0, 0, w, d, 20, "laminate", { mount: "wall", bevel: 1 }),
      box(0, 0, 0, 18, d, 360, "laminate", { mount: "wall", bevel: 1 }),
      box(w - 18, 0, 0, w, d, 360, "laminate", { mount: "wall", bevel: 1 }),
      box(30, 20, 20, w - 30, d - 10, 320, "metalDark", { mount: "wall", radius: 8 }),
      box(40, d - 10, 60, w - 150, d - 2, 280, "screen", { mount: "wall" }),
    ],
  },
];
