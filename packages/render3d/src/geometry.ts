import type { Box3, MaterialKey, Part, PartShape, PlacedItem } from "@layoutcraft/core";
import { itemSize, localParts } from "@layoutcraft/core";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Coordinate convention
 * ---------------------
 * The domain works in plan space: x right, y down the page, z up, millimetres.
 * three.js wants Y up and metres. The mapping used everywhere in this package:
 *
 *     three.x =  plan.x / 1000
 *     three.y =  plan.z / 1000      (height)
 *     three.z =  plan.y / 1000
 *
 * It is right-handed and keeps plan "down" as three "+Z", so a camera looking
 * down -Z sees the plan the same way up as the 2D editor does.
 */

const M = 1000;

interface Span {
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sz: number;
}

/** A plan-space box as a three.js centre and size, in metres. */
function spanOf(b: Box3): Span {
  return {
    cx: (b.x0 + b.x1) / 2 / M,
    cy: (b.z0 + b.z1) / 2 / M,
    cz: (b.y0 + b.y1) / 2 / M,
    sx: Math.abs(b.x1 - b.x0) / M,
    sy: Math.abs(b.z1 - b.z0) / M,
    sz: Math.abs(b.y1 - b.y0) / M,
  };
}

/* ------------------------------------------------------------------ *
 * UVs
 * ------------------------------------------------------------------ */

/**
 * Box-project UVs in metres.
 *
 * Every material's textures carry a repeat of 1000/tileMm, so a UV measured in
 * metres makes a 300 mm tile come out 300 mm across on a wall, a floor and a
 * counter alike — without the mesh builder knowing anything about the material.
 */
function applyWorldUvs(input: THREE.BufferGeometry): THREE.BufferGeometry {
  const geo = input.index ? input.toNonIndexed() : input;
  const pos = geo.getAttribute("position");
  const nor = geo.getAttribute("normal");
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (ny >= nx && ny >= nz) {
      // floors, tops and ceilings
      u = pos.getX(i);
      v = pos.getZ(i);
    } else if (nx >= nz) {
      u = pos.getZ(i);
      v = pos.getY(i);
    } else {
      u = pos.getX(i);
      v = pos.getY(i);
    }
    uv[i * 2] = u;
    uv[i * 2 + 1] = v;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  if (geo !== input) input.dispose();
  return geo;
}

/**
 * Scale a revolved shape's own UVs into metres.
 *
 * The result is de-indexed to match `applyWorldUvs`. Every geometry this
 * module produces must agree on indexing, because `mergeGeometries` refuses a
 * mixed batch — and it refuses it by returning null, which silently drops the
 * furniture rather than throwing. That failure mode cost a set of chair legs.
 */
function scaleUvs(input: THREE.BufferGeometry, su: number, sv: number): THREE.BufferGeometry {
  const geo = input.index ? input.toNonIndexed() : input;
  if (geo !== input) input.dispose();
  const uv = geo.getAttribute("uv");
  if (!uv) return applyWorldUvs(geo);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return geo;
}

/* ------------------------------------------------------------------ *
 * Rounded box
 * ------------------------------------------------------------------ */

/**
 * A true rounded box: a subdivided box whose vertices are projected onto the
 * rounded-box surface. Clamping each vertex into the inner box and pushing it
 * out by the radius gives exactly the right shape with smooth corner normals,
 * which is what a sofa arm or a seat cushion needs.
 */
