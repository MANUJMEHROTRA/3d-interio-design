import type { Project, Room } from "@layoutcraft/core";
import { footprint, innerRect, pointInRect, projectBounds, roomAt } from "@layoutcraft/core";
import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type CameraMode = "orbit" | "walk";

export type FocusPreset =
  | { kind: "overview" }
  | { kind: "top" }
  | { kind: "room"; roomId: string }
  | { kind: "item"; itemId: string }
  /** Stand in the doorway and look across the room — the estate-agent shot. */
  | { kind: "eyeLevel"; roomId: string };

export interface FocusRequest {
  preset: FocusPreset;
  /** Changing this re-triggers the same preset. */
  nonce: number;
}

interface Shot {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
}

const EYE_HEIGHT = 1.6;

/** Where to put the camera for a given preset. */
export function shotFor(project: Project, preset: FocusPreset): Shot | null {
  const b = projectBounds(project);
  const centre = new THREE.Vector3((b.x0 + b.x1) / 2000, 0, (b.y0 + b.y1) / 2000);
  const extent = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 1000;

  const roomShot = (room: Room, eyeLevel: boolean): Shot => {
    const inner = innerRect(room);
    const c = new THREE.Vector3(
      (inner.x + inner.w / 2) / 1000,
      eyeLevel ? EYE_HEIGHT : 1,
      (inner.y + inner.d / 2) / 1000,
    );
    // stand just inside the longer wall so the room opens up in front of you
    const alongX = inner.w >= inner.d;
    const back = (alongX ? inner.d : inner.w) / 1000 / 2;
    const offset = alongX
      ? new THREE.Vector3(-((inner.w / 1000) * 0.42), 0, back * 0.82)
      : new THREE.Vector3(back * 0.82, 0, (inner.d / 1000) * 0.42);
    if (eyeLevel) {
      return {
        position: new THREE.Vector3(c.x + offset.x, EYE_HEIGHT, c.z + offset.z),
        target: new THREE.Vector3(c.x - offset.x * 0.6, 1.3, c.z - offset.z * 0.6),
        fov: 60,
      };
    }
    const diag = Math.hypot(inner.w, inner.d) / 1000;
    return {
      position: new THREE.Vector3(c.x + diag * 0.62, diag * 0.72, c.z + diag * 0.62),
      target: new THREE.Vector3(c.x, 0.9, c.z),
      fov: 42,
    };
  };

  switch (preset.kind) {
    case "overview":
      return {
        position: new THREE.Vector3(
          centre.x - extent * 0.55,
          extent * 0.95,
          centre.z + extent * 1.05,
        ),
        target: new THREE.Vector3(centre.x, 0.2, centre.z),
        fov: 38,
      };
    case "top":
      return {
        position: new THREE.Vector3(centre.x, extent * 1.8, centre.z + 0.001),
        target: new THREE.Vector3(centre.x, 0, centre.z),
        fov: 34,
      };
    case "room": {
      const room = project.rooms.find((r) => r.id === preset.roomId);
      return room ? roomShot(room, false) : null;
    }
    case "eyeLevel": {
      const room = project.rooms.find((r) => r.id === preset.roomId);
      return room ? roomShot(room, true) : null;
    }
    case "item": {
      const item = project.items.find((i) => i.id === preset.itemId);
      if (!item) return null;
      const f = footprint(item);
      const c = new THREE.Vector3((item.cx) / 1000, 0.8, (item.cy) / 1000);
      const reach = Math.max(f.w, f.d) / 1000 + 2.2;
      return {
        position: new THREE.Vector3(c.x + reach * 0.7, reach * 0.62, c.z + reach * 0.7),
        target: c,
        fov: 45,
      };
    }
  }
}

/* ------------------------------------------------------------------ *
 * Orbit
 * ------------------------------------------------------------------ */

interface OrbitRigProps {
  project: Project;
  focus: FocusRequest | null;
  /** Reported so depth of field can focus on whatever is being looked at. */
  onDistance?: (d: number) => void;
}

function OrbitRig({ project, focus, onDistance }: OrbitRigProps) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const lastNonce = useRef(-1);
  const anim = useRef<{ from: Shot; to: Shot; t: number } | null>(null);

  const applyInstant = useCallback(
    (shot: Shot) => {
      camera.position.copy(shot.position);
      camera.fov = shot.fov;
      camera.updateProjectionMatrix();
      if (controls.current) {
        controls.current.target.copy(shot.target);
        controls.current.update();
      }
    },
    [camera],
  );

  // frame the project on first mount
  useEffect(() => {
    const shot = shotFor(project, { kind: "overview" });
    if (shot) applyInstant(shot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!focus || focus.nonce === lastNonce.current) return;
    lastNonce.current = focus.nonce;
    const to = shotFor(project, focus.preset);
    if (!to) return;
    const target = controls.current?.target ?? new THREE.Vector3();
    anim.current = {
      from: { position: camera.position.clone(), target: target.clone(), fov: camera.fov },
      to,
      t: 0,
    };
  }, [focus, project, camera]);

  useFrame((_, delta) => {
    const a = anim.current;
    if (a) {
      // ease-in-out over ~0.7 s; an instant jump loses the client's bearings
      a.t = Math.min(1, a.t + delta / 0.7);
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
      camera.position.lerpVectors(a.from.position, a.to.position, e);
      camera.fov = a.from.fov + (a.to.fov - a.from.fov) * e;
      camera.updateProjectionMatrix();
      if (controls.current) {
        controls.current.target.lerpVectors(a.from.target, a.to.target, e);
        controls.current.update();
      }
      if (a.t >= 1) anim.current = null;
    }
    if (onDistance && controls.current) {
      onDistance(camera.position.distanceTo(controls.current.target));
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.8}
      maxDistance={90}
      // never let the camera go below the floor slab
      maxPolarAngle={Math.PI / 2 - 0.02}
      panSpeed={0.8}
      zoomSpeed={0.8}
    />
  );
}

