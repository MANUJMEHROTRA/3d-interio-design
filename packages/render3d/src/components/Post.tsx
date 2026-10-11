import {
  Bloom,
  BrightnessContrast,
  DepthOfField,
  EffectComposer,
  HueSaturation,
  N8AO,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export interface PostProps {
  quality: "draft" | "standard" | "high";
  stillMode?: boolean;
  /** Distance from camera to the subject, metres, for depth of field. */
  focusDistance?: number;
  /** Depth of field reads as a photograph; off by default while navigating. */
  depthOfField?: boolean;
}

/**
 * The post chain. In rough order of how much each contributes to a render
 * looking photographic rather than synthetic:
 *
 *   1. ACES filmic tone mapping — without it, every bright surface clips to
 *      flat white and the image looks like a video game from 2008.
 *   2. Ambient occlusion — contact darkening in corners and under furniture.
 *      This is the single biggest "is it CG?" tell when it is missing.
 *   3. Bloom, restricted to genuinely bright pixels, so lamps glow.
 *   4. Subtle vignette and a touch of contrast, the way a camera would.
 */
export function Post({
  quality,
  stillMode = false,
  focusDistance = 4,
  depthOfField = false,
}: PostProps) {
  if (quality === "draft" && !stillMode) {
    // on a weak GPU the honest trade is tone mapping and antialiasing only
    return (
      <EffectComposer multisampling={4}>
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        <Vignette offset={0.34} darkness={0.42} />
      </EffectComposer>
    );
  }

  const aoSamples = stillMode ? 64 : quality === "high" ? 24 : 16;
  const denoiseSamples = stillMode ? 16 : 8;

  return (
    <EffectComposer multisampling={0} enableNormalPass>
      <N8AO
        aoRadius={0.55}
        distanceFalloff={1.2}
        intensity={2.4}
        quality={stillMode ? "ultra" : quality === "high" ? "high" : "medium"}
        aoSamples={aoSamples}
        denoiseSamples={denoiseSamples}
        denoiseRadius={12}
        halfRes={!stillMode && quality !== "high"}
        screenSpaceRadius={false}
      />
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.3}
        mipmapBlur
        radius={0.72}
      />
      {depthOfField ? (
        <DepthOfField
          focusDistance={0}
          focalLength={0.035}
          bokehScale={stillMode ? 3.5 : 2}
          target={[0, focusDistance, 0]}
        />
      ) : (
        <></>
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* a hair of warmth and contrast, as a camera profile would apply */}
      <HueSaturation saturation={0.04} hue={0} />
      <BrightnessContrast brightness={0.01} contrast={0.06} />
      <SMAA />
      <Vignette offset={0.32} darkness={0.5} />
    </EffectComposer>
  );
}
