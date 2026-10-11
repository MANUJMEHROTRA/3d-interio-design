import type { Finish, TexturePattern } from "@layoutcraft/core";
import * as THREE from "three";
import { clamp01 } from "./noise.js";
import { generatePattern } from "./patterns.js";

export interface FinishMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  /** Physical size of one generated tile, mm. */
  tileMm: number;
}

const cache = new Map<string, FinishMaps>();

/**
 * How many repeats of the recipe's physical tile fit in one generated texture.
 *
 * This is the single most important number for whether a surface reads at the
 * right scale. A generated texture covers `tileMm × period` millimetres, so a
 * high period makes every feature in the pattern that many times larger in the
 * world. Plaster at period 4 gives 12 cm blobs — which is popcorn ceiling, not
 * paint. Patterns whose features should stay small get a period of 1; only
 * genuinely tiny repeats like a fabric weave can afford a high one.
 */
const PERIODS: Partial<Record<TexturePattern, number>> = {
  plaster: 1,
  concrete: 1,
  woodPlank: 1,
  woodGrain: 1,
  marbleVein: 1,
  terrazzo: 1,
  graniteSpeckle: 1,
  tileGrid: 2,
  brushedMetal: 2,
  leatherGrain: 2,
  weave: 4,
  linen: 4,
  pile: 4,
  caneWeave: 3,
  none: 1,
};

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

function makeCanvas(size: number): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D } {
  const canvas =
    typeof document !== "undefined"
      ? Object.assign(document.createElement("canvas"), { width: size, height: size })
      : new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("2D canvas is unavailable, so textures cannot be generated");
  return { canvas: canvas as HTMLCanvasElement, ctx };
}

/**
 * Sobel the height field into a tangent-space normal map.
 *
 * The gradient is divided by the kernel weight (4 per side) so `strength` is
 * an honest slope rather than an arbitrary number. Getting this wrong is very
 * visible: an unnormalised Sobel turns emulsion paint into popcorn stucco and
 * oak into tree bark, because every surface ends up with 30° micro-facets.
 */
function heightToNormal(height: Float32Array, size: number, strength: number): ImageData {
  const out = new ImageData(size, size);
  const at = (x: number, y: number) =>
    height[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      // /4 normalises the Sobel kernel so `strength` is a real slope
      let nx = (dx / 4) * strength;
      let ny = (dy / 4) * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      const i = (y * size + x) * 4;
      out.data[i] = (nx * 0.5 + 0.5) * 255;
      out.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      out.data[i + 2] = (nz / len) * 255;
      out.data[i + 3] = 255;
    }
  }
  return out;
}

function toTexture(
  imageData: ImageData,
  size: number,
  colorSpace: THREE.ColorSpace,
  anisotropy: number,
  tileMm: number,
): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(size);
  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = colorSpace;
  texture.anisotropy = anisotropy;
  // Meshes carry UVs measured in metres, so the repeat is simply how many
  // tiles fit in a metre. That is what keeps a 300 mm tile 300 mm across on
  // every surface in the project without the mesh knowing the material.
  const perMetre = 1000 / tileMm;
  texture.repeat.set(perMetre, perMetre);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Build (and cache) the three maps for one finish.
 *
 * Keyed on everything that affects the result, so switching style re-uses maps
 * the project has already paid for and only generates what is genuinely new.
 */
export function finishMaps(
  finish: Finish,
  opts: { size?: number; anisotropy?: number } = {},
): FinishMaps | null {
  const recipe = finish.texture;
  if (!recipe || recipe.pattern === "none") return null;

  const size = opts.size ?? 512;
  const anisotropy = opts.anisotropy ?? 8;
  const contrast = recipe.contrast ?? 0.4;
  const relief = finish.relief ?? 0.6;
  const key = [
    recipe.pattern,
    recipe.tileMm,
    recipe.accent ?? "",
    contrast,
    relief,
    finish.color,
    finish.roughness ?? "",
    size,
  ].join("|");

  const hit = cache.get(key);
  if (hit) return hit;

  const period = PERIODS[recipe.pattern] ?? 2;

  const buffers = generatePattern(recipe.pattern, {
    size,
    period,
    contrast,
    seed: Math.round(recipe.tileMm),
  });

  const [br, bg, bb] = hexToRgb(finish.color);
  const [ar, ag, ab] = hexToRgb(recipe.accent ?? finish.color);
  const baseRough = finish.roughness ?? 0.6;

  const albedo = new ImageData(size, size);
  const roughness = new ImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const t = buffers.tint[i]!;
    const a = buffers.accent[i]!;
    const r = clamp01((br * t * (1 - a) + ar * a) / 255) * 255;
    const g = clamp01((bg * t * (1 - a) + ag * a) / 255) * 255;
    const b = clamp01((bb * t * (1 - a) + ab * a) / 255) * 255;
    const j = i * 4;
    albedo.data[j] = r;
    albedo.data[j + 1] = g;
    albedo.data[j + 2] = b;
    albedo.data[j + 3] = 255;

    const rv = clamp01(baseRough + buffers.rough[i]!) * 255;
    roughness.data[j] = rv;
    roughness.data[j + 1] = rv;
    roughness.data[j + 2] = rv;
    roughness.data[j + 3] = 255;
  }

  // one generated tile covers `period` repeats of the recipe's physical size
  const tileMm = recipe.tileMm * period;
  const maps: FinishMaps = {
    map: toTexture(albedo, size, THREE.SRGBColorSpace, anisotropy, tileMm),
    normalMap: toTexture(
      heightToNormal(buffers.height, size, relief * 0.75),
      size,
      THREE.NoColorSpace,
      anisotropy,
      tileMm,
    ),
    roughnessMap: toTexture(roughness, size, THREE.NoColorSpace, anisotropy, tileMm),
    tileMm,
  };

  cache.set(key, maps);
  return maps;
}

/** Free every generated texture. Called when the viewer unmounts for good. */
export function disposeTextureCache(): void {
  for (const maps of cache.values()) {
    maps.map.dispose();
    maps.normalMap.dispose();
    maps.roughnessMap.dispose();
  }
  cache.clear();
}

export { generatePattern } from "./patterns.js";
