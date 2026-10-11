import type { CatalogItem, Part } from "../types.js";
import { ball, box, cyl, lathe, sheet } from "./primitives.js";

/**
 * Lighting is quoted separately in most studios and it is the thing that makes
 * a 3D view look like a photograph rather than a diagram, so it is a first-class
 * catalog category with real emitters attached.
 */
export const LIGHTING: CatalogItem[] = [
  {
    key: "pendantCluster",
    name: "Pendant cluster, 3 drops",
    category: "Lighting",
    w: 900,
    d: 300,
    h: 1600,
    price: 24000,
    unit: "each",
    wallHung: true,
    ceilingHung: true,
    spec: "Three blown-glass pendants on adjustable brass drops",
    leadWeeks: 5,
    parts: (w, d) => {
      const out: Part[] = [
        box(w / 2 - 240, d / 2 - 50, 1560, w / 2 + 240, d / 2 + 50, 1600, "brass", { mount: "wall", bevel: 2 }),
      ];
      const drops = [
        [w * 0.2, 760],
        [w * 0.5, 560],
        [w * 0.8, 880],
      ] as const;
      for (const [x, z] of drops) {
        out.push(cyl(x, d / 2, z + 180, 1560, 5, "brass", { segments: 8, mount: "wall" }));
        out.push(
          lathe(x, d / 2, z, z + 200, [
            [26, 1],
            [120, 0.55],
            [128, 0.2],
            [96, 0],
          ], "glass"),
        );
        out.push(ball(x, d / 2, z + 70, 46, "emissive", 1, true));
      }
      return out;
    },
    lights: (w, d) => [
      { x: w * 0.2, y: d / 2, z: 820, intensity: 6, kelvin: 2800, distance: 3600, kind: "point" },
      { x: w * 0.5, y: d / 2, z: 620, intensity: 6, kelvin: 2800, distance: 3600, kind: "point" },
      { x: w * 0.8, y: d / 2, z: 940, intensity: 6, kelvin: 2800, distance: 3600, kind: "point" },
    ],
  },
  {
    key: "chandelier",
    name: "Statement chandelier",
    category: "Lighting",
    w: 900,
    d: 900,
    h: 1300,
    price: 68000,
    unit: "each",
    wallHung: true,
    ceilingHung: true,
    spec: "Brass armature with hand-blown glass shades",
    leadWeeks: 9,
    parts: (w, d) => {
      const out: Part[] = [
        box(w / 2 - 60, d / 2 - 60, 1260, w / 2 + 60, d / 2 + 60, 1300, "brass", { mount: "wall" }),
        cyl(w / 2, d / 2, 700, 1260, 12, "brass", { segments: 10, mount: "wall" }),
        cyl(w / 2, d / 2, 660, 700, 90, "brass", { segments: 20, mount: "wall" }),
      ];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const x = w / 2 + Math.cos(a) * 340;
        const y = d / 2 + Math.sin(a) * 340;
        // alternating drops, both kept clear below the 660 mm hub so a shade
        // never ends up hanging above the arm it is suspended from
        const z = 380 + (i % 2) * 110;
        out.push(
          box(
            Math.min(w / 2, x) - 8,
            Math.min(d / 2, y) - 8,
            660,
            Math.max(w / 2, x) + 8,
            Math.max(d / 2, y) + 8,
            676,
            "brass",
            { mount: "wall", noShadow: true },
          ),
        );
        out.push(cyl(x, y, z + 130, 676, 6, "brass", { segments: 6, mount: "wall" }));
        out.push(
          lathe(x, y, z, z + 140, [
            [18, 1],
            [86, 0.5],
            [78, 0],
          ], "glass"),
        );
        out.push(ball(x, y, z + 60, 34, "emissive", 1, true));
      }
      return out;
    },
    lights: (w, d) => [
      { x: w / 2, y: d / 2, z: 640, intensity: 14, kelvin: 2700, distance: 6000, kind: "point" },
    ],
  },
  {
    key: "floorLamp",
    name: "Arc floor lamp",
    category: "Lighting",
    w: 420,
    d: 420,
    h: 1850,
    price: 18000,
    unit: "each",
    spec: "Marble base, brass arc, linen shade",
    leadWeeks: 5,
    parts: (w, d) => [
      cyl(w / 2, d / 2, 0, 44, 190, "marble", { segments: 28 }),
      cyl(w / 2, d / 2, 44, 1620, 18, "brass", { segments: 12 }),
      box(w / 2 - 18, d / 2 - 18, 1600, w / 2 + 18, d / 2 + 320, 1636, "brass", { bevel: 2 }),
      lathe(w / 2, d / 2 + 300, 1420, 1620, [
        [150, 1],
        [190, 0.3],
        [196, 0],
      ], "lampshade"),
      ball(w / 2, d / 2 + 300, 1500, 60, "emissive", 1, true),
    ],
    lights: (w, d) => [
      { x: w / 2, y: d / 2 + 300, z: 1480, intensity: 5, kelvin: 2800, distance: 3600, kind: "point" },
    ],
  },
  {
    key: "tableLamp",
    name: "Table lamp",
    category: "Lighting",
    w: 320,
    d: 320,
    h: 520,
    price: 7500,
    unit: "each",
    spec: "Ceramic body with a linen drum shade",
    leadWeeks: 3,
    parts: (w, d) => [
      lathe(w / 2, d / 2, 0, 290, [
        [80, 0],
        [120, 0.35],
        [70, 0.9],
        [52, 1],
      ], "ceramic"),
      lathe(w / 2, d / 2, 290, 520, [
        [120, 1],
        [152, 0.3],
        [156, 0],
      ], "lampshade"),
      ball(w / 2, d / 2, 380, 52, "emissive", 1, true),
    ],
    lights: (w, d) => [
      { x: w / 2, y: d / 2, z: 390, intensity: 3, kelvin: 2700, distance: 2400, kind: "point" },
    ],
  },
  {
    key: "coveLight",
    name: "Cove lighting, concealed LED",
    category: "Lighting",
    w: 3000,
    d: 220,
    h: 120,
    price: 2600,
    unit: "perMetre",
    resize: "w",
    wRange: [600, 9000],
    wallHung: true,
    ceilingHung: true,
    spec: "Aluminium profile with warm-white LED strip in a false-ceiling cove",
    leadWeeks: 2,
    parts: (w, d) => [
      box(0, 0, 0, w, d, 90, "lacquer", { mount: "wall", bevel: 1 }),
      box(10, 20, 90, w - 10, d - 40, 110, "emissive", { mount: "wall", noShadow: true }),
    ],
    lights: (w, d) => {
      const n = Math.max(2, Math.round(w / 1200));
      return Array.from({ length: n }, (_, i) => ({
        x: ((i + 0.5) / n) * w,
        y: d / 2,
        z: 60,
        intensity: 2.4,
        kelvin: 3000,
        distance: 3200,
        kind: "point" as const,
      }));
    },
  },
  {
    key: "trackLight",
    name: "Track spotlights",
    category: "Lighting",
    w: 1800,
    d: 120,
    h: 260,
    price: 4200,
    unit: "perMetre",
    resize: "w",
    wRange: [600, 4800],
    wallHung: true,
    ceilingHung: true,
    spec: "Surface track with adjustable 7 W spots at 450 mm centres",
    leadWeeks: 3,
    parts: (w, d) => {
      const out: Part[] = [box(0, d / 2 - 22, 200, w, d / 2 + 22, 240, "metalDark", { mount: "wall", bevel: 1 })];
      const n = Math.max(2, Math.round(w / 450));
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n) * w;
        out.push(cyl(x, d / 2, 110, 200, 22, "metalDark", { segments: 10, mount: "wall" }));
        out.push(
          lathe(x, d / 2, 40, 120, [
            [44, 1],
            [56, 0.4],
            [52, 0],
          ], "metalDark"),
        );
        out.push(ball(x, d / 2, 62, 30, "emissive", 1, true));
      }
      return out;
    },
    lights: (w, d) => {
      const n = Math.max(2, Math.round(w / 450));
      return Array.from({ length: n }, (_, i) => ({
        x: ((i + 0.5) / n) * w,
        y: d / 2,
        z: 50,
        intensity: 3.4,
        kelvin: 3200,
        distance: 4200,
        kind: "spot" as const,
      }));
    },
  },
];
