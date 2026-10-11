import type {
  Box3,
  CatalogItem,
  Mm,
  Opening,
  Part,
  PartShape,
  PlacedItem,
  Rect,
  Room,
  Rot,
  Side,
} from "./types.js";
import type { Project } from "./types.js";
import { CATALOG } from "./catalog/index.js";

/** Nominal wall thickness, mm. Internal masonry in Indian apartments is 75–115 mm. */
export const WALL_T: Mm = 100;
/** Cutaway wall height for the plan-style 3D view. */
export const CUTAWAY_H: Mm = 1150;
/** Skirting height. */
export const SKIRTING_H: Mm = 100;
export const SKIRTING_T: Mm = 14;

export const nrot = (r: number): Rot => ((((Math.round(r / 90) * 90) % 360) + 360) % 360) as Rot;

/* ------------------------------------------------------------------ *
 * Rectangles
 * ------------------------------------------------------------------ */

/** Clear floor rectangle inside a room's wall centrelines. */
export const innerRect = (r: Rect): Rect => ({
  x: r.x + WALL_T / 2,
  y: r.y + WALL_T / 2,
  w: r.w - WALL_T,
  d: r.d - WALL_T,
});

export const rectArea = (r: Rect): number => r.w * r.d;

export const rectsOverlap = (a: Rect, b: Rect, tol = 1): boolean =>
  a.x < b.x + b.w - tol && b.x < a.x + a.w - tol && a.y < b.y + b.d - tol && b.y < a.y + a.d - tol;

export const rectContains = (outer: Rect, inner: Rect, tol = 1): boolean =>
  inner.x >= outer.x - tol &&
  inner.y >= outer.y - tol &&
  inner.x + inner.w <= outer.x + outer.w + tol &&
  inner.y + inner.d <= outer.y + outer.d + tol;

export const pointInRect = (r: Rect, x: Mm, y: Mm): boolean =>
  x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.d;

export const roomAt = (rooms: Room[], x: Mm, y: Mm): Room | null =>
  rooms.find((r) => pointInRect(r, x, y)) ?? null;

export function projectBounds(p: Pick<Project, "rooms">): { x0: Mm; y0: Mm; x1: Mm; y1: Mm } {
  if (!p.rooms.length) return { x0: 0, y0: 0, x1: 4000, y1: 3000 };
  return {
    x0: Math.min(...p.rooms.map((r) => r.x)),
    y0: Math.min(...p.rooms.map((r) => r.y)),
    x1: Math.max(...p.rooms.map((r) => r.x + r.w)),
    y1: Math.max(...p.rooms.map((r) => r.y + r.d)),
  };
}

/* ------------------------------------------------------------------ *
 * Items
 * ------------------------------------------------------------------ */

export const catalogOf = (key: string): CatalogItem | undefined => CATALOG[key];

/** The item's size after designer overrides. */
export function itemSize(it: PlacedItem): { w: Mm; d: Mm; h: Mm } {
  const c = CATALOG[it.key];
  if (!c) return { w: it.w ?? 600, d: it.d ?? 600, h: 600 };
  return { w: it.w ?? c.w, d: it.d ?? c.d, h: c.h };
}

/** Plan footprint, accounting for 90° rotation swapping width and depth. */
export function footprint(it: PlacedItem): Rect {
  const { w, d } = itemSize(it);
  const swapped = nrot(it.rot) % 180 !== 0;
  const fw = swapped ? d : w;
  const fd = swapped ? w : d;
  return { x: it.cx - fw / 2, y: it.cy - fd / 2, w: fw, d: fd };
}

/**
 * The strip of clear floor the piece needs to be usable — in front of a
 * wardrobe, beside a bed, at a kitchen counter. Rotation 0 means the piece
 * faces +y (down the plan), matching the catalog's authoring convention.
 */
export function clearanceZone(it: PlacedItem): Rect | null {
  const c = CATALOG[it.key];
  if (!c?.clearance) return null;
  const f = footprint(it);
  const g = c.clearance;
  switch (nrot(it.rot)) {
    case 0:
      return { x: f.x, y: f.y + f.d, w: f.w, d: g };
    case 180:
      return { x: f.x, y: f.y - g, w: f.w, d: g };
    case 90:
      return { x: f.x - g, y: f.y, w: g, d: f.d };
    default:
      return { x: f.x + f.w, y: f.y, w: g, d: f.d };
  }
}

/* ------------------------------------------------------------------ *
 * Parts
 * ------------------------------------------------------------------ */

/**
 * Normalise a box so min really is min.
 *
 * Catalog geometry is authored by hand and it is easy to write a span
 * backwards. The renderer happens to cope, but the STL and OBJ exporters and
 * the 2D plan all assume ordered bounds, so an inverted box becomes a hole in
 * a printed model rather than a visible mistake. Fixing it here means a slip
 * can never leave the domain.
 */
