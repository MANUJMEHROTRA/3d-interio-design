"use client";

import {
  clearanceZone,
  CATALOG,
  footprint,
  formatArea,
  formatSize,
  getStyle,
  innerRect,
  openingKeepOut,
  projectBounds,
  resolveFinish,
  ROOM_TYPES,
  wallSolids,
  worldPartBoxes,
  type Opening,
  type Project,
  type Room,
} from "@layoutcraft/core";
import { Crosshair, Minus, Plus, Redo2, Undo2, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flaggedItems, useEditor } from "@/lib/editor-store";
import { cn } from "@/lib/cn";

/**
 * The 2D plan.
 *
 * Rendered as one SVG with a millimetre viewBox, so the plan is drawn in real
 * units and zoom is just a viewBox change. That keeps every coordinate in the
 * component identical to the coordinates in the domain model — no pixel
 * conversions to get wrong — and means the whole thing prints at any scale.
 */

interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type Drag =
  | { kind: "pan"; startX: number; startY: number; from: ViewBox; roomId: string | null; moved: boolean }
  | { kind: "item"; id: string; grabX: number; grabY: number; originX: number; originY: number; moved: boolean }
  | { kind: "room"; id: string; grabX: number; grabY: number; originX: number; originY: number; moved: boolean };

const PAD = 1400;

