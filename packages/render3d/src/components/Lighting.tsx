import type { Project } from "@layoutcraft/core";
import { CATALOG, nrot, projectBounds } from "@layoutcraft/core";
import { Environment, Lightformer } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Approximate black-body colour for a given temperature.
 * Warm lamps at 2700 K and cool daylight at 6500 K look very different, and
 * getting that difference right is most of what sells an evening render.
 */
export function kelvinToColor(kelvin: number): THREE.Color {
  const t = Math.max(1000, Math.min(12000, kelvin)) / 100;
  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  }
  if (t >= 66) b = 255;
  else if (t <= 19) b = 0;
  else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;

  const clamp = (v: number) => Math.max(0, Math.min(255, v)) / 255;
  return new THREE.Color(clamp(r), clamp(g), clamp(b)).convertSRGBToLinear();
}

export interface SunState {
  position: THREE.Vector3;
  color: THREE.Color;
  intensity: number;
  /** 0 at night, 1 at midday — drives ambient and sky colour too. */
  daylight: number;
}

/** Where the sun is, and what colour, for a given hour of the day. */
export function sunFor(hour: number, radius: number): SunState {
  // civil daylight roughly 06:00–18:30
  const t = (hour - 6) / 12.5;
  const daylight = Math.max(0, Math.sin(Math.max(0, Math.min(1, t)) * Math.PI));
  const elevation = (8 + daylight * 62) * (Math.PI / 180);
  // sweep from east through south to west
  const azimuth = (-80 + Math.max(0, Math.min(1, t)) * 160) * (Math.PI / 180);

  const d = Math.max(radius * 2.4, 14);
  const position = new THREE.Vector3(
    Math.cos(elevation) * Math.sin(azimuth) * d,
    Math.sin(elevation) * d,
    Math.cos(elevation) * Math.cos(azimuth) * d,
  );

  // low sun is much warmer than midday sun
  const kelvin = 2200 + daylight * 3600;
  return {
    position,
    color: kelvinToColor(kelvin),
    // Tuned against a white ceiling and a lacquer console: any higher and
    // ACES clips both to flat white, which is the giveaway of a synthetic render.
    intensity: 0.2 + daylight * 1.9,
    daylight,
  };
}

/** Every light fitting the designer has actually placed, in world space. */
function fixtureLights(project: Project, limit: number) {
  const out: Array<{
    key: string;
    position: [number, number, number];
    color: THREE.Color;
    intensity: number;
    distance: number;
  }> = [];

  for (const item of project.items) {
    const catalog = CATALOG[item.key];
    if (!catalog?.lights) continue;
    const w = item.w ?? catalog.w;
    const d = item.d ?? catalog.d;
    const rot = nrot(item.rot);
    for (const [index, light] of catalog.lights(w, d, catalog.h).entries()) {
      // rotate the fixture-local offset into the room
      const lx = light.x - w / 2;
      const ly = light.y - d / 2;
      let rx = lx;
      let ry = ly;
      if (rot === 90) {
        rx = -ly;
        ry = lx;
      } else if (rot === 180) {
        rx = -lx;
        ry = -ly;
      } else if (rot === 270) {
        rx = ly;
        ry = -lx;
      }
      out.push({
        key: `${item.id}-${index}`,
        position: [(item.cx + rx) / 1000, (light.z + (item.z ?? 0)) / 1000, (item.cy + ry) / 1000],
        color: kelvinToColor(light.kelvin),
        intensity: light.intensity,
        distance: light.distance / 1000,
      });
    }
  }

  // Point lights are per-fragment work, so the brightest few win. Sorting by
  // intensity keeps the chandelier and loses the under-cabinet strip rather
  // than the other way round.
  return out.sort((a, b) => b.intensity - a.intensity).slice(0, limit);
}

export interface LightingProps {
  project: Project;
  quality: "draft" | "standard" | "high";
  /** Set while a still is being rendered: more shadow resolution, more lights. */
  stillMode?: boolean;
}