const order = (b: Box3): Box3 => ({
  x0: Math.min(b.x0, b.x1),
  y0: Math.min(b.y0, b.y1),
  z0: Math.min(b.z0, b.z1),
  x1: Math.max(b.x0, b.x1),
  y1: Math.max(b.y0, b.y1),
  z1: Math.max(b.z0, b.z1),
});

/** Tight axis-aligned bounds of a part shape, in the part's own coordinates. */
export function shapeAabb(s: PartShape): Box3 {
  switch (s.k) {
    case "box":
    case "cushion":
    case "slab":
    case "sheet":
      return order(s.box);
    case "cyl": {
      const r = Math.max(s.r0, s.r1 ?? s.r0);
      return order({ x0: s.cx - r, y0: s.cy - r, z0: s.z0, x1: s.cx + r, y1: s.cy + r, z1: s.z1 });
    }
    case "lathe": {
      const r = Math.max(...s.profile.map(([rad]) => rad));
      return order({ x0: s.cx - r, y0: s.cy - r, z0: s.z0, x1: s.cx + r, y1: s.cy + r, z1: s.z1 });
    }
    case "ball": {
      const rz = s.r * (s.squash ?? 1);
      return {
        x0: s.cx - s.r,
        y0: s.cy - s.r,
        z0: s.cz - rz,
        x1: s.cx + s.r,
        y1: s.cy + s.r,
        z1: s.cz + rz,
      };
    }
  }
}

/**
 * Parts in **centre-local** coordinates: x and y measured from the footprint
 * centre, z from finished floor. The renderer puts these in a group positioned
 * at (cx, cy) and rotated by `rot`, so rotation never has to be baked in.
 */
export function localParts(it: PlacedItem): Part[] {
  const c = CATALOG[it.key];
  if (!c) return [];
  const { w, d, h } = itemSize(it);
  const dz = it.z ?? 0;
  const shift = (s: PartShape): PartShape => {
    const ox = -w / 2;
    const oy = -d / 2;
    switch (s.k) {
      case "box":
      case "cushion":
      case "slab":
      case "sheet":
        return {
          ...s,
          box: {
            x0: s.box.x0 + ox,
            y0: s.box.y0 + oy,
            z0: s.box.z0 + dz,
            x1: s.box.x1 + ox,
            y1: s.box.y1 + oy,
            z1: s.box.z1 + dz,
          },
        };
      case "cyl":
        return { ...s, cx: s.cx + ox, cy: s.cy + oy, z0: s.z0 + dz, z1: s.z1 + dz };
      case "lathe":
        return { ...s, cx: s.cx + ox, cy: s.cy + oy, z0: s.z0 + dz, z1: s.z1 + dz };
      case "ball":
        return { ...s, cx: s.cx + ox, cy: s.cy + oy, cz: s.cz + dz };
    }
  };
  return c.parts(w, d, h).map((p) => ({ ...p, shape: shift(p.shape) }));
}

/** Rotate a centre-local point by the item's rotation. */
function spin(x: Mm, y: Mm, rot: Rot): [Mm, Mm] {
  switch (rot) {
    case 90:
      return [-y, x];
    case 180:
      return [-x, -y];
    case 270:
      return [y, -x];
    default:
      return [x, y];
  }
}

/** A part's world-space axis-aligned bounds, used by the plan view and STL export. */
export function worldPartBoxes(it: PlacedItem): Array<Box3 & { m: Part["m"]; mount: string; id: string }> {
  const rot = nrot(it.rot);
  return localParts(it).map((p) => {
    const b = shapeAabb(p.shape);
    const [ax, ay] = spin(b.x0, b.y0, rot);
    const [bx, by] = spin(b.x1, b.y1, rot);
    return {
      x0: it.cx + Math.min(ax, bx),
      y0: it.cy + Math.min(ay, by),
      z0: b.z0,
      x1: it.cx + Math.max(ax, bx),
      y1: it.cy + Math.max(ay, by),
      z1: b.z1,
      m: p.m,
      mount: p.mount ?? "floor",
      id: it.id,
    };
  });
}

/* ------------------------------------------------------------------ *
 * Walls and openings
 * ------------------------------------------------------------------ */

/** Which side of the room an opening sits on, or null if it is not on this room. */
export function openingSide(op: Opening, r: Room, tol = 2): Side | null {
  if (op.o === "h") {
    if (!(op.x < r.x + r.w && op.x + op.w > r.x)) return null;
    if (Math.abs(op.y - r.y) < tol) return "N";
    if (Math.abs(op.y - (r.y + r.d)) < tol) return "S";
    return null;
  }
  if (!(op.y < r.y + r.d && op.y + op.w > r.y)) return null;
  if (Math.abs(op.x - r.x) < tol) return "W";
  if (Math.abs(op.x - (r.x + r.w)) < tol) return "E";
  return null;
}

