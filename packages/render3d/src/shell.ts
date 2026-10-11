import type { Box3, MaterialKey, Opening, Project, Room } from "@layoutcraft/core";
import {
  innerRect,
  openingsOn,
  ROOM_TYPES,
  SKIRTING_H,
  SKIRTING_T,
  WALL_T,
  wallSolids,
} from "@layoutcraft/core";
import * as THREE from "three";
import { buildBoxes } from "./geometry.js";

export interface ShellMesh {
  material: MaterialKey;
  geometry: THREE.BufferGeometry;
  castShadow: boolean;
  receiveShadow: boolean;
  /** Set for floors so the viewer can raycast against them for room picking. */
  roomId?: string;
}

const FRAME = 45;
const LEAF_T = 40;
const GLASS_T = 8;

/** Clip a box to a ceiling, returning null if nothing is left. */
function clipZ(b: Box3, maxZ: number): Box3 | null {
  if (b.z0 >= maxZ) return null;
  return b.z1 <= maxZ ? b : { ...b, z1: maxZ };
}

const pushClipped = (list: Box3[], b: Box3, maxZ: number) => {
  const c = clipZ(b, maxZ);
  if (c && c.z1 - c.z0 > 1) list.push(c);
};

/* ------------------------------------------------------------------ *
 * Skirting
 * ------------------------------------------------------------------ */

/**
 * Skirting along a room's inner perimeter, broken at every doorway.
 *
 * It is a 100 mm detail that nobody asks for and everybody notices: without
 * it, the junction between wall and floor is a hard line that reads as
 * untextured geometry.
 */
function skirtingBoxes(room: Room, openings: Opening[]): Box3[] {
  const inner = innerRect(room);
  const out: Box3[] = [];
  const t = SKIRTING_T;
  const h = SKIRTING_H;

  const doorways = openings.filter((o) => o.sill === 0);

  /** Spans along one wall that a doorway interrupts. */
  const gapsOn = (orientation: "h" | "v", at: number): Array<[number, number]> =>
    doorways
      .filter((o) => o.o === orientation && Math.abs((o.o === "h" ? o.y : o.x) - at) < 60)
      .map((o) => {
        const start = o.o === "h" ? o.x : o.y;
        return [start - FRAME, start + o.w + FRAME] as [number, number];
      })
      .sort((a, b) => a[0] - b[0]);

  const run = (
    orientation: "h" | "v",
    at: number,
    from: number,
    to: number,
    make: (a: number, b: number) => Box3,
  ) => {
    let cursor = from;
    for (const [g0, g1] of gapsOn(orientation, at)) {
      if (g0 > cursor) out.push(make(cursor, Math.min(g0, to)));
      cursor = Math.max(cursor, g1);
    }
    if (cursor < to) out.push(make(cursor, to));
  };

  run("h", room.y, inner.x, inner.x + inner.w, (a, b) => ({
    x0: a, y0: inner.y, z0: 0, x1: b, y1: inner.y + t, z1: h,
  }));
  run("h", room.y + room.d, inner.x, inner.x + inner.w, (a, b) => ({
    x0: a, y0: inner.y + inner.d - t, z0: 0, x1: b, y1: inner.y + inner.d, z1: h,
  }));
  run("v", room.x, inner.y, inner.y + inner.d, (a, b) => ({
    x0: inner.x, y0: a, z0: 0, x1: inner.x + t, y1: b, z1: h,
  }));
  run("v", room.x + room.w, inner.y, inner.y + inner.d, (a, b) => ({
    x0: inner.x + inner.w - t, y0: a, z0: 0, x1: inner.x + inner.w, y1: b, z1: h,
  }));

  return out;
}

/* ------------------------------------------------------------------ *
 * Openings
 * ------------------------------------------------------------------ */

interface OpeningParts {
  frame: Box3[];
  leaf: Box3[];
  glass: Box3[];
  sill: Box3[];
  hardware: Box3[];
  /** Leaves need rotating about their hinge, which a box cannot express. */
  leafTransform: THREE.Matrix4 | null;
}

/**
 * Line one opening with a frame and fill it appropriately.
 *
 * Doors are drawn 75° open. A closed door hides the room behind it and a door
 * drawn flat to the wall hides the swing; 75° shows both the leaf and which
 * way it goes, which is what a client and a carpenter each need to see.
 */