export function Lighting({ project, quality, stillMode = false }: LightingProps) {
  const sunRef = useRef<THREE.DirectionalLight>(null);

  const { sun, centre, radius } = useMemo(() => {
    const b = projectBounds(project);
    const r = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2000;
    return {
      sun: sunFor(project.view.timeOfDay, r),
      centre: new THREE.Vector3((b.x0 + b.x1) / 2000, 0, (b.y0 + b.y1) / 2000),
      radius: r,
    };
  }, [project]);

  const lightLimit = stillMode ? 16 : quality === "draft" ? 4 : quality === "high" ? 12 : 8;
  const fixtures = useMemo(
    () => (project.view.lightsOn ? fixtureLights(project, lightLimit) : []),
    [project, lightLimit],
  );

  const shadowSize = stillMode ? 4096 : quality === "draft" ? 1024 : quality === "high" ? 4096 : 2048;
  // the shadow camera has to cover the whole flat or walls lose their shadows
  const extent = radius * 1.6 + 2;

  const skyTint = useMemo(
    () => kelvinToColor(7000 + (1 - sun.daylight) * 2000),
    [sun.daylight],
  );

  return (
    <>
      {/*
        Image-based lighting built from emissive planes rather than a
        downloaded HDRI: no network request, no licensing, and the sky colour
        follows the time-of-day slider.
      */}
      <Environment resolution={stillMode ? 512 : 256} frames={1} environmentIntensity={0.4 + sun.daylight * 0.38}>
        <color attach="background" args={[skyTint.getHex()]} />
        {/* sky dome */}
        <Lightformer
          form="rect"
          intensity={0.5 + sun.daylight * 0.85}
          color={skyTint}
          scale={[40, 40, 1]}
          position={[0, 14, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          target={[0, 0, 0]}
        />
        {/* warm bounce off the ground */}
        <Lightformer
          form="rect"
          intensity={0.25 + sun.daylight * 0.35}
          color={kelvinToColor(3200)}
          scale={[40, 40, 1]}
          position={[0, -6, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          target={[0, 0, 0]}
        />
        {/* the sun's own disc, so metals and glass get a highlight to catch */}
        <Lightformer
          form="circle"
          intensity={2 + sun.daylight * 6}
          color={sun.color}
          scale={[6, 6, 1]}
          position={sun.position.clone().normalize().multiplyScalar(18).toArray()}
          target={[0, 0, 0]}
        />
        {/* two cool side panels give rounded forms a readable falloff */}
        <Lightformer form="rect" intensity={0.5} color={skyTint} scale={[24, 10, 1]} position={[-18, 4, 0]} rotation={[0, Math.PI / 2, 0]} />
        <Lightformer form="rect" intensity={0.4} color={skyTint} scale={[24, 10, 1]} position={[18, 4, 0]} rotation={[0, -Math.PI / 2, 0]} />
      </Environment>

      {/* the sun: the only shadow-casting light, which keeps shadows coherent */}
      <directionalLight
        ref={sunRef}
        position={sun.position.clone().add(centre)}
        intensity={sun.intensity}
        color={sun.color}
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-bias={-0.00035}
        shadow-normalBias={0.02}
        shadow-camera-near={0.5}
        shadow-camera-far={extent * 6}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        target-position={centre.toArray()}
      />

      {/* sky and ground fill, so shadowed interiors are not black */}
      <hemisphereLight
        args={[skyTint.getHex(), kelvinToColor(3000).getHex(), 0.22 + sun.daylight * 0.3]}
        position={[centre.x, 6, centre.z]}
      />
      <ambientLight intensity={0.05 + sun.daylight * 0.07} color={skyTint} />

      {fixtures.map((f) => (
        <pointLight
          key={f.key}
          position={f.position}
          color={f.color}
          intensity={f.intensity}
          distance={f.distance}
          decay={2}
        />
      ))}
    </>
  );
}
