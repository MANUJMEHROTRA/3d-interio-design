import type { ItemLight, MaterialKey, Mm, Part } from "../types.js";

/**
 * A small construction vocabulary for authoring furniture.
 *
 * Catalog items are authored in their own footprint space: x from 0 to w,
 * y from 0 to d, z up from the floor, and the piece faces +y. Rotation and
 * placement are applied later, so an author only ever thinks about one piece
 * standing against the far wall.
 *
 * The point of these helpers is that real furniture is not made of raw boxes.
 * Seats are crowned, tops have eased edges, legs taper, shutters sit proud of
 * their carcass with a shadow gap. Those details are what make a render stop
 * looking like a massing study.
 */

export const box = (
  x0: Mm,
  y0: Mm,
  z0: Mm,
  x1: Mm,
  y1: Mm,
  z1: Mm,
  m: MaterialKey,
  opts: { radius?: Mm; bevel?: Mm; mount?: "floor" | "wall"; noShadow?: boolean } = {},
): Part => ({
  shape: { k: "box", box: { x0, y0, z0, x1, y1, z1 }, radius: opts.radius, bevel: opts.bevel ?? 2 },
  m,
  mount: opts.mount,
  noShadow: opts.noShadow,
});

/** Upholstery. The crown is how far the centre of the top bows upward. */
export const cushion = (
  x0: Mm,
  y0: Mm,
  z0: Mm,
  x1: Mm,
  y1: Mm,
  z1: Mm,
  m: MaterialKey,
  crown: Mm = 14,
  radius: Mm = 28,
): Part => ({
  shape: { k: "cushion", box: { x0, y0, z0, x1, y1, z1 }, crown, radius },
  m,
});

/** A worktop, table top or shelf with a profiled front edge. */
export const slab = (
  x0: Mm,
  y0: Mm,
  z0: Mm,
  x1: Mm,
  y1: Mm,
  z1: Mm,
  m: MaterialKey,
  edge: "square" | "eased" | "bullnose" = "eased",
): Part => ({ shape: { k: "slab", box: { x0, y0, z0, x1, y1, z1 }, edge }, m });

export const cyl = (
  cx: Mm,
  cy: Mm,
  z0: Mm,
  z1: Mm,
  r0: Mm,
  m: MaterialKey,
  opts: { r1?: Mm; segments?: number; mount?: "floor" | "wall"; noShadow?: boolean } = {},
): Part => ({
  shape: { k: "cyl", cx, cy, z0, z1, r0, r1: opts.r1, segments: opts.segments ?? 20 },
  m,
  mount: opts.mount,
  noShadow: opts.noShadow,
});

export const ball = (
  cx: Mm,
  cy: Mm,
  cz: Mm,
  r: Mm,
  m: MaterialKey,
  squash = 1,
  noShadow = false,
): Part => ({ shape: { k: "ball", cx, cy, cz, r, squash }, m, noShadow });

export const lathe = (
  cx: Mm,
  cy: Mm,
  z0: Mm,
  z1: Mm,
  profile: Array<[Mm, number]>,
  m: MaterialKey,
  segments = 24,
): Part => ({ shape: { k: "lathe", cx, cy, z0, z1, profile, segments }, m });

/** Rugs, artwork, mirror glass, curtains — anything effectively two-dimensional. */
export const sheet = (
  x0: Mm,
  y0: Mm,
  z0: Mm,
  x1: Mm,
  y1: Mm,
  z1: Mm,
  m: MaterialKey,
  axis: "x" | "y" | "z" = "z",
  opts: { mount?: "floor" | "wall"; noShadow?: boolean } = {},
): Part => ({
  shape: { k: "sheet", box: { x0, y0, z0, x1, y1, z1 }, axis },
  m,
  mount: opts.mount,
  noShadow: opts.noShadow ?? true,
});

/* ------------------------------------------------------------------ *
 * Assemblies
 * ------------------------------------------------------------------ */

/** Four tapered legs inset from the corners. */
export function legs4(
  w: Mm,
  d: Mm,
  h: Mm,
  m: MaterialKey,
  opts: { inset?: Mm; r?: Mm; taper?: number; splay?: boolean } = {},
): Part[] {
  const inset = opts.inset ?? 60;
  const r = opts.r ?? 22;
  const r1 = r * (opts.taper ?? 0.72);
  const xs = [inset, w - inset];
  const ys = [inset, d - inset];
  const out: Part[] = [];
  for (const x of xs) for (const y of ys) out.push(cyl(x, y, 0, h, r, m, { r1, segments: 12 }));
  return out;
}

/** A plinth — the recessed base that makes built-in joinery look built-in. */
export const plinth = (w: Mm, d: Mm, h: Mm, m: MaterialKey = "metalDark"): Part =>
  box(28, 28, 0, w - 28, d - 10, h, m, { bevel: 0 });