function openingParts(op: Opening, maxZ: number): OpeningParts {
  const parts: OpeningParts = {
    frame: [],
    leaf: [],
    glass: [],
    sill: [],
    hardware: [],
    leafTransform: null,
  };

  const headZ = Math.min(op.sill + op.h, maxZ);
  if (headZ - op.sill <= 1) return parts;

  const half = WALL_T / 2 + 10;
  const along0 = op.o === "h" ? op.x : op.y;
  const along1 = along0 + op.w;
  const across = op.o === "h" ? op.y : op.x;

  /** Build a box from along-wall span, across-wall span and height span. */
  const B = (a0: number, a1: number, c0: number, c1: number, z0: number, z1: number): Box3 =>
    op.o === "h"
      ? { x0: a0, y0: across + c0, z0, x1: a1, y1: across + c1, z1 }
      : { x0: across + c0, y0: a0, z0, x1: across + c1, y1: a1, z1 };

  // frame lining: two jambs and a head, set inside the reveal
  pushClipped(parts.frame, B(along0, along0 + FRAME, -half, half, op.sill, headZ), maxZ);
  pushClipped(parts.frame, B(along1 - FRAME, along1, -half, half, op.sill, headZ), maxZ);
  if (op.sill + op.h <= maxZ) {
    parts.frame.push(B(along0, along1, -half, half, headZ - FRAME, headZ));
  }

  const clearA0 = along0 + FRAME;
  const clearA1 = along1 - FRAME;
  const clearW = clearA1 - clearA0;
  if (clearW <= 10) return parts;

  const isGlazed = op.kind === "window" || op.kind === "frenchWindow";

  if (op.sill > 0) {
    // window board, projecting slightly into the room
    parts.sill.push(B(along0 - 30, along1 + 30, -half, half + 30, op.sill - 40, op.sill));
  }

  if (op.kind === "cased") {
    // a cased opening is just the lining — nothing fills it
    return parts;
  }

  if (isGlazed) {
    const topZ = headZ - FRAME;
    const botZ = op.sill + (op.kind === "frenchWindow" ? FRAME : FRAME);
    if (topZ - botZ > 10) {
      // mullions divide the glazing into leaves of about 900 mm
      const leaves = Math.max(1, Math.round(clearW / 900));
      const leafW = clearW / leaves;
      for (let i = 0; i < leaves; i++) {
        const a0 = clearA0 + i * leafW;
        const a1 = a0 + leafW;
        // sash frame
        pushClipped(parts.frame, B(a0, a0 + 30, -20, 20, botZ, topZ), maxZ);
        pushClipped(parts.frame, B(a1 - 30, a1, -20, 20, botZ, topZ), maxZ);
        pushClipped(parts.frame, B(a0, a1, -20, 20, botZ, botZ + 30), maxZ);
        pushClipped(parts.frame, B(a0, a1, -20, 20, topZ - 30, topZ), maxZ);
        pushClipped(
          parts.glass,
          B(a0 + 30, a1 - 30, -GLASS_T / 2, GLASS_T / 2, botZ + 30, topZ - 30),
          maxZ,
        );
      }
      if (op.kind === "window") {
        parts.hardware.push(B(clearA1 - 160, clearA1 - 60, 20, 60, (botZ + topZ) / 2 - 15, (botZ + topZ) / 2 + 15));
      }
    }
    return parts;
  }

  if (op.kind === "sliding") {
    // two leaves on a track, one half-open
    const leafW = clearW / 2 + 60;
    pushClipped(parts.leaf, B(clearA0, clearA0 + leafW, -40, -4, op.sill, headZ - FRAME), maxZ);
    pushClipped(parts.leaf, B(clearA1 - leafW, clearA1, 4, 40, op.sill, headZ - FRAME), maxZ);
    parts.hardware.push(B(clearA0 + leafW - 110, clearA0 + leafW - 50, -46, -36, 950, 1150));
    return parts;
  }

  // a hinged door: build the leaf flat, then rotate it about the hinge jamb
  const leafTop = headZ - FRAME;
  parts.leaf.push(B(clearA0, clearA1, -LEAF_T / 2, LEAF_T / 2, op.sill, leafTop));
  // lever handle on the opposite edge to the hinge
  const handleA = op.hinge === "end" ? clearA0 + 70 : clearA1 - 70;
  parts.hardware.push(B(handleA - 25, handleA + 25, -LEAF_T / 2 - 28, LEAF_T / 2 + 28, 1020, 1070));
  parts.hardware.push(B(handleA - 15, handleA + 95, LEAF_T / 2, LEAF_T / 2 + 22, 1030, 1060));

  const angle = (op.swing === -1 ? -1 : 1) * (op.hinge === "end" ? -1 : 1) * (75 * Math.PI) / 180;
  // hinge line, in plan millimetres
  const hingeAlong = op.hinge === "end" ? clearA1 : clearA0;
  const hx = op.o === "h" ? hingeAlong : across;
  const hy = op.o === "h" ? across : hingeAlong;
  const pivot = new THREE.Vector3(hx / 1000, 0, hy / 1000);
  parts.leafTransform = new THREE.Matrix4()
    .makeTranslation(pivot.x, pivot.y, pivot.z)
    .multiply(new THREE.Matrix4().makeRotationY(op.o === "h" ? angle : angle))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));

  return parts;
}

