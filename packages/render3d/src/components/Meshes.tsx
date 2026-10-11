import type { PlacedItem, Project } from "@layoutcraft/core";
import { CATALOG, clearanceZone, footprint } from "@layoutcraft/core";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { buildItemGeometry, yawFor } from "../geometry.js";
import type { MaterialCache } from "../materials.js";
import { buildShell, disposeShell, type ShellMesh } from "../shell.js";

/* ------------------------------------------------------------------ *
 * Shell
 * ------------------------------------------------------------------ */

export interface ShellProps {
  project: Project;
  materials: MaterialCache;
  wallHeight: number;
  showCeiling: boolean;
  onPickRoom?: (roomId: string) => void;
}

export const Shell = memo(function Shell({
  project,
  materials,
  wallHeight,
  showCeiling,
  onPickRoom,
}: ShellProps) {
  const meshes = useMemo<ShellMesh[]>(
    () => buildShell(project, { wallHeight, showCeiling }),
    [project, wallHeight, showCeiling],
  );

  // the shell is rebuilt whenever a wall or opening moves, so the geometry it
  // replaced has to be released or a long editing session leaks the GPU dry
  useEffect(() => () => disposeShell(meshes), [meshes]);

  const ceiling = useRef<THREE.Group>(null);
  const ceilingY = useMemo(() => {
    const highest = project.rooms.reduce(
      (max, r) => Math.max(max, (r.ceiling ?? project.ceiling) - (r.falseCeiling ?? 0)),
      project.ceiling,
    );
    return highest / 1000;
  }, [project]);

  /*
   * Hide the ceiling whenever the camera is above it.
   *
   * Without this, ticking "show the ceiling" while orbiting from outside
   * simply puts a lid on the model — technically correct and completely
   * useless. Tying visibility to the camera's height means the ceiling and
   * its cove lighting appear exactly when you drop inside to look at them.
   */
  useFrame(({ camera }) => {
    const group = ceiling.current;
    if (!group) return;
    const visible = camera.position.y < ceilingY - 0.05;
    if (group.visible !== visible) group.visible = visible;
  });

  const isCeiling = (m: ShellMesh) => m.material === "ceiling";

  const render = (m: ShellMesh, i: number) => (
    <mesh
      key={`${m.material}-${m.roomId ?? "x"}-${i}`}
      geometry={m.geometry}
      material={materials.get(m.material)}
      castShadow={m.castShadow}
      receiveShadow={m.receiveShadow}
      onPointerDown={
        m.roomId && onPickRoom
          ? (e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onPickRoom(m.roomId!);
            }
          : undefined
      }
    />
  );

  return (
    <group name="shell">
      {meshes.map((m, i) => (isCeiling(m) ? null : render(m, i)))}
      <group ref={ceiling} name="ceiling">
        {meshes.map((m, i) => (isCeiling(m) ? render(m, i) : null))}
      </group>
    </group>
  );
});

/* ------------------------------------------------------------------ *
 * Furniture
 * ------------------------------------------------------------------ */

interface PieceProps {
  item: PlacedItem;
  materials: MaterialCache;
  /** Cutaway height: parts above this are hidden so the view stays readable. */
  clipZ: number;
  onPick?: (id: string) => void;
}

const Piece = memo(function Piece({ item, materials, clipZ, onPick }: PieceProps) {
  const groups = useMemo(() => buildItemGeometry(item), [item]);
  const catalog = CATALOG[item.key];
  if (!catalog) return null;

  // hide a ceiling fixture that hangs above the cutaway plane
  if ((item.z ?? 0) > clipZ) return null;

  return (
    <group
      position={[item.cx / 1000, 0, item.cy / 1000]}
      rotation={[0, yawFor(item.rot), 0]}
      onPointerDown={
        onPick
          ? (e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onPick(item.id);
            }
          : undefined
      }
    >
      {groups.map((g, i) => (
        <mesh
          key={`${g.material}-${i}`}
          geometry={g.geometry}
          material={materials.get(g.material, item.finishes)}
          castShadow={g.castShadow}
          receiveShadow
        />
      ))}
    </group>
  );
});

export interface FurnitureProps {
  project: Project;
  materials: MaterialCache;
  clipZ: number;
  onPick?: (id: string) => void;
}

export const Furniture = memo(function Furniture({
  project,
  materials,
  clipZ,
  onPick,
}: FurnitureProps) {
  return (
    <group name="furniture">
      {project.items.map((item) => (
        <Piece key={item.id} item={item} materials={materials} clipZ={clipZ} onPick={onPick} />
      ))}
    </group>
  );
});

/* ------------------------------------------------------------------ *
 * Selection
 * ------------------------------------------------------------------ */

export interface SelectionProps {
  project: Project;
  selectedItemId?: string | null;
  selectedRoomId?: string | null;
  accent?: string;
  warn?: string;
  /** Items with an open issue, outlined in the warning colour. */
  flaggedItemIds?: Set<string>;
}

/**
 * Selection and issue overlays, drawn flat on the floor.
 *
 * Deliberately the same language as the 2D plan: a footprint outline for the
 * selected piece and a hatched strip for the clearance it needs. A designer
 * switching between the plan and the 3D view should not have to learn two
 * vocabularies for the same information.
 */
export function Selection({
  project,
  selectedItemId,
  selectedRoomId,
  accent = "#e0a24f",
  warn = "#ef7b64",
  flaggedItemIds,
}: SelectionProps) {
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);
  const warnColor = useMemo(() => new THREE.Color(warn), [warn]);

  const item = selectedItemId ? project.items.find((i) => i.id === selectedItemId) : undefined;
  const room = selectedRoomId ? project.rooms.find((r) => r.id === selectedRoomId) : undefined;

  const plate = (
    x: number,
    y: number,
    w: number,
    d: number,
    color: THREE.Color,
    opacity: number,
    lift: number,
  ) => (
    <mesh position={[(x + w / 2) / 1000, lift, (y + d / 2) / 1000]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[w / 1000, d / 1000]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );

  const zone = item ? clearanceZone(item) : null;

  return (
    <group name="overlays">
      {room ? plate(room.x, room.y, room.w, room.d, accentColor, 0.07, 0.004) : null}
      {zone ? plate(zone.x, zone.y, zone.w, zone.d, accentColor, 0.16, 0.008) : null}
      {item
        ? (() => {
            const f = footprint(item);
            return plate(f.x, f.y, f.w, f.d, accentColor, 0.3, 0.012);
          })()
        : null}
      {flaggedItemIds && flaggedItemIds.size > 0
        ? project.items
            .filter((i) => flaggedItemIds.has(i.id))
            .map((i) => {
              const f = footprint(i);
              return (
                <group key={i.id}>
                  {plate(f.x, f.y, f.w, f.d, warnColor, 0.26, 0.01)}
                </group>
              );
            })
        : null}
    </group>
  );
}
