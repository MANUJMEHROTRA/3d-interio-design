"use client";

import { ROOM_TYPES, type Project } from "@layoutcraft/core";
import type { FocusRequest, StillProgress, StillRequest } from "@layoutcraft/render3d";
import { Camera, Eye, Footprints, Moon, Sun } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Note, Pill, Row, Rows, Section, SegmentedControl, Spinner, Toggle } from "@/components/ui";
import { flaggedItems, useEditor } from "@/lib/editor-store";
import { cn } from "@/lib/cn";

/**
 * The 3D viewer is loaded on demand.
 *
 * three.js, drei and the postprocessing chain are roughly a megabyte of
 * JavaScript. Nobody should download that to look at a project list, or to read
 * a quote on a phone, so the editor pulls it in only when the 3D tab is opened.
 */
const Viewer = dynamic(() => import("@layoutcraft/render3d").then((m) => ({ default: m.Viewer })), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-[13px] text-muted">
      <span className="flex items-center gap-2">
        <Spinner /> Loading the 3D engine…
      </span>
    </div>
  ),
});

export function ViewPanel({ canRenderStills }: { canRenderStills: boolean }) {
  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const report = useEditor((s) => s.report);
  const select = useEditor((s) => s.select);
  const notify = useEditor((s) => s.notify);

  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  const [still, setStill] = useState<StillRequest | null>(null);
  const [progress, setProgress] = useState<StillProgress | null>(null);
  const nonce = useRef(0);

  const flagged = useMemo(() => flaggedItems(report), [report]);

  const requestFocus = useCallback((preset: FocusRequest["preset"]) => {
    nonce.current += 1;
    setFocus({ preset, nonce: nonce.current });
  }, []);

  // frame whatever the designer selects, so plan and 3D stay in step
  useEffect(() => {
    if (selection.kind === "room") requestFocus({ kind: "room", roomId: selection.id });
    else if (selection.kind === "item") requestFocus({ kind: "item", itemId: selection.id });
  }, [selection, requestFocus]);

  const onStillComplete = useCallback(
    (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      // revoke on the next tick, after the browser has taken the blob
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      notify("Render saved", "good");
      setTimeout(() => setProgress(null), 2500);
    },
    [notify],
  );

  const startRender = () => {
    if (!canRenderStills) {
      notify("High-resolution renders need a paid plan.", "bad");
      return;
    }
    nonce.current += 1;
    setStill({
      nonce: nonce.current,
      scale: 3,
      settleFrames: 56,
      filename: `${project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "render"}.png`,
    });
  };

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-xl border border-line bg-paper">
      <Viewer
        project={project}
        mode={mode}
        focus={focus}
        selectedItemId={selection.kind === "item" ? selection.id : null}
        selectedRoomId={selection.kind === "room" ? selection.id : null}
        flaggedItemIds={flagged}
        onPickItem={(id) => select({ kind: "item", id })}
        onPickRoom={(id) => select({ kind: "room", id })}
        onPickNothing={() => select({ kind: "none" })}
        still={still}
        onStillProgress={setProgress}
        onStillComplete={onStillComplete}
        className="h-full w-full"
      />

      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
        <div className="pointer-events-auto flex flex-wrap gap-1.5">
          <SegmentedControl
            value={mode}
            options={[
              { value: "orbit", label: "Orbit" },
              { value: "walk", label: "Walk" },
            ]}
            onChange={(v) => {
              setMode(v);
              if (v === "walk") notify("W A S D to walk, drag to look around, shift to move faster");
            }}
            className="bg-paper/90 shadow-card backdrop-blur"
          />
          {mode === "orbit" ? (
            <>
              <ViewButton onClick={() => requestFocus({ kind: "overview" })}>Overview</ViewButton>
              <ViewButton onClick={() => requestFocus({ kind: "top" })}>Top</ViewButton>
              {selection.kind === "room" ? (
                <ViewButton onClick={() => requestFocus({ kind: "eyeLevel", roomId: selection.id })}>
                  <Eye size={13} /> Eye level
                </ViewButton>
              ) : null}
            </>
          ) : null}
          <ViewButton onClick={startRender} disabled={Boolean(progress && progress.stage !== "done")}>
            {progress && progress.stage !== "done" && progress.stage !== "failed" ? (
              <>
                <Spinner /> Rendering
              </>
            ) : (
              <>
                <Camera size={13} /> Render a still
              </>
            )}
          </ViewButton>
        </div>
      </div>

      {progress && progress.stage !== "idle" ? (
        <div className="absolute bottom-3 left-3 right-3 rounded-lg border border-line bg-paper/95 p-2.5 shadow-pop backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-[12px]">
            <span>{progress.message}</span>
            <span className="tnum text-muted">{Math.round(progress.progress * 100)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${Math.round(progress.progress * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="pointer-events-none absolute bottom-2.5 left-3 right-3 font-mono text-[11px] text-muted">
          {mode === "walk"
            ? "W A S D to walk · drag to look · shift to move faster"
            : "Drag to orbit · right-drag or shift-drag to pan · scroll to zoom · click a piece to select it"}
        </p>
      )}
    </div>
  );
}

function ViewButton({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-line bg-paper/90 px-2.5",
        "text-[12.5px] shadow-card backdrop-blur transition-colors hover:border-muted",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      {children}
    </button>
  );
}

/** The 3D tab's side panel: lighting, cutaway and room shortcuts. */
export function ViewSettings() {
  const project = useEditor((s) => s.project);
  const setView = useEditor((s) => s.setView);
  const select = useEditor((s) => s.select);
  const readOnly = useEditor((s) => s.readOnly);

  const hour = project.view.timeOfDay;
  const label =
    hour < 7 ? "Early morning" : hour < 11 ? "Morning" : hour < 15 ? "Midday" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <div className="flex flex-col gap-5">
      <Section title="Walls">
        <SegmentedControl
          value={project.view.walls}
          options={[
            { value: "cut", label: "Cutaway" },
            { value: "full", label: "Full height" },
          ]}
          onChange={(v) => setView({ walls: v as "cut" | "full" })}
        />
        <Note>
          Cutaway slices the walls at 1.15 m so you can look into the whole flat. Walk mode always
          uses full-height walls.
        </Note>
        <Toggle
          label="Show the ceiling"
          hint="Appears once the camera drops below ceiling height, so it never puts a lid on the model"
          checked={project.view.showCeiling}
          onChange={(v) => setView({ showCeiling: v })}
        />
      </Section>

      <Section title="Lighting">
        <label className="field">
          <span>
            Time of day — {label}, {String(Math.floor(hour)).padStart(2, "0")}:
            {String(Math.round((hour % 1) * 60)).padStart(2, "0")}
          </span>
          <input
            type="range"
            min={5}
            max={21}
            step={0.5}
            value={hour}
            onChange={(e) => setView({ timeOfDay: Number(e.target.value) })}
          />
        </label>
        <Note>
          The sun&rsquo;s angle and colour follow the clock, so you can show a client the room at the
          hour they will actually sit in it.
        </Note>
        <Toggle
          label="Light fittings on"
          checked={project.view.lightsOn}
          onChange={(v) => setView({ lightsOn: v })}
        />
      </Section>

      <Section title="Quality">
        <SegmentedControl
          value={project.view.quality}
          options={[
            { value: "draft", label: "Draft" },
            { value: "standard", label: "Standard" },
            { value: "high", label: "High" },
          ]}
          onChange={(v) => setView({ quality: v as "draft" | "standard" | "high" })}
        />
        <Note>
          Draft turns off ambient occlusion and halves texture resolution — useful on a laptop
          running on battery at a client meeting.
        </Note>
      </Section>

      <Section title="Jump to a room">
        {project.rooms.length ? (
          <Rows>
            {project.rooms.map((room) => (
              <Row
                key={room.id}
                onClick={() => select({ kind: "room", id: room.id })}
                left={
                  <>
                    <i
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ background: `hsl(${ROOM_TYPES[room.type].hue} 52% 50% / 0.6)` }}
                    />
                    <span className="truncate">{room.name}</span>
                  </>
                }
                right={
                  <span className="tnum text-[12px] text-muted">
                    {(room.w / 1000).toFixed(1)} × {(room.d / 1000).toFixed(1)}
                  </span>
                }
              />
            ))}
          </Rows>
        ) : null}
      </Section>
    </div>
  );
}