/* ------------------------------------------------------------------ *
 * Whole shell
 * ------------------------------------------------------------------ */

export interface ShellOptions {
  /** Wall height, mm. Lower than the ceiling gives the cutaway doll's-house view. */
  wallHeight: number;
  showCeiling: boolean;
}

export function buildShell(project: Project, options: ShellOptions): ShellMesh[] {
  const { wallHeight, showCeiling } = options;
  const meshes: ShellMesh[] = [];

  const byMaterial = new Map<MaterialKey, Box3[]>();
  const add = (m: MaterialKey, b: Box3 | null) => {
    if (!b || b.z1 - b.z0 <= 0) return;
    const list = byMaterial.get(m) ?? [];
    list.push(b);
    byMaterial.set(m, list);
  };

  for (const room of project.rooms) {
    const meta = ROOM_TYPES[room.type];
    const floorSlot = (room.floorFinish as MaterialKey | undefined) ?? meta.floor;

    // floor slab, kept as its own mesh so the viewer can pick a room by click
    const floorGeo = buildBoxes([
      { x0: room.x, y0: room.y, z0: -60, x1: room.x + room.w, y1: room.y + room.d, z1: 0 },
    ]);
    if (floorGeo) {
      meshes.push({
        material: floorSlot,
        geometry: floorGeo,
        castShadow: false,
        receiveShadow: true,
        roomId: room.id,
      });
    }

    for (const wall of wallSolids(room, project.openings, wallHeight)) {
      add(wall.m, clipZ(wall, wallHeight));
    }
    for (const sk of skirtingBoxes(room, openingsOn(project.openings, room))) {
      add("skirting", sk);
    }

    if (showCeiling) {
      const ceilingZ = (room.ceiling ?? project.ceiling) - (room.falseCeiling ?? 0);
      const inner = innerRect(room);
      add("ceiling", {
        x0: inner.x,
        y0: inner.y,
        z0: ceilingZ,
        x1: inner.x + inner.w,
        y1: inner.y + inner.d,
        z1: ceilingZ + 40,
      });
      if (room.falseCeiling) {
        // the perimeter drop that a cove light sits behind
        const drop = room.falseCeiling;
        const top = room.ceiling ?? project.ceiling;
        add("ceiling", { x0: inner.x, y0: inner.y, z0: top - drop, x1: inner.x + inner.w, y1: inner.y + 300, z1: top });
        add("ceiling", { x0: inner.x, y0: inner.y + inner.d - 300, z0: top - drop, x1: inner.x + inner.w, y1: inner.y + inner.d, z1: top });
        add("ceiling", { x0: inner.x, y0: inner.y, z0: top - drop, x1: inner.x + 300, y1: inner.y + inner.d, z1: top });
        add("ceiling", { x0: inner.x + inner.w - 300, y0: inner.y, z0: top - drop, x1: inner.x + inner.w, y1: inner.y + inner.d, z1: top });
      }
    }
  }

  // openings
  const leafGeos: THREE.BufferGeometry[] = [];
  for (const op of project.openings) {
    const parts = openingParts(op, wallHeight);
    const frameSlot: MaterialKey =
      op.kind === "window" || op.kind === "frenchWindow" ? "metalDark" : "lacquer";
    for (const b of parts.frame) add(frameSlot, b);
    for (const b of parts.glass) add("glass", b);
    for (const b of parts.sill) add("stone", b);
    for (const b of parts.hardware) add("metal", b);

    if (parts.leaf.length) {
      const geo = buildBoxes(parts.leaf);
      if (geo) {
        if (parts.leafTransform) geo.applyMatrix4(parts.leafTransform);
        leafGeos.push(geo);
      }
    }
  }

  for (const [material, boxes] of byMaterial) {
    const geometry = buildBoxes(boxes);
    if (!geometry) continue;
    meshes.push({
      material,
      geometry,
      castShadow: material !== "glass" && material !== "ceiling",
      receiveShadow: true,
    });
  }

  for (const geometry of leafGeos) {
    meshes.push({ material: "woodMid", geometry, castShadow: true, receiveShadow: true });
  }

  return meshes;
}

export function disposeShell(meshes: ShellMesh[]): void {
  for (const m of meshes) m.geometry.dispose();
}
