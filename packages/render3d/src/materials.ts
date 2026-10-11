import type { DesignStyle, Finish, MaterialKey, SurfaceClass } from "@layoutcraft/core";
import { resolveFinish } from "@layoutcraft/core";
import * as THREE from "three";
import { finishMaps } from "./textures/index.js";

/**
 * Sensible PBR defaults per surface class, so a finish only has to override
 * what is unusual about it. These numbers are the difference between "plastic"
 * and "that looks like oak".
 */
const SURFACE_DEFAULTS: Record<
  SurfaceClass,
  { roughness: number; metalness: number; clearcoat: number; sheen: number; transmission: number; ior: number }
> = {
  matte: { roughness: 0.92, metalness: 0, clearcoat: 0, sheen: 0, transmission: 0, ior: 1.5 },
  satin: { roughness: 0.3, metalness: 0, clearcoat: 0.4, sheen: 0, transmission: 0, ior: 1.5 },
  gloss: { roughness: 0.1, metalness: 0, clearcoat: 0.8, sheen: 0, transmission: 0, ior: 1.5 },
  wood: { roughness: 0.5, metalness: 0, clearcoat: 0.22, sheen: 0, transmission: 0, ior: 1.5 },
  // sheen is what makes upholstery read as cloth rather than painted foam
  fabric: { roughness: 0.95, metalness: 0, clearcoat: 0, sheen: 0.7, transmission: 0, ior: 1.5 },
  leather: { roughness: 0.56, metalness: 0, clearcoat: 0.18, sheen: 0.2, transmission: 0, ior: 1.5 },
  pile: { roughness: 0.99, metalness: 0, clearcoat: 0, sheen: 0.9, transmission: 0, ior: 1.5 },
  stone: { roughness: 0.4, metalness: 0, clearcoat: 0.25, sheen: 0, transmission: 0, ior: 1.5 },
  metal: { roughness: 0.3, metalness: 1, clearcoat: 0, sheen: 0, transmission: 0, ior: 2.5 },
  glass: { roughness: 0.03, metalness: 0, clearcoat: 0, sheen: 0, transmission: 0.92, ior: 1.52 },
  mirror: { roughness: 0.015, metalness: 1, clearcoat: 0, sheen: 0, transmission: 0, ior: 2.5 },
  foliage: { roughness: 0.74, metalness: 0, clearcoat: 0.1, sheen: 0.3, transmission: 0.12, ior: 1.4 },
  emissive: { roughness: 1, metalness: 0, clearcoat: 0, sheen: 0, transmission: 0, ior: 1.5 },
};

export interface MaterialQuality {
  /** Texture resolution. Draft halves it, which roughly quarters generation cost. */
  textureSize: number;
  anisotropy: number;
  /** Transmission is expensive; draft mode fakes glass with opacity instead. */
  allowTransmission: boolean;
  /** Procedural maps off entirely — for the 2D plan's material swatches. */
  textures: boolean;
}

export const QUALITY: Record<"draft" | "standard" | "high", MaterialQuality> = {
  draft: { textureSize: 256, anisotropy: 2, allowTransmission: false, textures: true },
  standard: { textureSize: 512, anisotropy: 8, allowTransmission: true, textures: true },
  high: { textureSize: 1024, anisotropy: 16, allowTransmission: true, textures: true },
};

export interface MaterialCache {
  get: (key: MaterialKey, overrides?: Partial<Record<MaterialKey, MaterialKey>>) => THREE.Material;
  dispose: () => void;
}

function buildMaterial(
  finish: Finish,
  quality: MaterialQuality,
  envIntensity: number,
): THREE.Material {
  const defaults = SURFACE_DEFAULTS[finish.surface];
  const color = new THREE.Color(finish.color).convertSRGBToLinear();

  if (finish.surface === "emissive") {
    return new THREE.MeshStandardMaterial({
      color: 0x000000,
      emissive: color,
      emissiveIntensity: 2.6,
      toneMapped: true,
    });
  }

  const maps = quality.textures ? finishMaps(finish, { size: quality.textureSize, anisotropy: quality.anisotropy }) : null;
  const transmission = quality.allowTransmission ? defaults.transmission : 0;
  const isGlass = finish.surface === "glass";

  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: finish.roughness ?? defaults.roughness,
    metalness: finish.metalness ?? defaults.metalness,
    clearcoat: finish.clearcoat ?? defaults.clearcoat,
    clearcoatRoughness: 0.14,
    sheen: defaults.sheen,
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(finish.color).lerp(new THREE.Color(0xffffff), 0.55),
    ior: defaults.ior,
    envMapIntensity: envIntensity,
    side: THREE.FrontSide,
  });

  if (transmission > 0) {
    material.transmission = transmission;
    material.thickness = isGlass ? 8 : 2;
    material.attenuationColor = color;
    material.attenuationDistance = isGlass ? 2.5 : 0.4;
    material.transparent = false;
  } else if (finish.opacity !== undefined && finish.opacity < 1) {
    material.transparent = true;
    material.opacity = finish.opacity;
    material.depthWrite = finish.opacity > 0.7;
  }

  if (maps) {
    material.map = maps.map;
    material.normalMap = maps.normalMap;
    material.roughnessMap = maps.roughnessMap;
    material.normalScale = new THREE.Vector2(1, 1);
    // store the physical tile size so the mesh builder can set UV repeat
    (material as THREE.MeshPhysicalMaterial & { userData: { tileMm: number } }).userData = {
      tileMm: maps.tileMm,
    };
  }

  return material;
}

/**
 * One cache per (style, quality) pair.
 *
 * Materials are shared across every mesh that uses the same finish, which is
 * what keeps a 700-part flat down to a few dozen draw-call material switches
 * instead of a few hundred materials.
 */
export function createMaterialCache(
  style: DesignStyle,
  quality: MaterialQuality,
  envIntensity = 1,
): MaterialCache {
  const built = new Map<string, THREE.Material>();

  const get = (
    key: MaterialKey,
    overrides?: Partial<Record<MaterialKey, MaterialKey>>,
  ): THREE.Material => {
    const resolvedKey = overrides?.[key] ?? key;
    const existing = built.get(resolvedKey);
    if (existing) return existing;
    const finish = resolveFinish(style, key, overrides);
    const material = buildMaterial(finish, quality, envIntensity);
    material.name = `${style.id}:${resolvedKey}`;
    built.set(resolvedKey, material);
    return material;
  };

  return {
    get,
    dispose: () => {
      for (const m of built.values()) m.dispose();
      built.clear();
    },
  };
}

/** The physical tile size a material was generated at, for UV scaling. */
export const tileMmOf = (material: THREE.Material): number =>
  (material.userData as { tileMm?: number } | undefined)?.tileMm ?? 0;

/** A flat colour material, for selection highlights and the print preview. */
export function solidMaterial(hex: string, opts: { emissive?: boolean } = {}): THREE.Material {
  const color = new THREE.Color(hex).convertSRGBToLinear();
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.45,
    metalness: 0.05,
    emissive: opts.emissive ? color : new THREE.Color(0x000000),
    emissiveIntensity: opts.emissive ? 0.35 : 0,
  });
}