/**
 * Cabinet shutters: `count` panels across the opening, sitting 4 mm proud of
 * the carcass with a 3 mm shadow gap between them, each with a handle.
 */
export function shutters(
  x0: Mm,
  x1: Mm,
  z0: Mm,
  z1: Mm,
  yFront: Mm,
  count: number,
  m: MaterialKey,
  opts: {
    handle?: MaterialKey | null;
    handleStyle?: "bar" | "edge" | "none";
    thickness?: Mm;
    gap?: Mm;
  } = {},
): Part[] {
  const gap = opts.gap ?? 3;
  const th = opts.thickness ?? 18;
  const handle = opts.handle === undefined ? "metal" : opts.handle;
  const style = opts.handleStyle ?? "bar";
  const total = x1 - x0;
  const pw = (total - gap * (count - 1)) / count;
  const out: Part[] = [];
  for (let i = 0; i < count; i++) {
    const a = x0 + i * (pw + gap);
    out.push(box(a, yFront, z0 + gap / 2, a + pw, yFront + th, z1 - gap / 2, m, { bevel: 1.5 }));
    if (!handle || style === "none") continue;
    if (style === "bar") {
      // vertical bar pull near the opening edge
      const hx = i % 2 === 0 ? a + pw - 42 : a + 42;
      const hz0 = z0 + (z1 - z0) * 0.34;
      const hz1 = Math.min(z1 - 40, hz0 + 320);
      out.push(cyl(hx, yFront + th + 14, hz0, hz1, 7, handle, { segments: 10 }));
      out.push(box(hx - 7, yFront + th, hz0, hx + 7, yFront + th + 16, hz0 + 14, handle));
      out.push(box(hx - 7, yFront + th, hz1 - 14, hx + 7, yFront + th + 16, hz1, handle));
    } else {
      const hz = z0 + (z1 - z0) / 2;
      out.push(box(a + 20, yFront + th, hz - 6, a + pw - 20, yFront + th + 8, hz + 6, handle));
    }
  }
  return out;
}

/** A run of drawers with recessed fronts and lip pulls. */
export function drawers(
  x0: Mm,
  x1: Mm,
  z0: Mm,
  z1: Mm,
  yFront: Mm,
  count: number,
  m: MaterialKey,
  handle: MaterialKey | null = "metal",
): Part[] {
  const gap = 3;
  const th = 18;
  const dh = (z1 - z0 - gap * (count - 1)) / count;
  const out: Part[] = [];
  for (let i = 0; i < count; i++) {
    const a = z0 + i * (dh + gap);
    out.push(box(x0 + gap / 2, yFront, a, x1 - gap / 2, yFront + th, a + dh, m, { bevel: 1.5 }));
    if (handle) {
      const cxm = (x0 + x1) / 2;
      out.push(cyl(cxm - 90, yFront + th + 10, a + dh - 46, a + dh - 32, 7, handle, { segments: 10 }));
      out.push(
        box(cxm - 90, yFront + th, a + dh - 46, cxm + 90, yFront + th + 17, a + dh - 32, handle, {
          bevel: 1,
        }),
      );
    }
  }
  return out;
}

/** Open shelving: a carcass plus evenly spaced shelves and a few book masses. */
export function shelfRun(
  w: Mm,
  d: Mm,
  z0: Mm,
  z1: Mm,
  m: MaterialKey,
  bays: number,
  opts: { books?: boolean; back?: boolean } = {},
): Part[] {
  const t = 18;
  const out: Part[] = [
    box(0, 0, z0, t, d, z1, m),
    box(w - t, 0, z0, w, d, z1, m),
    box(0, 0, z0, w, d, z0 + t, m),
    box(0, 0, z1 - t, w, d, z1, m),
  ];
  if (opts.back !== false) out.push(box(t, 0, z0, w - t, 8, z1, m, { bevel: 0 }));
  const inner = z1 - z0 - 2 * t;
  const step = inner / bays;
  for (let i = 1; i < bays; i++) {
    const z = z0 + t + step * i;
    out.push(box(t, 8, z - t / 2, w - t, d, z + t / 2, m));
  }
  if (opts.books) {
    for (let i = 0; i < bays; i++) {
      const z = z0 + t + step * i + t / 2;
      const bw = (w - 2 * t) * (0.3 + 0.4 * ((i * 7) % 5) / 5);
      const start = t + ((i * 13) % 3) * 30;
      out.push(
        box(start, 40, z, Math.min(w - t - 10, start + bw), d - 30, z + step * 0.62, "paper", {
          bevel: 1,
        }),
      );
    }
  }
  return out;
}

/** A soft, slumped duvet over a mattress — four stacked, shrinking cushions. */
export function bedding(x0: Mm, x1: Mm, y0: Mm, y1: Mm, z: Mm, m: MaterialKey): Part[] {
  return [
    cushion(x0, y0, z, x1, y1, z + 46, m, 10, 26),
    cushion(x0 + 10, y0 + 120, z + 40, x1 - 10, y1 - 30, z + 74, m, 18, 34),
  ];
}

