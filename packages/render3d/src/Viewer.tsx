"use client";

import type { Project } from "@layoutcraft/core";
import { CUTAWAY_H, getStyle } from "@layoutcraft/core";
import { AdaptiveDpr, Bvh, Preload, SoftShadows } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { CameraRig, type CameraMode, type FocusRequest } from "./components/CameraRig.js";
import { Furniture, Selection, Shell } from "./components/Meshes.js";
import { Lighting } from "./components/Lighting.js";
import { Post } from "./components/Post.js";
import { StillRender, type StillProgress, type StillRequest } from "./components/StillRender.js";
import { disposeGeometryCache } from "./geometry.js";
import { createMaterialCache, QUALITY } from "./materials.js";
import { disposeTextureCache } from "./textures/index.js";

export interface ViewerProps {
  project: Project;
  mode?: CameraMode;
  focus?: FocusRequest | null;
  selectedItemId?: string | null;
  selectedRoomId?: string | null;
  flaggedItemIds?: Set<string>;
  onPickItem?: (id: string) => void;
  onPickRoom?: (id: string) => void;
  onPickNothing?: () => void;
  /** Request a high-resolution still. */
  still?: StillRequest | null;
  onStillProgress?: (p: StillProgress) => void;
  onStillComplete?: (blob: Blob, filename: string) => void;
  /** Overrides `project.view.quality`, for a low-power device. */
  quality?: "draft" | "standard" | "high";
  className?: string;
}

function SceneContents({
  project,
  quality,
  stillMode,
  mode,
  focus,
  selectedItemId,
  selectedRoomId,
  flaggedItemIds,
  onPickItem,
  onPickRoom,
  onDistance,
}: {
  project: Project;
  quality: "draft" | "standard" | "high";
  stillMode: boolean;
  mode: CameraMode;
  focus: FocusRequest | null;
  selectedItemId?: string | null;
  selectedRoomId?: string | null;
  flaggedItemIds?: Set<string>;
  onPickItem?: (id: string) => void;
  onPickRoom?: (id: string) => void;
  onDistance: (d: number) => void;
}) {
  const style = useMemo(() => getStyle(project.styleId), [project.styleId]);
  const effectiveQuality = stillMode ? "high" : quality;

  // one material cache per style and quality; switching style rebuilds only
  // what the new finish schedule actually needs
  const materials = useMemo(
    () => createMaterialCache(style, QUALITY[effectiveQuality], 1),
    [style, effectiveQuality],
  );
  useEffect(() => () => materials.dispose(), [materials]);

  // In walkthrough mode the walls must be full height or you can see over them.
  const cutaway = project.view.walls === "cut" && mode !== "walk";
  const wallHeight = cutaway ? CUTAWAY_H : project.ceiling;
  const showCeiling = project.view.showCeiling && !cutaway;

  return (
    <>
      <Lighting project={project} quality={effectiveQuality} stillMode={stillMode} />
      <Bvh firstHitOnly>
        <Shell
          project={project}
          materials={materials}
          wallHeight={wallHeight}
          showCeiling={showCeiling}
          onPickRoom={onPickRoom}
        />
        <Furniture
          project={project}
          materials={materials}
          clipZ={cutaway ? CUTAWAY_H : project.ceiling}
          onPick={onPickItem}
        />
      </Bvh>
      <Selection
        project={project}
        selectedItemId={selectedItemId}
        selectedRoomId={selectedRoomId}
        flaggedItemIds={flaggedItemIds}
      />
      <CameraRig
        project={project}
        mode={mode}
        focus={focus}
        walkStartRoomId={selectedRoomId}
        onDistance={onDistance}
      />
    </>
  );
}

/**
 * The 3D view.
 *
 * Quality is deliberately a project setting rather than a hidden heuristic: a
 * designer on a laptop at a client's dining table and the same designer on a
 * workstation want different trade-offs, and they know which they are.
 */
export function Viewer({
  project,
  mode = "orbit",
  focus = null,
  selectedItemId,
  selectedRoomId,
  flaggedItemIds,
  onPickItem,
  onPickRoom,
  onPickNothing,
  still = null,
  onStillProgress,
  onStillComplete,
  quality,
  className,
}: ViewerProps) {
  const [stillMode, setStillMode] = useState(false);
  const [focusDistance, setFocusDistance] = useState(4);
  const effective = quality ?? project.view.quality;

  // the caches are process-wide, so only tear them down when the viewer is
  // genuinely going away rather than on every project edit
  useEffect(
    () => () => {
      disposeGeometryCache();
      disposeTextureCache();
    },
    [],
  );

  return (
    <Canvas
      className={className}
      shadows
      dpr={stillMode ? undefined : [1, effective === "draft" ? 1.25 : 2]}
      frameloop="always"
      gl={{
        antialias: false,
        // required so the still render can read the framebuffer back
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
        alpha: false,
      }}
      camera={{ fov: 38, near: 0.05, far: 500, position: [8, 7, 10] }}
      onCreated={({ gl, scene }) => {
        // the ToneMapping effect in the post chain owns tone mapping, so the
        // renderer must not apply its own or the image is graded twice
        gl.toneMapping = THREE.NoToneMapping;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        scene.environmentIntensity = 1;
      }}
      onPointerMissed={onPickNothing}
    >
      {/* percentage-closer soft shadows: the penumbra widens with distance from
          the contact point, which is what real shadows do */}
      {effective !== "draft" || stillMode ? (
        <SoftShadows size={stillMode ? 18 : 26} samples={stillMode ? 24 : 10} focus={0.2} />
      ) : null}

      <Suspense fallback={null}>
        <SceneContents
          project={project}
          quality={effective}
          stillMode={stillMode}
          mode={mode}
          focus={focus}
          selectedItemId={selectedItemId}
          selectedRoomId={selectedRoomId}
          flaggedItemIds={flaggedItemIds}
          onPickItem={onPickItem}
          onPickRoom={onPickRoom}
          onDistance={setFocusDistance}
        />
        <Preload all />
      </Suspense>

      <Post
        quality={effective}
        stillMode={stillMode}
        focusDistance={focusDistance}
        depthOfField={stillMode && mode === "walk"}
      />

      <StillRender
        request={still}
        onProgress={onStillProgress}
        onComplete={onStillComplete}
        onModeChange={setStillMode}
      />

      {effective === "draft" ? <AdaptiveDpr pixelated /> : null}
    </Canvas>
  );
}
