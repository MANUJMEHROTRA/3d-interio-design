/**
 * Deterministic value noise.
 *
 * Every texture in the app is generated from these functions rather than
 * downloaded, which means: no asset licensing, no CDN, no loading spinner, and
 * a texture whose physical tile size we can set exactly so a 300 mm tile reads
 * as 300 mm in every room. Determinism matters because a client who reloads
 * the share link must see the identical render.
 */

/** 32-bit integer hash. Same input always gives the same output. */
function hash2(x: number, y: number, seed: number): number {
  let h = x * 374761393 + y * 668265263 + seed * 2246822519;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Tileable value noise on an integer lattice of `period` cells. */
export function valueNoise(x: number, y: number, period: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const wrap = (v: number) => ((v % period) + period) % period;
  const x0 = wrap(xi);
  const x1 = wrap(xi + 1);
  const y0 = wrap(yi);
  const y1 = wrap(yi + 1);
  const u = smooth(xf);
  const v = smooth(yf);
  return lerp(
    lerp(hash2(x0, y0, seed), hash2(x1, y0, seed), u),
    lerp(hash2(x0, y1, seed), hash2(x1, y1, seed), u),
    v,
  );
}

/** Fractal sum of value noise. Tiles seamlessly at `period`. */
export function fbm(
  x: number,
  y: number,
  period: number,
  seed: number,
  octaves = 4,
  gain = 0.5,
): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * valueNoise(x * freq, y * freq, period * freq, seed + o * 101);
    total += amplitude;
    amplitude *= gain;
    freq *= 2;
  }
  return sum / total;
}

/** Ridged noise — the basis for marble veining and brushed metal. */
export function ridged(x: number, y: number, period: number, seed: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    const n = Math.abs(valueNoise(x * freq, y * freq, period * freq, seed + o * 57) * 2 - 1);
    sum += amplitude * (1 - n);
    total += amplitude;
    amplitude *= 0.5;
    freq *= 2;
  }
  return sum / total;
}

/**
 * Worley / cellular noise, returning the distance to the nearest feature
 * point. Leather grain and terrazzo chips are both this.
 */
export function worley(x: number, y: number, period: number, seed: number): { d1: number; d2: number; cell: number } {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d1 = Infinity;
  let d2 = Infinity;
  let cell = 0;
  const wrap = (v: number) => ((v % period) + period) % period;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const cx = xi + ox;
      const cy = yi + oy;
      const wx = wrap(cx);
      const wy = wrap(cy);
      const px = cx + hash2(wx, wy, seed);
      const py = cy + hash2(wx, wy, seed + 7919);
      const d = Math.hypot(px - x, py - y);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        cell = hash2(wx, wy, seed + 104729);
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return { d1, d2, cell };
}

/** Random number in [0,1) from a lattice cell — for per-plank and per-tile variation. */
export const cellRandom = (x: number, y: number, seed: number): number => hash2(x, y, seed);

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
