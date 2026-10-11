import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

export interface StillRequest {
  /** Changing this starts a render. */
  nonce: number;
  /** Multiplier on the canvas's own pixel ratio. 3 on a 1400 px canvas is ~4K. */
  scale?: number;
  /** Frames to let ambient occlusion denoise and the sky probe settle. */
  settleFrames?: number;
  filename?: string;
}

export interface StillProgress {
  stage: "idle" | "warming" | "settling" | "encoding" | "done" | "failed";
  /** 0–1. */
  progress: number;
  message: string;
}

export interface StillRenderProps {
  request: StillRequest | null;
  onProgress?: (p: StillProgress) => void;
  /** Receives the finished PNG. */
  onComplete?: (blob: Blob, filename: string) => void;
  /** Set while a render is in flight so the rest of the scene can raise quality. */
  onModeChange?: (still: boolean) => void;
}

/**
 * Progressive high-resolution still capture.
 *
 * What this does, and does not, claim to be: it re-renders the *same* realtime
 * scene at several times the screen resolution with the heaviest quality
 * settings enabled, then waits a number of frames for the ambient-occlusion
 * denoiser, the environment probe and the antialiasing to converge before
 * reading the framebuffer. That is a genuine jump in output quality over a
 * screenshot, and it is not path tracing — there is no secondary light
 * transport. True progressive path tracing is a separate, heavier mode.
 */
export function StillRender({
  request,
  onProgress,
  onComplete,
  onModeChange,
}: StillRenderProps) {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const lastNonce = useRef(-1);
  const running = useRef(false);

  useEffect(() => {
    if (!request || request.nonce === lastNonce.current || running.current) return;
    lastNonce.current = request.nonce;
    running.current = true;

    const scale = Math.max(1, Math.min(4, request.scale ?? 3));
    const settleFrames = Math.max(8, request.settleFrames ?? 48);
    const filename = request.filename ?? "layoutcraft-render.png";
    const originalRatio = gl.getPixelRatio();

    // Guard against asking the GPU for a texture it cannot allocate: exceeding
    // MAX_TEXTURE_SIZE silently produces a blank image on some drivers.
    const maxTexture = gl.capabilities.maxTextureSize;
    const longest = Math.max(size.width, size.height) * originalRatio * scale;
    const safeScale = longest > maxTexture ? (maxTexture / (Math.max(size.width, size.height) * originalRatio)) * 0.98 : scale;

    let cancelled = false;
    let frame = 0;
    let raf = 0;

    const report = (stage: StillProgress["stage"], progress: number, message: string) =>
      onProgress?.({ stage, progress, message });

    const finish = () => {
      gl.setPixelRatio(originalRatio);
      onModeChange?.(false);
      running.current = false;
      invalidate();
    };

    const step = () => {
      if (cancelled) return finish();
      frame += 1;
      if (frame <= settleFrames) {
        report(
          "settling",
          0.1 + (frame / settleFrames) * 0.8,
          `Resolving light and shadow — frame ${frame} of ${settleFrames}`,
        );
        invalidate();
        raf = requestAnimationFrame(step);
        return;
      }

      report("encoding", 0.95, "Encoding the image");
      const canvas = gl.domElement;
      const done = (blob: Blob | null) => {
        if (blob) {
          report("done", 1, `Saved ${Math.round(blob.size / 1024)} KB`);
          onComplete?.(blob, filename);
        } else {
          report("failed", 1, "The image could not be read back from the GPU");
        }
        finish();
      };
      if (typeof canvas.toBlob === "function") canvas.toBlob(done, "image/png");
      else done(null);
    };

    report("warming", 0.05, `Rendering at ${Math.round(size.width * originalRatio * safeScale)} px wide`);
    onModeChange?.(true);
    gl.setPixelRatio(originalRatio * safeScale);
    invalidate();
    raf = requestAnimationFrame(step);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (running.current) finish();
    };
  }, [request, gl, size, invalidate, onComplete, onProgress, onModeChange]);

  return null;
}