/** Pillows laid against a headboard. */
export function pillows(cx: Mm, y: Mm, z: Mm, count: 1 | 2, m: MaterialKey): Part[] {
  const out: Part[] = [];
  const spread = count === 1 ? [0] : [-310, 310];
  for (const dx of spread) {
    out.push(cushion(cx + dx - 290, y, z, cx + dx + 290, y + 360, z + 125, m, 26, 60));
  }
  return out;
}

/** Scatter cushions on a seat. */
export function scatter(positions: Array<[Mm, Mm]>, z: Mm, m: MaterialKey, size: Mm = 230): Part[] {
  return positions.map(([x, y]) =>
    cushion(x - size / 2, y - 60, z, x + size / 2, y + 60, z + size * 0.85, m, 22, 40),
  );
}

/** A potted plant: tapered pot, soil, and a few leaf masses. */
export function pottedPlant(cx: Mm, cy: Mm, potH: Mm, spread: Mm, topZ: Mm): Part[] {
  const r = spread * 0.38;
  const out: Part[] = [
    lathe(cx, cy, 0, potH, [
      [r * 0.72, 0],
      [r, 0.18],
      [r * 0.96, 0.8],
      [r * 1.05, 0.95],
      [r * 1.02, 1],
    ], "planter"),
    cyl(cx, cy, potH - 18, potH - 6, r * 0.9, "paper", { segments: 16, noShadow: true }),
    cyl(cx, cy, potH - 10, topZ * 0.55, 14, "woodMid", { r1: 10, segments: 8 }),
  ];
  const masses: Array<[number, number, number, number]> = [
    [0, 0, 0.78, 0.5],
    [0.5, -0.3, 0.6, 0.38],
    [-0.45, 0.35, 0.68, 0.34],
    [0.2, 0.5, 0.9, 0.3],
  ];
  for (const [ox, oy, hz, sz] of masses) {
    out.push(
      ball(cx + ox * spread * 0.5, cy + oy * spread * 0.5, topZ * hz, spread * sz, "plant", 0.74),
    );
  }
  return out;
}

/** A pendant lamp with a shade and the light it throws. */
export function pendant(
  cx: Mm,
  cy: Mm,
  ceilingZ: Mm,
  dropTo: Mm,
  shadeR: Mm,
  m: MaterialKey = "lampshade",
): { parts: Part[]; lights: ItemLight[] } {
  return {
    parts: [
      box(cx - 50, cy - 50, ceilingZ - 14, cx + 50, cy + 50, ceilingZ, "metalDark", { mount: "wall" }),
      cyl(cx, cy, dropTo + shadeR * 1.1, ceilingZ - 10, 5, "metalDark", { segments: 8, mount: "wall" }),
      lathe(
        cx,
        cy,
        dropTo,
        dropTo + shadeR * 1.1,
        [
          [shadeR * 0.18, 1],
          [shadeR * 0.9, 0.22],
          [shadeR, 0.06],
          [shadeR, 0],
        ],
        m,
      ),
      ball(cx, cy, dropTo + shadeR * 0.3, shadeR * 0.3, "emissive", 1, true),
    ],
    lights: [{ x: cx, y: cy, z: dropTo + shadeR * 0.2, intensity: 9, kelvin: 2900, distance: 4200, kind: "point" }],
  };
}

/** Framed artwork hung flat on a wall. */
export function artwork(x0: Mm, x1: Mm, z0: Mm, z1: Mm, yWall: Mm): Part[] {
  return [
    box(x0, yWall, z0, x1, yWall + 32, z1, "woodDark", { mount: "wall", bevel: 2 }),
    sheet(x0 + 42, yWall + 33, z0 + 42, x1 - 42, yWall + 33, z1 - 42, "paper", "y", { mount: "wall" }),
  ];
}

/** Floor-to-near-ceiling curtains with a gathered, wavy leading edge. */
export function curtains(x0: Mm, x1: Mm, topZ: Mm, yWall: Mm, m: MaterialKey = "fabricAlt"): Part[] {
  const out: Part[] = [
    cyl(x0 - 60, yWall + 90, topZ, topZ, 16, "metalDark", { segments: 10, mount: "wall" }),
  ];
  // two gathered panels made of overlapping soft folds
  const folds = 7;
  const panelW = (x1 - x0) * 0.3;
  for (const side of [0, 1]) {
    const base = side === 0 ? x0 : x1 - panelW;
    for (let i = 0; i < folds; i++) {
      const t = i / (folds - 1);
      const fx = base + t * panelW;
      const depth = 36 + Math.sin(t * Math.PI * 2.2) * 22;
      out.push(
        cyl(fx, yWall + 70 + depth * 0.4, 20, topZ - 20, depth, m, { segments: 10, mount: "wall" }),
      );
    }
  }
  return out;
}