export function PlanCanvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [viewBox, setViewBox] = useState<ViewBox | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const frameRef = useRef(0);

  const project = useEditor((s) => s.project);
  const selection = useEditor((s) => s.selection);
  const report = useEditor((s) => s.report);
  const trace = useEditor((s) => s.trace);
  const readOnly = useEditor((s) => s.readOnly);
  const select = useEditor((s) => s.select);
  const moveItem = useEditor((s) => s.moveItem);
  const updateRoom = useEditor((s) => s.updateRoom);
  const pushUndo = useEditor((s) => s.pushUndo);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const rotateItem = useEditor((s) => s.rotateItem);
  const deleteItem = useEditor((s) => s.deleteItem);
  const nudgeItem = useEditor((s) => s.nudgeItem);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);

  const style = useMemo(() => getStyle(project.styleId), [project.styleId]);
  const flagged = useMemo(() => flaggedItems(report), [report]);

  /* ---------------- view box ---------------- */

  const fit = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = svg.clientWidth || 900;
    const height = svg.clientHeight || 600;
    const b = projectBounds(project);
    let { x0, y0, x1, y1 } = b;
    if (trace) {
      x0 = Math.min(x0, trace.x);
      y0 = Math.min(y0, trace.y);
      x1 = Math.max(x1, trace.x + trace.w);
      y1 = Math.max(y1, trace.y + trace.h);
    }
    const contentW = x1 - x0 + PAD * 2;
    const contentH = y1 - y0 + PAD * 2;
    const aspect = width / height;
    let w = contentW;
    let h = contentH;
    if (contentW / contentH > aspect) h = contentW / aspect;
    else w = contentH * aspect;
    setViewBox({ x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h });
  }, [project, trace]);

  useEffect(() => {
    if (!viewBox) fit();
  }, [viewBox, fit]);

  // keep the viewBox aspect matched to the element, or the plan skews on resize
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const observer = new ResizeObserver(() => {
      setViewBox((current) => {
        if (!current) return current;
        const aspect = (svg.clientWidth || 1) / (svg.clientHeight || 1);
        if (Math.abs(current.w / current.h - aspect) < 0.005) return current;
        const centreY = current.y + current.h / 2;
        const h = current.w / aspect;
        return { ...current, h, y: centreY - h / 2 };
      });
    });
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const zoom = useCallback((factor: number, atX?: number, atY?: number) => {
    setViewBox((current) => {
      if (!current) return current;
      const cx = atX ?? current.x + current.w / 2;
      const cy = atY ?? current.y + current.h / 2;
      const w = Math.min(120_000, Math.max(900, current.w * factor));
      const ratio = w / current.w;
      return {
        x: cx - (cx - current.x) * ratio,
        y: cy - (cy - current.y) * ratio,
        w,
        h: current.h * ratio,
      };
    });
  }, []);

  /** Screen point to plan millimetres. */
  const toPlan = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  }, []);

  /* ---------------- pointer ---------------- */

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const target = event.target as Element;
    svgRef.current?.setPointerCapture(event.pointerId);
    const plan = toPlan(event.clientX, event.clientY);

    const itemEl = target.closest("[data-item]");
    if (itemEl && !readOnly) {
      const id = itemEl.getAttribute("data-item")!;
      const item = project.items.find((i) => i.id === id);
      if (item && !item.locked) {
        select({ kind: "item", id });
        dragRef.current = {
          kind: "item",
          id,
          grabX: plan.x,
          grabY: plan.y,
          originX: item.cx,
          originY: item.cy,
          moved: false,
        };
        return;
      }
      if (item) {
        select({ kind: "item", id });
        return;
      }
    }

    const openingEl = target.closest("[data-opening]");
    if (openingEl) {
      select({ kind: "opening", id: openingEl.getAttribute("data-opening")! });
      return;
    }

    const roomEl = target.closest("[data-room]");
    const roomId = roomEl?.getAttribute("data-room") ?? null;

    // dragging a room's label moves the room; dragging its floor pans the view
    if (roomId && !readOnly && target.closest("[data-room-handle]")) {
      const room = project.rooms.find((r) => r.id === roomId);
      if (room) {
        select({ kind: "room", id: roomId });
        dragRef.current = {
          kind: "room",
          id: roomId,
          grabX: plan.x,
          grabY: plan.y,
          originX: room.x,
          originY: room.y,
          moved: false,
        };
        return;
      }
    }

    if (!viewBox) return;
    dragRef.current = {
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
      from: viewBox,
      roomId,
      moved: false,
    };
  };

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === "item" || drag.kind === "room") {
      const plan = toPlan(event.clientX, event.clientY);
      const dx = plan.x - drag.grabX;
      const dy = plan.y - drag.grabY;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 20) return;
      if (!drag.moved) {
        // one undo entry for the whole gesture
        pushUndo();
        drag.moved = true;
      }
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        if (drag.kind === "item") moveItem(drag.id, drag.originX + dx, drag.originY + dy);
        else updateRoom(drag.id, { x: drag.originX + dx, y: drag.originY + dy });
      });
      return;
    }

    const svg = svgRef.current;
    if (!svg) return;
    const scale = drag.from.w / (svg.clientWidth || 1);
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      setViewBox({ ...drag.from, x: drag.from.x - dx * scale, y: drag.from.y - dy * scale });
    });
  };

  const endDrag = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (drag.kind === "pan" && !drag.moved) {
      select(drag.roomId ? { kind: "room", id: drag.roomId } : { kind: "none" });
    }
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const plan = toPlan(event.clientX, event.clientY);
      zoom(Math.exp(event.deltaY * 0.0014), plan.x, plan.y);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [toPlan, zoom]);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (event.key === "Escape") {
        select({ kind: "none" });
        return;
      }
      if (event.key === "f" || event.key === "F") {
        fit();
        return;
      }
      if (selection.kind !== "item" || readOnly) return;

      if (event.key === "r" || event.key === "R") {
        rotateItem(selection.id);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteItem(selection.id);
      } else if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 50;
        const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
        const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
        nudgeItem(selection.id, dx, dy);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, readOnly, undo, redo, select, fit, rotateItem, deleteItem, nudgeItem]);

  /* ---------------- drawing ---------------- */

  const svg = svgRef.current;
  const pxPerMm = viewBox && svg ? viewBox.w / (svg.clientWidth || 1) : 1;
  /** A length in screen pixels, expressed in plan units. */
  const px = (n: number) => n * pxPerMm;

  const fillFor = (slot: string) => resolveFinish(style, slot as never).color;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-xl border border-line bg-paper">
      <svg
        ref={svgRef}
        className="plan-svg"
        viewBox={viewBox ? `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}` : "0 0 10000 7000"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-label="Floor plan"
      >
        <defs>
          <pattern id="grid-500" width="500" height="500" patternUnits="userSpaceOnUse">
            <path d="M500 0H0V500" fill="none" stroke="var(--grid)" strokeWidth={px(1)} />
          </pattern>
          <pattern id="grid-1000" width="1000" height="1000" patternUnits="userSpaceOnUse">
            <path d="M1000 0H0V1000" fill="none" stroke="var(--grid)" strokeWidth={px(1.6)} />
          </pattern>
          <pattern
            id="blocked"
            width={px(8)}
            height={px(8)}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width={px(8)} height={px(8)} fill="var(--bad)" fillOpacity="0.07" />
            <line x1="0" y1="0" x2="0" y2={px(8)} stroke="var(--bad)" strokeWidth={px(1.5)} />
          </pattern>
        </defs>

        <rect x={-80_000} y={-80_000} width={200_000} height={200_000} fill="url(#grid-500)" />
        <rect
          x={-80_000}
          y={-80_000}
          width={200_000}
          height={200_000}
          fill="url(#grid-1000)"
          pointerEvents="none"
        />

        {trace ? (
          <image
            href={trace.url}
            x={trace.x}
            y={trace.y}
            width={trace.w}
            height={trace.h}
            opacity={trace.opacity}
            preserveAspectRatio="none"
            pointerEvents="none"
          />
        ) : null}

        {/* room floors */}
        {project.rooms.map((room) => {
          const meta = ROOM_TYPES[room.type];
          return (
            <rect
              key={room.id}
              data-room={room.id}
              x={room.x}
              y={room.y}
              width={room.w}
              height={room.d}
              fill={`hsl(${meta.hue} 52% 50% / ${trace ? 0.05 : 0.085})`}
            />
          );
        })}

        {/* blocked door swings */}
        {project.openings
          .filter((o) => report.blockedOpenings.has(o.id))
          .flatMap((o) =>
            openingKeepOut(o).map((zone, i) => (
              <rect
                key={`${o.id}-block-${i}`}
                x={zone.x}
                y={zone.y}
                width={zone.w}
                height={zone.d}
                fill="url(#blocked)"
                pointerEvents="none"
              />
            )),
          )}

        {/* furniture, flat pieces first so rugs sit under everything */}
        {[...project.items]
          .sort((a, b) => (CATALOG[b.key]?.flat ? 1 : 0) - (CATALOG[a.key]?.flat ? 1 : 0))
          .map((item) => {
            const catalog = CATALOG[item.key];
            if (!catalog) return null;
            const f = footprint(item);
            const isSelected = selection.kind === "item" && selection.id === item.id;
            const isFlagged = flagged.has(item.id);
            const zone = isSelected ? clearanceZone(item) : null;
            const parts = worldPartBoxes(item).sort((a, b) => a.z1 - b.z1);

            return (
              <g key={item.id} data-item={item.id}>
                {parts.map((part, i) => {
                  // a plan is a horizontal cut: wall-fixed joinery above head
                  // height is drawn only if it is a cupboard, not a mirror
                  if (part.mount === "wall" && part.z0 > 1400 && part.m !== "lacquer") return null;
                  const opacity =
                    part.m === "glass" ? 0.4 : catalog.flat ? 0.5 : part.mount === "wall" ? 0.55 : 0.95;
                  return (
                    <rect
                      key={i}
                      x={part.x0}
                      y={part.y0}
                      width={part.x1 - part.x0}
                      height={part.y1 - part.y0}
                      fill={fillFor(part.m)}
                      fillOpacity={opacity}
                      stroke="var(--ink)"
                      strokeOpacity={0.3}
                      strokeWidth={0.6}
                      vectorEffect="non-scaling-stroke"
                    />
                  );
                })}
                {zone ? (
                  <rect
                    x={zone.x}
                    y={zone.y}
                    width={zone.w}
                    height={zone.d}
                    fill="var(--accent)"
                    fillOpacity={0.12}
                    stroke="var(--accent)"
                    strokeDasharray="5 4"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                ) : null}
                <rect
                  x={f.x}
                  y={f.y}
                  width={f.w}
                  height={f.d}
                  fill="transparent"
                  stroke={isSelected ? "var(--accent)" : isFlagged ? "var(--bad)" : "var(--ink)"}
                  strokeOpacity={isSelected || isFlagged ? 1 : 0.5}
                  strokeWidth={isSelected ? 2.4 : isFlagged ? 1.8 : 0.9}
                  vectorEffect="non-scaling-stroke"
                />
                {item.locked ? (
                  <circle
                    cx={f.x + f.w - px(9)}
                    cy={f.y + px(9)}
                    r={px(4)}
                    fill="var(--muted)"
                    pointerEvents="none"
                  />
                ) : null}
              </g>
            );
          })}

        {/* walls, drawn over furniture so joinery tucks behind them */}
        {project.rooms.flatMap((room) =>
          wallSolids(room, project.openings, 10).map((wall, i) => (
            <rect
              key={`${room.id}-w${i}`}
              x={wall.x0}
              y={wall.y0}
              width={wall.x1 - wall.x0}
              height={wall.y1 - wall.y0}
              fill={wall.m === "wallAccent" ? "var(--accent)" : "var(--ink)"}
              fillOpacity={wall.m === "wallAccent" ? 0.75 : 0.88}
              pointerEvents="none"
            />
          )),
        )}

        {/* openings */}
        {project.openings.map((op) => (
          <OpeningGlyph
            key={op.id}
            opening={op}
            selected={selection.kind === "opening" && selection.id === op.id}
            px={px}
          />
        ))}

        {/* labels */}
        {project.rooms.map((room) => (
          <RoomLabel key={room.id} room={room} project={project} px={px} pxPerMm={pxPerMm} />
        ))}

        <Dimensions project={project} px={px} />

        {selection.kind === "room"
          ? (() => {
              const room = project.rooms.find((r) => r.id === selection.id);
              if (!room) return null;
              return (
                <rect
                  x={room.x}
                  y={room.y}
                  width={room.w}
                  height={room.d}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={2.6}
                  strokeDasharray="9 5"
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
              );
            })()
          : null}
      </svg>

      {/* tools */}
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1.5">
        <div className="pointer-events-auto flex gap-1.5">
          <ToolButton onClick={fit} title="Fit the plan to the window (F)">
            <Crosshair size={14} /> Fit
          </ToolButton>
          <ToolButton onClick={() => zoom(1 / 1.3)} title="Zoom in" aria-label="Zoom in">
            <Plus size={14} />
          </ToolButton>
          <ToolButton onClick={() => zoom(1.3)} title="Zoom out" aria-label="Zoom out">
            <Minus size={14} />
          </ToolButton>
          <ToolButton onClick={undo} disabled={!canUndo} title="Undo (Cmd+Z)">
            <Undo2 size={14} />
          </ToolButton>
          <ToolButton onClick={redo} disabled={!canRedo} title="Redo (Shift+Cmd+Z)">
            <Redo2 size={14} />
          </ToolButton>
        </div>
      </div>

      <p className="pointer-events-none absolute bottom-2.5 left-3 right-3 font-mono text-[11px] text-muted">
        {readOnly
          ? "Read-only — your subscription has lapsed."
          : "Drag furniture · R rotates · Delete removes · arrow keys nudge 50 mm · scroll to zoom · drag the floor to pan"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pieces
 * ------------------------------------------------------------------ */

function ToolButton({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-lg border border-line bg-paper px-2.5",
        "text-[12.5px] shadow-card transition-colors hover:border-muted disabled:pointer-events-none disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Door and window symbols, drawn to the conventions a builder reads: a leaf
 * line with a quarter-circle swing for a door, a double line for glazing, and
 * two ticks for a cased opening.
 */
function OpeningGlyph({
  opening,
  selected,
  px,
}: {
  opening: Opening;
  selected: boolean;
  px: (n: number) => number;
}) {
  const stroke = selected ? "var(--accent)" : "var(--ink)";
  const common = {
    fill: "none" as const,
    stroke,
    vectorEffect: "non-scaling-stroke" as const,
    pointerEvents: "none" as const,
  };
  const swing = opening.swing === -1 ? -1 : 1;
  const w = opening.w;

  // a generous invisible strip makes the symbol clickable at any zoom
  const hit =
    opening.o === "h" ? (
      <rect
        data-opening={opening.id}
        x={opening.x}
        y={opening.y - 130}
        width={w}
        height={260}
        fill="transparent"
      />
    ) : (
      <rect
        data-opening={opening.id}
        x={opening.x - 130}
        y={opening.y}
        width={260}
        height={w}
        fill="transparent"
      />
    );

  if (opening.kind === "window" || opening.kind === "frenchWindow") {
    const inset = 36;
    return (
      <g>
        {hit}
        {opening.o === "h" ? (
          <path
            d={`M${opening.x} ${opening.y - inset}H${opening.x + w}M${opening.x} ${opening.y + inset}H${opening.x + w}`}
            {...common}
            strokeWidth={selected ? 2.4 : 1.5}
          />
        ) : (
          <path
            d={`M${opening.x - inset} ${opening.y}V${opening.y + w}M${opening.x + inset} ${opening.y}V${opening.y + w}`}
            {...common}
            strokeWidth={selected ? 2.4 : 1.5}
          />
        )}
      </g>
    );
  }

  if (opening.kind === "cased") {
    return (
      <g>
        {hit}
        {opening.o === "h" ? (
          <path
            d={`M${opening.x} ${opening.y - 150}V${opening.y + 150}M${opening.x + w} ${opening.y - 150}V${opening.y + 150}`}
            {...common}
            strokeWidth={selected ? 2.2 : 1.4}
          />
        ) : (
          <path
            d={`M${opening.x - 150} ${opening.y}H${opening.x + 150}M${opening.x - 150} ${opening.y + w}H${opening.x + 150}`}
            {...common}
            strokeWidth={selected ? 2.2 : 1.4}
          />
        )}
      </g>
    );
  }

  if (opening.kind === "sliding") {
    return (
      <g>
        {hit}
        {opening.o === "h" ? (
          <>
            <path d={`M${opening.x} ${opening.y - 30}H${opening.x + w * 0.55}`} {...common} strokeWidth={2.4} />
            <path d={`M${opening.x + w * 0.45} ${opening.y + 30}H${opening.x + w}`} {...common} strokeWidth={2.4} />
          </>
        ) : (
          <>
            <path d={`M${opening.x - 30} ${opening.y}V${opening.y + w * 0.55}`} {...common} strokeWidth={2.4} />
            <path d={`M${opening.x + 30} ${opening.y + w * 0.45}V${opening.y + w}`} {...common} strokeWidth={2.4} />
          </>
        )}
      </g>
    );
  }

  // hinged door: leaf plus swing arc
  const hingeAtEnd = opening.hinge === "end";
  if (opening.o === "h") {
    const hx = hingeAtEnd ? opening.x + w : opening.x;
    const dir = hingeAtEnd ? -1 : 1;
    return (
      <g>
        {hit}
        <path d={`M${hx} ${opening.y}V${opening.y + w * swing}`} {...common} strokeWidth={selected ? 2.6 : 1.7} />
        <path
          d={`M${hx + w * dir} ${opening.y}A${w} ${w} 0 0 ${swing * dir > 0 ? 1 : 0} ${hx} ${opening.y + w * swing}`}
          {...common}
          strokeWidth={0.9}
          strokeDasharray="4 4"
        />
      </g>
    );
  }
  const hy = hingeAtEnd ? opening.y + w : opening.y;
  const dir = hingeAtEnd ? -1 : 1;
  return (
    <g>
      {hit}
      <path d={`M${opening.x} ${hy}H${opening.x + w * swing}`} {...common} strokeWidth={selected ? 2.6 : 1.7} />
      <path
        d={`M${opening.x} ${hy + w * dir}A${w} ${w} 0 0 ${swing * dir > 0 ? 0 : 1} ${opening.x + w * swing} ${hy}`}
        {...common}
        strokeWidth={0.9}
        strokeDasharray="4 4"
      />
    </g>
  );
}

function RoomLabel({
  room,
  project,
  px,
  pxPerMm,
}: {
  room: Room;
  project: Project;
  px: (n: number) => number;
  pxPerMm: number;
}) {
  const inner = innerRect(room);
  const cx = room.x + room.w / 2;
  const cy = room.y + room.d / 2;
  const line1 = room.name;
  const line2 = `${formatSize(inner.w, inner.d, project.units)} · ${formatArea(inner.w * inner.d, project.units)}`;
  const boxW = Math.max(line1.length * 7.6, line2.length * 6.2) + 22;

  // hide the label rather than let it overflow its room at low zoom
  if (room.w / pxPerMm < boxW + 16 || room.d / pxPerMm < 52) return null;

  return (
    <g data-room={room.id} data-room-handle="1" style={{ cursor: "move" }}>
      <rect
        x={cx - px(boxW / 2)}
        y={cy - px(22)}
        width={px(boxW)}
        height={px(42)}
        rx={px(6)}
        fill="var(--paper)"
        fillOpacity={0.88}
        stroke="var(--line)"
        strokeOpacity={0.6}
        vectorEffect="non-scaling-stroke"
      />
      <text
        x={cx}
        y={cy - px(4)}
        textAnchor="middle"
        fontFamily="var(--font-body)"
        fontWeight={600}
        fontSize={px(12.5)}
        fill="var(--ink)"
      >
        {line1}
      </text>
      <text
        x={cx}
        y={cy + px(13)}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={px(10)}
        fill="var(--muted)"
      >
        {line2}
      </text>
    </g>
  );
}

/** Overall dimension lines along the top and left of the plan. */
function Dimensions({ project, px }: { project: Project; px: (n: number) => number }) {
  if (!project.rooms.length) return null;
  const b = projectBounds(project);
  const y = b.y0 - 520;
  const x = b.x0 - 520;
  const tick = 130;
  const stroke = {
    stroke: "var(--muted)",
    strokeWidth: 1,
    vectorEffect: "non-scaling-stroke" as const,
    fill: "none" as const,
  };

  return (
    <g pointerEvents="none">
      <path
        d={`M${b.x0} ${y}H${b.x1}M${b.x0} ${y - tick}V${y + tick}M${b.x1} ${y - tick}V${y + tick}`}
        {...stroke}
      />
      <text
        x={(b.x0 + b.x1) / 2}
        y={y - px(8)}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={px(11)}
        fill="var(--muted)"
      >
        {b.x1 - b.x0} mm
      </text>
      <path
        d={`M${x} ${b.y0}V${b.y1}M${x - tick} ${b.y0}H${x + tick}M${x - tick} ${b.y1}H${x + tick}`}
        {...stroke}
      />
      <text
        transform={`translate(${x - px(8)} ${(b.y0 + b.y1) / 2}) rotate(-90)`}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={px(11)}
        fill="var(--muted)"
      >
        {b.y1 - b.y0} mm
      </text>
    </g>
  );
}