export const openingsOn = (openings: Opening[], r: Room): Opening[] =>
  openings.filter((op) => openingSide(op, r) !== null);

export const SIDE_LABEL: Record<Side, string> = {
  N: "Top wall",
  S: "Bottom wall",
  W: "Left wall",
  E: "Right wall",
};

export interface WallSolid extends Box3 {
  m: "wall" | "wallAccent";
  side: Side;
}

/**
 * Solve one room's four walls into solid boxes with openings subtracted.
 *
 * Each opening removes a span from `sill` to `sill + h`; the wall below the
 * sill and the lintel above the head are emitted as separate solids, which is
 * what makes windows read correctly instead of appearing as full-height holes.
 */
export function wallSolids(r: Room, openings: Opening[], height: Mm): WallSolid[] {
  const t = WALL_T;
  const out: WallSolid[] = [];

  const sides: Array<{
    side: Side;
    o: "h" | "v";
    at: Mm;
    from: Mm;
    to: Mm;
    rect: (a: Mm, b: Mm) => [Mm, Mm, Mm, Mm];
  }> = [
    { side: "N", o: "h", at: r.y, from: r.x, to: r.x + r.w, rect: (a, b) => [a, r.y - t / 2, b, r.y + t / 2] },
    {
      side: "S",
      o: "h",
      at: r.y + r.d,
      from: r.x,
      to: r.x + r.w,
      rect: (a, b) => [a, r.y + r.d - t / 2, b, r.y + r.d + t / 2],
    },
    { side: "W", o: "v", at: r.x, from: r.y, to: r.y + r.d, rect: (a, b) => [r.x - t / 2, a, r.x + t / 2, b] },
    {
      side: "E",
      o: "v",
      at: r.x + r.w,
      from: r.y,
      to: r.y + r.d,
      rect: (a, b) => [r.x + r.w - t / 2, a, r.x + r.w + t / 2, b],
    },
  ];

  for (const s of sides) {
    const mat: WallSolid["m"] = r.accentWall === s.side ? "wallAccent" : "wall";
    const push = (a: Mm, b: Mm, z0: Mm, z1: Mm) => {
      if (b - a <= 1 || z1 - z0 <= 1) return;
      const [x0, y0, x1, y1] = s.rect(a, b);
      out.push({ x0, y0, z0, x1, y1, z1, m: mat, side: s.side });
    };

    const gaps = openings
      .filter((op) => op.o === s.o && Math.abs((op.o === "h" ? op.y : op.x) - s.at) < 2)
      .map((op) => {
        const start = op.o === "h" ? op.x : op.y;
        return {
          a: Math.max(s.from, start),
          b: Math.min(s.to, start + op.w),
          z0: op.sill,
          z1: Math.min(height, op.sill + op.h),
        };
      })
      .filter((g) => g.b - g.a > 1)
      .sort((p, q) => p.a - q.a);

    let cursor = s.from;
    for (const g of gaps) {
      if (g.a > cursor) push(cursor, g.a, 0, height);
      // wall under the sill, and the lintel over the head
      if (g.z0 > 0) push(g.a, g.b, 0, Math.min(g.z0, height));
      if (g.z1 < height) push(g.a, g.b, g.z1, height);
      cursor = Math.max(cursor, g.b);
    }
    if (cursor < s.to) push(cursor, s.to, 0, height);
  }
  return out;
}

/** Floor-level footprint of every wall, for the 2D plan's poché. */
export function wallFootprints(r: Room, openings: Opening[]): Array<Rect & { opening: boolean }> {
  const solids = wallSolids(r, openings, 10);
  return solids.map((b) => ({
    x: b.x0,
    y: b.y0,
    w: b.x1 - b.x0,
    d: b.y1 - b.y0,
    opening: false,
  }));
}

/**
 * The floor area a door leaf sweeps, plus the landing strip on both sides.
 * Furniture in either is a blocked door, which is the single most common
 * mistake in a first-pass layout.
 */
export function openingKeepOut(op: Opening): Rect[] {
  if (op.sill > 0) return []; // a window needs no floor clearance
  const reach = op.kind === "cased" ? 450 : Math.min(op.w, 900);
  return op.o === "h"
    ? [
        { x: op.x, y: op.y - reach, w: op.w, d: reach },
        { x: op.x, y: op.y, w: op.w, d: reach },
      ]
    : [
        { x: op.x - reach, y: op.y, w: reach, d: op.w },
        { x: op.x, y: op.y, w: reach, d: op.w },
      ];
}

export const ceilingOf = (p: Project, r: Room): Mm => r.ceiling ?? p.ceiling;