/* ------------------------------------------------------------------ *
 * Walkthrough
 * ------------------------------------------------------------------ */

interface WalkRigProps {
  project: Project;
  startRoomId?: string | null;
  onDistance?: (d: number) => void;
}

/**
 * First-person walkthrough.
 *
 * Movement is constrained to the union of the rooms, with furniture treated as
 * solid. Doorway-accurate collision is deliberately not attempted: letting the
 * viewer step between adjacent rooms is far less frustrating than getting stuck
 * on a door frame, and this is a design review, not a game.
 */
function WalkRig({ project, startRoomId, onDistance }: WalkRigProps) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const keys = useRef<Record<string, boolean>>({});
  const yaw = useRef(0);
  const pitch = useRef(0);
  const dragging = useRef(false);

  const obstacles = useMemo(
    () =>
      project.items
        .filter((i) => {
          const f = footprint(i);
          return f.w > 250 && f.d > 250;
        })
        .map(footprint),
    [project.items],
  );

  // start standing in the chosen room, looking across it
  useEffect(() => {
    const room =
      project.rooms.find((r) => r.id === startRoomId) ??
      project.rooms.slice().sort((a, b) => b.w * b.d - a.w * a.d)[0];
    if (!room) return;
    const inner = innerRect(room);
    camera.position.set(
      (inner.x + inner.w * 0.22) / 1000,
      EYE_HEIGHT,
      (inner.y + inner.d * 0.78) / 1000,
    );
    const look = new THREE.Vector3(
      (inner.x + inner.w * 0.7) / 1000,
      1.4,
      (inner.y + inner.d * 0.25) / 1000,
    );
    const dir = look.clone().sub(camera.position);
    yaw.current = Math.atan2(-dir.x, -dir.z);
    pitch.current = Math.asin(dir.clone().normalize().y);
    camera.fov = 65;
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startRoomId]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = true;
      if (["w", "a", "s", "d", " "].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const el = gl.domElement;
    const onDown = () => {
      dragging.current = true;
    };
    const onUp = () => {
      dragging.current = false;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      yaw.current -= e.movementX * 0.0026;
      pitch.current = Math.max(
        -1.25,
        Math.min(1.25, pitch.current - e.movementY * 0.0022),
      );
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("pointermove", onMove);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointermove", onMove);
    };
  }, [gl]);

  const canStand = useCallback(
    (x: number, z: number): boolean => {
      const px = x * 1000;
      const pz = z * 1000;
      const room = roomAt(project.rooms, px, pz);
      if (!room) return false;
      // keep the body out of the wall itself
      const inner = innerRect(room);
      const margin = 220;
      const insideWalls =
        px > inner.x + margin &&
        px < inner.x + inner.w - margin &&
        pz > inner.y + margin &&
        pz < inner.y + inner.d - margin;
      // ...unless the neighbouring room continues, in which case walk on
      if (!insideWalls && !roomAt(project.rooms, px + Math.sign(px - (inner.x + inner.w / 2)) * 400, pz)) {
        if (!pointInRect(inner, px, pz)) return false;
      }
      const body = 260;
      for (const o of obstacles) {
        if (
          px > o.x - body &&
          px < o.x + o.w + body &&
          pz > o.y - body &&
          pz < o.y + o.d + body
        ) {
          return false;
        }
      }
      return true;
    },
    [project.rooms, obstacles],
  );

  useFrame((_, delta) => {
    camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, "YXZ"));

    const k = keys.current;
    const forward = (k.w ? 1 : 0) - (k.s ? 1 : 0);
    const strafe = (k.d ? 1 : 0) - (k.a ? 1 : 0);
    if (forward === 0 && strafe === 0) {
      onDistance?.(4);
      return;
    }

    const speed = (k.shift ? 2.6 : 1.4) * delta;
    const dir = new THREE.Vector3(-Math.sin(yaw.current), 0, -Math.cos(yaw.current));
    const right = new THREE.Vector3(Math.cos(yaw.current), 0, -Math.sin(yaw.current));
    const move = dir
      .multiplyScalar(forward)
      .add(right.multiplyScalar(strafe))
      .normalize()
      .multiplyScalar(speed);

    // slide along whichever axis is still free, so corners do not stick
    const nx = camera.position.x + move.x;
    const nz = camera.position.z + move.z;
    if (canStand(nx, nz)) {
      camera.position.x = nx;
      camera.position.z = nz;
    } else if (canStand(nx, camera.position.z)) {
      camera.position.x = nx;
    } else if (canStand(camera.position.x, nz)) {
      camera.position.z = nz;
    }
    camera.position.y = EYE_HEIGHT;
    onDistance?.(4);
  });

  return null;
}

/* ------------------------------------------------------------------ *
 * Public component
 * ------------------------------------------------------------------ */

export interface CameraRigProps {
  project: Project;
  mode: CameraMode;
  focus: FocusRequest | null;
  walkStartRoomId?: string | null;
  onDistance?: (d: number) => void;
}

export function CameraRig({ project, mode, focus, walkStartRoomId, onDistance }: CameraRigProps) {
  return mode === "walk" ? (
    <WalkRig project={project} startRoomId={walkStartRoomId} onDistance={onDistance} />
  ) : (
    <OrbitRig project={project} focus={focus} onDistance={onDistance} />
  );
}