function roundedBoxGeometry(
  sx: number,
  sy: number,
  sz: number,
  radius: number,
  segments: number,
): THREE.BufferGeometry {
  const r = Math.max(0, Math.min(radius, sx / 2 - 1e-4, sy / 2 - 1e-4, sz / 2 - 1e-4));
  if (r <= 1e-4) return new THREE.BoxGeometry(sx, sy, sz);

  const geo = new THREE.BoxGeometry(sx, sy, sz, segments, segments, segments);
  const pos = geo.getAttribute("position");
  const hx = sx / 2 - r;
  const hy = sy / 2 - r;
  const hz = sz / 2 - r;
  const v = new THREE.Vector3();
  const q = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    q.set(
      Math.max(-hx, Math.min(hx, v.x)),
      Math.max(-hy, Math.min(hy, v.y)),
      Math.max(-hz, Math.min(hz, v.z)),
    );
    const d = v.clone().sub(q);
    const len = d.length();
    if (len > 1e-6) {
      d.multiplyScalar(r / len);
      pos.setXYZ(i, q.x + d.x, q.y + d.y, q.z + d.z);
    } else {
      pos.setXYZ(i, q.x, q.y, q.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/* ------------------------------------------------------------------ *
 * Shapes
 * ------------------------------------------------------------------ */

function buildShape(shape: PartShape): THREE.BufferGeometry | null {
  switch (shape.k) {
    case "box": {
      const s = spanOf(shape.box);
      if (s.sx <= 0 || s.sy <= 0 || s.sz <= 0) return null;
      const radius = (shape.radius ?? 0) / M;
      const bevel = (shape.bevel ?? 0) / M;
      // a radius rounds the whole form; a bevel only takes the hard edge off
      const r = radius > 0 ? radius : Math.min(bevel, 0.006);
      const geo =
        r > 0.0005
          ? roundedBoxGeometry(s.sx, s.sy, s.sz, r, radius > 0 ? 4 : 2)
          : new THREE.BoxGeometry(s.sx, s.sy, s.sz);
      geo.translate(s.cx, s.cy, s.cz);
      return applyWorldUvs(geo);
    }

    case "cushion": {
      const s = spanOf(shape.box);
      if (s.sx <= 0 || s.sy <= 0 || s.sz <= 0) return null;
      const r = Math.min((shape.radius ?? 24) / M, s.sx / 2, s.sy / 2, s.sz / 2);
      const geo = roundedBoxGeometry(s.sx, s.sy, s.sz, r, 6);
      // bow the upper surface up by `crown` at the centre, tapering to the edge
      const crown = (shape.crown ?? 14) / M;
      if (crown > 0) {
        const pos = geo.getAttribute("position");
        for (let i = 0; i < pos.count; i++) {
          const y = pos.getY(i);
          if (y <= 0) continue;
          const fx = 1 - Math.min(1, Math.abs(pos.getX(i)) / (s.sx / 2));
          const fz = 1 - Math.min(1, Math.abs(pos.getZ(i)) / (s.sz / 2));
          const falloff = Math.sin(fx * Math.PI * 0.5) * Math.sin(fz * Math.PI * 0.5);
          const weight = y / (s.sy / 2);
          pos.setY(i, y + crown * falloff * weight);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      }
      geo.translate(s.cx, s.cy, s.cz);
      return applyWorldUvs(geo);
    }

    case "slab": {
      const s = spanOf(shape.box);
      if (s.sx <= 0 || s.sy <= 0 || s.sz <= 0) return null;
      const edge = shape.edge ?? "eased";
      const r =
        edge === "bullnose" ? s.sy / 2 - 1e-4 : edge === "eased" ? Math.min(0.004, s.sy / 3) : 0;
      const geo =
        r > 0.0005
          ? roundedBoxGeometry(s.sx, s.sy, s.sz, r, edge === "bullnose" ? 5 : 2)
          : new THREE.BoxGeometry(s.sx, s.sy, s.sz);
      geo.translate(s.cx, s.cy, s.cz);
      return applyWorldUvs(geo);
    }

    case "cyl": {
      const h = Math.abs(shape.z1 - shape.z0) / M;
      if (h <= 0) return null;
      const rBottom = Math.max(shape.r0, 0.1) / M;
      const rTop = Math.max(shape.r1 ?? shape.r0, 0.1) / M;
      const geo = new THREE.CylinderGeometry(
        rTop,
        rBottom,
        h,
        shape.segments ?? 20,
        1,
        false,
      );
      geo.translate(shape.cx / M, (shape.z0 + shape.z1) / 2 / M, shape.cy / M);
      const rAvg = (rTop + rBottom) / 2;
      return scaleUvs(geo, 2 * Math.PI * rAvg, h);
    }

    case "lathe": {
      const z0 = shape.z0 / M;
      const z1 = shape.z1 / M;
      const h = Math.abs(z1 - z0);
      if (h <= 0 || shape.profile.length < 2) return null;
      const points = [...shape.profile]
        .sort((a, b) => a[1] - b[1])
        .map(([r, t]) => new THREE.Vector2(Math.max(r / M, 0.0008), z0 + t * (z1 - z0)));
      const geo = new THREE.LatheGeometry(points, shape.segments ?? 24);
      geo.translate(shape.cx / M, 0, shape.cy / M);
      const rAvg =
        shape.profile.reduce((sum, [r]) => sum + r, 0) / shape.profile.length / M;
      return scaleUvs(geo, 2 * Math.PI * rAvg, h);
    }

    case "sheet": {
      // given a real 6 mm thickness: a zero-thickness plane is invisible from
      // behind and causes shadow and reflection artefacts
      const t = 6;
      const b = { ...shape.box };
      if (shape.axis === "z") {
        const mid = (b.z0 + b.z1) / 2;
        b.z0 = mid - t / 2;
        b.z1 = mid + t / 2;
      } else if (shape.axis === "y") {
        const mid = (b.y0 + b.y1) / 2;
        b.y0 = mid - t / 2;
        b.y1 = mid + t / 2;
      } else {
        const mid = (b.x0 + b.x1) / 2;
        b.x0 = mid - t / 2;
        b.x1 = mid + t / 2;
      }
      const s = spanOf(b);
      if (s.sx <= 0 || s.sy <= 0 || s.sz <= 0) return null;
      const geo = new THREE.BoxGeometry(s.sx, s.sy, s.sz);
      geo.translate(s.cx, s.cy, s.cz);
      return applyWorldUvs(geo);
    }

    case "ball": {
      const r = shape.r / M;
      if (r <= 0) return null;
      const geo = new THREE.SphereGeometry(r, 18, 12);
      if (shape.squash && shape.squash !== 1) geo.scale(1, shape.squash, 1);
      geo.translate(shape.cx / M, shape.cz / M, shape.cy / M);
      return scaleUvs(geo, 2 * Math.PI * r, Math.PI * r);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Item assembly
 * ------------------------------------------------------------------ */

export interface ItemMeshGroup {
  material: MaterialKey;
  geometry: THREE.BufferGeometry;
  castShadow: boolean;
}

const itemCache = new Map<string, ItemMeshGroup[]>();

const cacheKey = (item: PlacedItem): string => {
  const { w, d, h } = itemSize(item);
  const overrides = item.finishes ? JSON.stringify(item.finishes) : "";
  return `${item.key}|${w}|${d}|${h}|${item.z ?? 0}|${overrides}`;
};

/**
 * Build one merged geometry per material for a catalog item.
 *
 * Merging by material is what keeps the scene cheap: a 73-item flat with ~700
 * parts collapses to roughly one mesh per material per distinct item size, so a
 * dining set of six identical chairs shares a single cached geometry set and
 * draws in a handful of calls instead of a hundred.
 */
export function buildItemGeometry(item: PlacedItem): ItemMeshGroup[] {
  const key = cacheKey(item);
  const hit = itemCache.get(key);
  if (hit) return hit;

  const parts: Part[] = localParts(item);
  const byMaterial = new Map<string, { geos: THREE.BufferGeometry[]; shadow: boolean }>();

  for (const part of parts) {
    const geo = buildShape(part.shape);
    if (!geo) continue;
    const slot = part.m;
    const bucket = byMaterial.get(slot) ?? { geos: [], shadow: false };
    bucket.geos.push(geo);
    if (!part.noShadow) bucket.shadow = true;
    byMaterial.set(slot, bucket);
  }

  const groups: ItemMeshGroup[] = [];
  for (const [material, { geos, shadow }] of byMaterial) {
    const merged = geos.length === 1 ? geos[0]! : mergeGeometries(geos, false);
    if (!merged) {
      // Losing a merge means losing visible furniture, so it is loud rather
      // than silent. The individual geometries are still drawn.
      console.warn(
        `[layoutcraft] could not merge ${geos.length} "${material}" parts of ${item.key}; drawing them separately`,
      );
      for (const geometry of geos) {
        geometry.computeBoundingSphere();
        groups.push({ material: material as MaterialKey, geometry, castShadow: shadow });
      }
      continue;
    }
    if (geos.length > 1) for (const g of geos) g.dispose();
    merged.computeBoundingSphere();
    groups.push({ material: material as MaterialKey, geometry: merged, castShadow: shadow });
  }

  itemCache.set(key, groups);
  return groups;
}

/** Merge a set of plan-space boxes into one geometry — used for walls and floors. */
export function buildBoxes(boxes: Box3[]): THREE.BufferGeometry | null {
  const geos: THREE.BufferGeometry[] = [];
  for (const b of boxes) {
    const s = spanOf(b);
    if (s.sx <= 0 || s.sy <= 0 || s.sz <= 0) continue;
    const geo = new THREE.BoxGeometry(s.sx, s.sy, s.sz);
    geo.translate(s.cx, s.cy, s.cz);
    geos.push(applyWorldUvs(geo));
  }
  if (!geos.length) return null;
  const merged = geos.length === 1 ? geos[0]! : mergeGeometries(geos, false);
  if (geos.length > 1) for (const g of geos) g.dispose();
  if (merged) merged.computeBoundingSphere();
  return merged;
}

/** Plan millimetres to a three.js vector. */
export const toScene = (x: number, y: number, z = 0): THREE.Vector3 =>
  new THREE.Vector3(x / M, z / M, y / M);

/** The Y rotation, in radians, for a plan rotation in degrees. */
export const yawFor = (rot: number): number => (-rot * Math.PI) / 180;

export function disposeGeometryCache(): void {
  for (const groups of itemCache.values()) {
    for (const g of groups) g.geometry.dispose();
  }
  itemCache.clear();
}

export const METRES = M;
