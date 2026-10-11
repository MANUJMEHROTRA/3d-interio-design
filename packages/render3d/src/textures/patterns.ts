import type { TexturePattern } from "@layoutcraft/core";
import { cellRandom, clamp01, fbm, ridged, valueNoise, worley } from "./noise.js";

/**
 * Each pattern fills three buffers for one tile:
 *   tint   — a per-pixel multiplier on the finish's base colour (and a mix
 *            toward the accent colour), so one generator serves every style
 *   height — drives the normal map, which is what makes grout lines, fabric
 *            weave and wood grain catch the light
 *   rough  — per-pixel roughness variation; uniform roughness is the single
 *            biggest giveaway that a render is synthetic
 */
export interface PatternBuffers {
  /** 0–1 brightness multiplier on the base colour. */
  tint: Float32Array;
  /** 0–1 mix toward the accent colour. */
  accent: Float32Array;
  /** 0–1 surface height. */
  height: Float32Array;
  /** -1..+1 offset added to the finish's base roughness. */
  rough: Float32Array;
}

export interface PatternContext {
  size: number;
  /** How many pattern repeats fit in one generated tile. */
  period: number;
  contrast: number;
  seed: number;
}

const SEED = 20260415;

export function generatePattern(
  pattern: TexturePattern,
  ctx: PatternContext,
): PatternBuffers {
  const { size, period, contrast } = ctx;
  const n = size * size;
  const tint = new Float32Array(n).fill(1);
  const accent = new Float32Array(n);
  const height = new Float32Array(n).fill(0.5);
  const rough = new Float32Array(n);
  const seed = ctx.seed + SEED;

  /** Normalised tile coordinates scaled to the pattern period. */
  const at = (i: number) => {
    const px = i % size;
    const py = (i / size) | 0;
    return { px, py, u: (px / size) * period, v: (py / size) * period };
  };

  switch (pattern) {
    case "plaster": {
      // very low-frequency mottling plus a fine tooth
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const broad = fbm(u * 1.5, v * 1.5, period, seed, 4);
        const tooth = valueNoise(u * 150, v * 150, period * 150, seed + 3);
        tint[i] = 1 + (broad - 0.5) * 0.09 * contrast * 4;
        height[i] = 0.5 + (tooth - 0.5) * 0.22 + (broad - 0.5) * 0.12;
        rough[i] = (tooth - 0.5) * 0.06;
      }
      break;
    }

    case "concrete": {
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const blotch = fbm(u * 2, v * 2, period, seed, 5, 0.55);
        const grit = valueNoise(u * 130, v * 130, period * 130, seed + 11);
        const pinhole = worley(u * 14, v * 14, period * 14, seed + 23).d1;
        const pit = pinhole < 0.09 ? 1 : 0;
        tint[i] = 1 + (blotch - 0.5) * 0.3 * contrast - pit * 0.18;
        height[i] = 0.55 + (grit - 0.5) * 0.16 + (blotch - 0.5) * 0.22 - pit * 0.4;
        rough[i] = (blotch - 0.5) * 0.14 + pit * 0.2;
      }
      break;
    }

    case "woodPlank":
    case "woodGrain": {
      // plank runs along u; each plank gets its own tone and grain offset
      const planksPerTile = pattern === "woodPlank" ? Math.max(1, Math.round(period)) : 0;
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        let plankTone = 0;
        let seam = 0;
        let grainV = v;
        if (planksPerTile > 0) {
          const row = Math.floor(v);
          const t = v - row;
          // stagger the butt joints so the floor does not read as a grid
          const stagger = cellRandom(0, row, seed + 61);
          const along = u + stagger * 3.1;
          const board = Math.floor(along / 2.4);
          plankTone = (cellRandom(board, row, seed + 83) - 0.5) * 0.26 * contrast * 2;
          const edge = Math.min(t, 1 - t);
          const buttT = Math.abs((along / 2.4 - board) - 0.5) * 2;
          seam = (edge < 0.012 ? 1 : 0) + (buttT > 0.988 ? 1 : 0);
          grainV = v * 1 + board * 7.7;
        }
        // grain: stretched ridged noise, plus occasional darker cathedral figure
        const grain = ridged(u * 2.4, grainV * 110, period * 110, seed + 7, 4);
        const figure = fbm(u * 1.1, grainV * 9, period * 9, seed + 31, 3);
        const pores = valueNoise(u * 140, grainV * 60, period * 140, seed + 47);
        const g = grain * 0.6 + figure * 0.4;

        tint[i] = clamp01(1 + plankTone + (g - 0.5) * 0.16 * contrast * 2 - seam * 0.5);
        accent[i] = clamp01((1 - g) * 0.22 * contrast);
        height[i] = clamp01(0.62 + (g - 0.5) * 0.16 + (pores - 0.5) * 0.09 - seam * 0.75);
        rough[i] = (1 - g) * 0.1 * contrast + seam * 0.18;
      }
      break;
    }

    case "weave": {
      // plain weave: alternating warp and weft, each a rounded cylinder
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const tu = (u * 2) % 1;
        const tv = (v * 2) % 1;
        const warpOver = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0;
        const bumpU = Math.sin(tu * Math.PI);
        const bumpV = Math.sin(tv * Math.PI);
        const h = warpOver ? bumpV * 0.9 + bumpU * 0.25 : bumpU * 0.9 + bumpV * 0.25;
        const slub = fbm(u * 6, v * 6, period * 6, seed + 13, 3);
        const fuzz = valueNoise(u * 120, v * 120, period * 120, seed + 29);
        tint[i] = 1 + (h - 0.6) * 0.22 * contrast * 2 + (slub - 0.5) * 0.12;
        height[i] = clamp01(0.35 + h * 0.55 + (fuzz - 0.5) * 0.08);
        rough[i] = (1 - h) * 0.08 + (fuzz - 0.5) * 0.05;
      }
      break;
    }

    case "linen": {
      // irregular slubby weave — thicker, less regular than plain weave
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const warp = Math.sin(u * Math.PI * period * 2) * 0.5 + 0.5;
        const weft = Math.sin(v * Math.PI * period * 2) * 0.5 + 0.5;
        const slubU = fbm(u * 3, v * 22, period * 22, seed + 17, 3);
        const slubV = fbm(u * 22, v * 3, period * 22, seed + 19, 3);
        const h = warp * 0.4 + weft * 0.4 + slubU * 0.1 + slubV * 0.1;
        const fuzz = valueNoise(u * 150, v * 150, period * 150, seed + 37);
        tint[i] = 1 + (h - 0.5) * 0.2 * contrast * 2 + (fuzz - 0.5) * 0.07;
        height[i] = clamp01(0.4 + h * 0.5 + (fuzz - 0.5) * 0.1);
        rough[i] = (1 - h) * 0.07;
      }
      break;
    }

    case "pile": {
      // carpet: dense short fibres, no structure, strong micro-relief
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const tufts = worley(u * 10, v * 10, period * 10, seed + 41);
        const fibre = valueNoise(u * 200, v * 200, period * 200, seed + 43);
        const fine = valueNoise(u * 420, v * 420, period * 420, seed + 59);
        const shade = fbm(u * 4, v * 4, period * 4, seed + 67, 3);
        tint[i] = 1 + (shade - 0.5) * 0.18 * contrast * 2 + (fibre - 0.5) * 0.16;
        height[i] = clamp01(0.5 + (fibre - 0.5) * 0.7 + (fine - 0.5) * 0.4 - tufts.d1 * 0.12);
        rough[i] = 0.04 + (1 - fibre) * 0.05;
      }
      break;
    }

    case "leatherGrain": {
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const cells = worley(u * 9, v * 9, period * 9, seed + 71);
        const creaseA = worley(u * 3.3, v * 3.3, period * 3.3, seed + 73);
        const crease = clamp01((creaseA.d2 - creaseA.d1) * 2.4);
        const pores = valueNoise(u * 170, v * 170, period * 170, seed + 79);
        const grain = clamp01((cells.d2 - cells.d1) * 2.2);
        tint[i] = 1 + (grain - 0.5) * 0.14 * contrast * 2 - (1 - crease) * 0.1;
        height[i] = clamp01(0.55 + grain * 0.3 - (1 - crease) * 0.35 + (pores - 0.5) * 0.14);
        rough[i] = (1 - grain) * 0.1 + (1 - crease) * 0.08;
      }
      break;
    }

    case "terrazzo": {
      // stone chips of two sizes in a matrix
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const big = worley(u * 5, v * 5, period * 5, seed + 83);
        const small = worley(u * 13, v * 13, period * 13, seed + 89);
        const inBig = big.d1 < 0.34;
        const inSmall = !inBig && small.d1 < 0.3;
        const chip = inBig ? big.cell : inSmall ? small.cell : 0.5;
        const matrix = fbm(u * 10, v * 10, period * 10, seed + 97, 3);
        const isChip = inBig || inSmall;
        tint[i] = isChip
          ? 0.8 + chip * 0.45 * contrast * 1.6
          : 1 + (matrix - 0.5) * 0.14;
        accent[i] = isChip ? clamp01(0.3 + chip * 0.5) : 0;
        height[i] = isChip ? 0.62 + chip * 0.1 : 0.48 + (matrix - 0.5) * 0.1;
        rough[i] = isChip ? -0.06 : 0.05;
      }
      break;
    }

    case "graniteSpeckle": {
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const a = valueNoise(u * 70, v * 70, period * 70, seed + 101);
        const b = valueNoise(u * 170, v * 170, period * 170, seed + 103);
        const c = fbm(u * 8, v * 8, period * 8, seed + 107, 3);
        const dark = a < 0.3 ? 1 : 0;
        const light = b > 0.78 ? 1 : 0;
        tint[i] = 1 + (c - 0.5) * 0.12 - dark * 0.22 * contrast * 2 + light * 0.2 * contrast * 2;
        accent[i] = dark * 0.5 * contrast;
        height[i] = 0.5 + (b - 0.5) * 0.14 - dark * 0.08;
        rough[i] = -0.04 + dark * 0.1;
      }
      break;
    }

    case "marbleVein": {
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        // warp the domain so veins wander rather than running straight
        const wx = u + fbm(u * 1.3, v * 1.3, period, seed + 109, 4) * 1.6;
        const wy = v + fbm(u * 1.1 + 5, v * 1.1 + 5, period, seed + 113, 4) * 1.6;
        const vein = ridged(wx * 1.6, wy * 1.6, period * 2, seed + 127, 5);
        const main = Math.pow(clamp01(vein), 7);
        const hair = Math.pow(clamp01(ridged(wx * 6, wy * 6, period * 6, seed + 131, 3)), 14);
        const cloud = fbm(u * 2.2, v * 2.2, period * 2, seed + 137, 4);
        const amount = clamp01(main * 1.1 + hair * 0.5);
        tint[i] = 1 + (cloud - 0.5) * 0.06 - amount * 0.1;
        accent[i] = clamp01(amount * contrast * 1.5);
        height[i] = 0.5 + amount * 0.1;
        rough[i] = amount * 0.05;
      }
      break;
    }

    case "tileGrid": {
      // one tile per pattern period, with a chamfered edge and a recessed joint
      const joint = 0.022;
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const tu = u - Math.floor(u);
        const tv = v - Math.floor(v);
        const edge = Math.min(tu, 1 - tu, tv, 1 - tv);
        const inJoint = edge < joint;
        const chamfer = clamp01((edge - joint) / 0.03);
        const cell = cellRandom(Math.floor(u), Math.floor(v), seed + 139);
        const body = fbm(u * 9, v * 9, period * 9, seed + 149, 3);
        const grainy = valueNoise(u * 40, v * 40, period * 40, seed + 151);
        tint[i] = inJoint ? 1 : 1 + (cell - 0.5) * 0.08 * contrast * 2 + (body - 0.5) * 0.07;
        accent[i] = inJoint ? 1 : 0;
        height[i] = inJoint ? 0.12 : 0.55 + chamfer * 0.35 + (grainy - 0.5) * 0.03;
        rough[i] = inJoint ? 0.5 : -0.04 + (body - 0.5) * 0.04;
      }
      break;
    }

    case "brushedMetal": {
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const streak = valueNoise(u * 2, v * 900, period * 900, seed + 157);
        const broad = valueNoise(u * 3, v * 90, period * 90, seed + 163);
        tint[i] = 1 + (streak - 0.5) * 0.1 * contrast * 2 + (broad - 0.5) * 0.06;
        height[i] = 0.5 + (streak - 0.5) * 0.22;
        // anisotropic-looking roughness: the streaks scatter along one axis
        rough[i] = (streak - 0.5) * 0.14 * contrast * 2;
      }
      break;
    }

    case "caneWeave": {
      // open lattice: two crossing bands with holes between
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const tu = (u * 2) % 1;
        const tv = (v * 2) % 1;
        const bandU = Math.abs(tu - 0.5) < 0.3 ? 1 : 0;
        const bandV = Math.abs(tv - 0.5) < 0.3 ? 1 : 0;
        const over = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 === 0;
        const hole = !bandU && !bandV ? 1 : 0;
        const h = hole
          ? 0
          : over
            ? bandU * (1 - Math.abs(tu - 0.5) * 2) + 0.2
            : bandV * (1 - Math.abs(tv - 0.5) * 2) + 0.2;
        const fibre = valueNoise(u * 140, v * 140, period * 140, seed + 167);
        tint[i] = hole ? 0.35 : 1 + (h - 0.6) * 0.2 * contrast * 2 + (fibre - 0.5) * 0.1;
        height[i] = clamp01(hole ? 0.05 : 0.4 + h * 0.5 + (fibre - 0.5) * 0.08);
        rough[i] = hole ? 0.3 : (1 - h) * 0.1;
      }
      break;
    }

    case "none":
    default: {
      for (let i = 0; i < n; i++) {
        const { u, v } = at(i);
        const soft = fbm(u * 3, v * 3, period * 3, seed + 173, 3);
        tint[i] = 1 + (soft - 0.5) * 0.12;
        height[i] = 0.5 + (soft - 0.5) * 0.3;
        rough[i] = (soft - 0.5) * 0.06;
      }
      break;
    }
  }

  return { tint, accent, height, rough };
}
