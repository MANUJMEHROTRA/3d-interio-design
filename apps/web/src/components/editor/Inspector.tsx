"use client";

import {
  CATALOG,
  CATEGORY_ORDER,
  catalogByCategory,
  footprint,
  formatArea,
  formatLength,
  formatMoney,
  getStyle,
  innerRect,
  itemSize,
  openingsOn,
  openingSide,
  quantityOf,
  rateFor,
  ROOM_TYPE_LIST,
  ROOM_TYPES,
  SIDE_LABEL,
  STYLE_LIST,
  templatesFor,
  variantsOf,
  type MaterialKey,
  type Opening,
  type OpeningKind,
  type PlacedItem,
  type Project,
  type Room,
  type RoomType,
  type Side,
} from "@layoutcraft/core";
import { Lock, LockOpen, RotateCw, Sparkles, Trash2, Copy } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ConfirmInline,
  Empty,
  Note,
  NumberField,
  Pill,
  Row,
  Rows,
  Section,
  SegmentedControl,
  SelectField,
  Stats,
  TextArea,
  TextField,
  Toggle,
} from "@/components/ui";
import { useEditor } from "@/lib/editor-store";
import { cn } from "@/lib/cn";

/**
 * The inspector.
 *
 * Context-sensitive on purpose: a designer selects a thing and the panel shows
 * what can be done to that thing. A single flat settings panel would need
 * forty fields visible at once, and the useful three would be lost in them.
 */
export function Inspector() {
  const selection = useEditor((s) => s.selection);

  if (selection.kind === "item") return <ItemInspector id={selection.id} />;
  if (selection.kind === "room") return <RoomInspector id={selection.id} />;
  if (selection.kind === "opening") return <OpeningInspector id={selection.id} />;
  return <ProjectInspector />;
}

/* ------------------------------------------------------------------ *
 * Project
 * ------------------------------------------------------------------ */

function ProjectInspector() {
  const project = useEditor((s) => s.project);
  const report = useEditor((s) => s.report);
  const readOnly = useEditor((s) => s.readOnly);
  const select = useEditor((s) => s.select);
  const addRoom = useEditor((s) => s.addRoom);
  const furnishEverything = useEditor((s) => s.furnishEverything);
  const edit = useEditor((s) => s.edit);
  const trace = useEditor((s) => s.trace);
  const setTrace = useEditor((s) => s.setTrace);
  const updateTrace = useEditor((s) => s.updateTrace);

  const carpetArea = project.rooms.reduce((sum, r) => {
    const inner = innerRect(r);
    return sum + inner.w * inner.d;
  }, 0);

  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warning");

  return (
    <div className="flex flex-col gap-5">
      <Section
        title="Project"
        aside={<Pill>{getStyle(project.styleId).name}</Pill>}
      >
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="Project name"
            value={project.name}
            disabled={readOnly}
            maxLength={120}
            onCommit={(v) =>
              edit((p) => {
                p.name = v.trim() || "Untitled project";
              })
            }
          />
          <TextField
            label="Client"
            value={project.client}
            disabled={readOnly}
            maxLength={120}
            onCommit={(v) =>
              edit((p) => {
                p.client = v.trim();
              })
            }
          />
        </div>
        <Stats
          cells={[
            [formatArea(carpetArea, project.units), "Carpet area"],
            [String(project.rooms.length), "Rooms"],
            [String(project.items.length), "Pieces"],
          ]}
        />
        {errors.length ? (
          <Note tone="bad">
            {errors.length} problem{errors.length === 1 ? "" : "s"} to fix
            {warnings.length ? `, ${warnings.length} worth a look` : ""}. Affected pieces are outlined
            in red on the plan.
          </Note>
        ) : warnings.length ? (
          <Note tone="warn">
            Nothing clashes. {warnings.length} thing{warnings.length === 1 ? "" : "s"} worth a second
            look.
          </Note>
        ) : (
          <Note>Every piece clears its walls, doors and walkways.</Note>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary"
            disabled={readOnly || !project.rooms.length}
            onClick={furnishEverything}
          >
            <Sparkles size={14} /> Furnish every room
          </button>
          <button type="button" className="btn" disabled={readOnly} onClick={addRoom}>
            Add room
          </button>
        </div>
        <Note>
          Furnishing picks the best-fitting layout for each room and turns it so it clears the doors.
        </Note>
      </Section>

      <Section title="Rooms">
        {project.rooms.length ? (
          <Rows>
            {project.rooms.map((room) => {
              const inner = innerRect(room);
              const roomIssues = project.items
                .filter((i) => report.byItem.has(i.id))
                .filter((i) => {
                  const f = footprint(i);
                  return (
                    f.x >= room.x - 50 &&
                    f.y >= room.y - 50 &&
                    f.x + f.w <= room.x + room.w + 50 &&
                    f.y + f.d <= room.y + room.d + 50
                  );
                }).length;
              return (
                <Row
                  key={room.id}
                  onClick={() => select({ kind: "room", id: room.id })}
                  left={
                    <>
                      <i
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                        style={{
                          background: `hsl(${ROOM_TYPES[room.type].hue} 52% 50% / 0.6)`,
                        }}
                      />
                      <span className="truncate">{room.name}</span>
                    </>
                  }
                  right={
                    <>
                      {roomIssues ? <Pill tone="bad">{roomIssues}</Pill> : null}
                      <span className="tnum text-[12px] text-muted">
                        {formatArea(inner.w * inner.d, project.units)}
                      </span>
                    </>
                  }
                />
              );
            })}
          </Rows>
        ) : (
          <Empty>No rooms yet. Add one, or trace a builder&rsquo;s plan.</Empty>
        )}
      </Section>

      <Section title="Style">
        <StyleCards />
      </Section>

      <Section title={trace ? "Tracing image" : "Start from a client's plan"}>
        {trace ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label="Real width of image"
                value={Math.round(trace.w)}
                step={100}
                min={500}
                suffix="mm"
                onCommit={(v) => updateTrace({ w: v })}
              />
              <label className="field">
                <span>Opacity</span>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={trace.opacity}
                  onChange={(e) => updateTrace({ opacity: Number(e.target.value) })}
                />
              </label>
            </div>
            <Note>
              Set the real width so the grid matches the drawing, then draw rooms over the top.
            </Note>
            <button type="button" className="btn btn-sm" onClick={() => setTrace(null)}>
              Remove image
            </button>
          </>
        ) : (
          <>
            <Note>
              Place a builder&rsquo;s floor plan under the grid, scale it to its real width, and draw
              rooms on top of it.
            </Note>
            <TraceUpload />
          </>
        )}
      </Section>

      {report.issues.length ? (
        <Section title="Design review" aside={<span className="text-[11px] text-muted">{report.issues.length}</span>}>
          <IssueList />
        </Section>
      ) : null}
    </div>
  );
}

function TraceUpload() {
  const setTrace = useEditor((s) => s.setTrace);
  const project = useEditor((s) => s.project);
  const notify = useEditor((s) => s.notify);

  return (
    <label className="btn cursor-pointer">
      Trace a plan image
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          if (!file.type.startsWith("image/")) {
            notify("Choose an image such as a JPG or PNG.", "bad");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const url = String(reader.result);
            const image = new Image();
            image.onload = () => {
              // start at a plausible 10 m wide; the designer then types the real width
              const width = project.rooms.length ? 10_000 : 10_000;
              setTrace({
                url,
                x: 0,
                y: 0,
                w: width,
                h: (width * image.naturalHeight) / image.naturalWidth,
                opacity: 0.55,
              });
              notify("Image placed. Set its real width so the scale is right.");
            };
            image.src = url;
          };
          reader.readAsDataURL(file);
        }}
      />
    </label>
  );
}

function StyleCards() {
  const project = useEditor((s) => s.project);
  const setStyle = useEditor((s) => s.setStyle);
  const readOnly = useEditor((s) => s.readOnly);

  return (
    <div className="grid grid-cols-2 gap-2">
      {STYLE_LIST.map((style) => {
        const active = project.styleId === style.id;
        const swatches: MaterialKey[] = ["floor", "woodMid", "fabric", "fabricAccent", "wall"];
        return (
          <button
            key={style.id}
            type="button"
            disabled={readOnly}
            aria-pressed={active}
            onClick={() => setStyle(style.id)}
            className={cn(
              "flex flex-col gap-1.5 rounded-lg border bg-paper p-2.5 text-left transition-colors",
              active ? "border-accent ring-1 ring-accent" : "border-line hover:border-muted",
            )}
          >
            <span className="flex gap-1">
              {swatches.map((slot) => (
                <i
                  key={slot}
                  className="h-4 w-4 rounded border border-black/10"
                  style={{ background: style.finishes[slot].color }}
                />
              ))}
            </span>
            <b className="text-[12.5px] font-semibold">{style.name}</b>
            <small className="text-[11px] leading-snug text-muted">
              {style.note}
              {style.priceMultiplier !== 1
                ? ` · rates ${style.priceMultiplier > 1 ? "+" : ""}${Math.round((style.priceMultiplier - 1) * 100)}%`
                : ""}
            </small>
          </button>
        );
      })}
    </div>
  );
}

function IssueList() {
  const report = useEditor((s) => s.report);
  const project = useEditor((s) => s.project);
  const select = useEditor((s) => s.select);

  const ordered = useMemo(() => {
    const rank = { error: 0, warning: 1, info: 2 } as const;
    return [...report.issues].sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [report.issues]);

  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {ordered.slice(0, 40).map((issue, i) => {
        const where =
          issue.targetKind === "room"
            ? project.rooms.find((r) => r.id === issue.target)?.name
            : issue.targetKind === "item"
              ? (() => {
                  const item = project.items.find((x) => x.id === issue.target);
                  return item ? (item.label ?? CATALOG[item.key]?.name ?? item.key) : null;
                })()
              : "Opening";
        return (
          <li key={`${issue.target}-${issue.code}-${i}`}>
            <button
              type="button"
              onClick={() =>
                select(
                  issue.targetKind === "room"
                    ? { kind: "room", id: issue.target }
                    : issue.targetKind === "item"
                      ? { kind: "item", id: issue.target }
                      : { kind: "opening", id: issue.target },
                )
              }
              className={cn(
                "w-full rounded-lg px-2.5 py-2 text-left text-[12px] leading-snug transition-opacity hover:opacity-80",
                issue.severity === "error"
                  ? "bg-bad-soft text-bad"
                  : issue.severity === "warning"
                    ? "bg-warn/12 text-warn"
                    : "bg-line2 text-muted",
              )}
            >
              {where ? <b className="font-semibold">{where}: </b> : null}
              {issue.message}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ *
 * Room
 * ------------------------------------------------------------------ */

function RoomInspector({ id }: { id: string }) {
  const project = useEditor((s) => s.project);
  const room = project.rooms.find((r) => r.id === id);
  const readOnly = useEditor((s) => s.readOnly);
  const select = useEditor((s) => s.select);
  const updateRoom = useEditor((s) => s.updateRoom);
  const deleteRoom = useEditor((s) => s.deleteRoom);
  const clearRoom = useEditor((s) => s.clearRoom);
  const addOpening = useEditor((s) => s.addOpening);
  const addItem = useEditor((s) => s.addItem);
  const applyTemplate = useEditor((s) => s.applyTemplate);
  const nextVariant = useEditor((s) => s.nextVariant);
  const confirming = useEditor((s) => s.confirming);
  const confirm = useEditor((s) => s.confirm);
  const report = useEditor((s) => s.report);

  const [side, setSide] = useState<Side>("N");
  const [addKey, setAddKey] = useState<string>("");

  if (!room) return <ProjectInspector />;

  const inner = innerRect(room);
  const templates = templatesFor(room.type);
  const openings = openingsOn(project.openings, room);
  const contents = project.items.filter((item) => {
    const f = footprint(item);
    return (
      f.x + f.w / 2 >= room.x && f.x + f.w / 2 <= room.x + room.w &&
      f.y + f.d / 2 >= room.y && f.y + f.d / 2 <= room.y + room.d
    );
  });
  const roomIssues = report.byRoom.get(room.id) ?? [];

  const catalogOptions = catalogByCategory()
    .filter((group) => ROOM_TYPES[room.type].categories.includes(group.category) || true)
    .flatMap((group) =>
      group.items.map((item) => ({
        value: item.key,
        label: item.name,
        group: group.category,
      })),
    );
  const preferred =
    catalogOptions.find((o) => ROOM_TYPES[room.type].categories[0] === o.group)?.value ??
    catalogOptions[0]?.value ??
    "";

  return (
    <div className="flex flex-col gap-5">
      <Section
        aside={
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => select({ kind: "none" })}>
            Done
          </button>
        }
      >
        <h2 className="m-0 font-display text-[16px] font-bold tracking-tight">{room.name}</h2>
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="Name"
            value={room.name}
            disabled={readOnly}
            onCommit={(v) => updateRoom(room.id, { name: v })}
          />
          <SelectField<RoomType>
            label="Room type"
            value={room.type}
            disabled={readOnly}
            options={ROOM_TYPE_LIST.map((t) => ({ value: t.id, label: t.label }))}
            onChange={(v) => updateRoom(room.id, { type: v })}
          />
          <NumberField
            label="Width"
            value={room.w}
            suffix="mm"
            min={1200}
            disabled={readOnly}
            onCommit={(v) => updateRoom(room.id, { w: v })}
          />
          <NumberField
            label="Depth"
            value={room.d}
            suffix="mm"
            min={1200}
            disabled={readOnly}
            onCommit={(v) => updateRoom(room.id, { d: v })}
          />
          <NumberField
            label="Left edge"
            value={room.x}
            suffix="mm"
            disabled={readOnly}
            onCommit={(v) => updateRoom(room.id, { x: v })}
          />
          <NumberField
            label="Top edge"
            value={room.y}
            suffix="mm"
            disabled={readOnly}
            onCommit={(v) => updateRoom(room.id, { y: v })}
          />
        </div>
        <Note>
          Dimensions are wall centre to wall centre, as on a builder&rsquo;s drawing. Clear floor
          inside: {formatLength(inner.w, project.units)} × {formatLength(inner.d, project.units)},{" "}
          {formatArea(inner.w * inner.d, project.units)}.
        </Note>
        {roomIssues.length ? (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {roomIssues.map((issue, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-md px-2 py-1.5 text-[12px]",
                  issue.severity === "error" ? "bg-bad-soft text-bad" : "bg-warn/12 text-warn",
                )}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </Section>

      <Section title="Ceiling and finishes">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Ceiling height"
            value={room.ceiling ?? project.ceiling}
            suffix="mm"
            step={50}
            min={1800}
            max={6000}
            disabled={readOnly}
            onCommit={(v) => updateRoom(room.id, { ceiling: v })}
          />
          <NumberField
            label="False ceiling drop"
            value={room.falseCeiling ?? 0}
            suffix="mm"
            step={25}
            min={0}
            max={900}
            disabled={readOnly}
            onCommit={(v) => updateRoom(room.id, { falseCeiling: v })}
          />
        </div>
        <SelectField<string>
          label="Accent wall"
          value={room.accentWall ?? ""}
          disabled={readOnly}
          options={[
            { value: "", label: "None" },
            ...(["N", "S", "W", "E"] as Side[]).map((s) => ({ value: s, label: SIDE_LABEL[s] })),
          ]}
          onChange={(v) => updateRoom(room.id, { accentWall: (v || null) as Side | null })}
        />
      </Section>

      <Section title="Layouts for this room">
        {templates.length ? (
          <div className="flex flex-col gap-2">
            {templates.map((template) => {
              const variants = variantsOf(room, template, project);
              const best = variants[0]?.score ?? 99;
              const current = room.layout === template.id;
              return (
                <div
                  key={template.id}
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1 rounded-lg border bg-paper px-3 py-2.5",
                    current ? "border-accent shadow-[inset_3px_0_0_var(--accent)]" : "border-line",
                  )}
                >
                  <b className="text-[13px] font-semibold">{template.name}</b>
                  <div className="col-start-2 row-span-2 row-start-1 flex flex-col items-end gap-1.5">
                    {best === 0 ? (
                      <Pill tone="ok">Fits</Pill>
                    ) : (
                      <Pill tone="bad">
                        {best.toFixed(best % 1 ? 1 : 0)} clash{best === 1 ? "" : "es"}
                      </Pill>
                    )}
                    {current && variants.length > 1 ? (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={readOnly}
                        onClick={() => nextVariant(room.id)}
                      >
                        Turn it ({(room.variant ?? 0) + 1}/{variants.length})
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={cn("btn btn-sm", !current && "btn-primary")}
                        disabled={readOnly}
                        onClick={() => applyTemplate(room.id, template.id)}
                      >
                        {current ? "Reapply" : "Apply"}
                      </button>
                    )}
                  </div>
                  <p className="col-start-1 m-0 text-[12px] text-muted">{template.note}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty>No ready-made layouts for a {ROOM_TYPES[room.type].label.toLowerCase()} yet. Add pieces below.</Empty>
        )}
        <Note>
          Each layout is sized to this room and tried in eight orientations; the score counts how
          many clashes remain.
        </Note>
      </Section>

      <Section title="Doors, openings and windows">
        {openings.length ? (
          <Rows>
            {openings.map((opening) => (
              <Row
                key={opening.id}
                onClick={() => select({ kind: "opening", id: opening.id })}
                left={
                  <span className="truncate">
                    {OPENING_LABEL[opening.kind]} · {SIDE_LABEL[openingSide(opening, room) ?? "N"]}
                  </span>
                }
                right={<span className="tnum text-[12px] text-muted">{opening.w} mm</span>}
              />
            ))}
          </Rows>
        ) : (
          <Empty>No doors on this room — nobody can get in.</Empty>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <SelectField<Side>
            label="Wall"
            value={side}
            options={(["N", "S", "W", "E"] as Side[]).map((s) => ({ value: s, label: SIDE_LABEL[s] }))}
            onChange={setSide}
          />
          <div className="flex flex-wrap gap-1.5">
            {(["door", "cased", "window", "frenchWindow", "sliding"] as OpeningKind[]).map((kind) => (
              <button
                key={kind}
                type="button"
                className="btn btn-sm"
                disabled={readOnly}
                onClick={() => addOpening(room.id, side, kind)}
              >
                {OPENING_LABEL[kind]}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="Pieces in this room" aside={<span className="text-[11px] text-muted">{contents.length}</span>}>
        {contents.length ? (
          <Rows>
            {contents.map((item) => {
              const catalog = CATALOG[item.key];
              const flagged = report.byItem.has(item.id);
              return (
                <Row
                  key={item.id}
                  onClick={() => select({ kind: "item", id: item.id })}
                  left={<span className="truncate">{item.label ?? catalog?.name ?? item.key}</span>}
                  right={
                    flagged ? (
                      <Pill tone="bad">Check</Pill>
                    ) : (
                      <span className="tnum text-[12px] text-muted">
                        {catalog?.unit === "clientSupplied"
                          ? "Client"
                          : formatMoney(rateFor(project, item.key) * quantityOf(item), project.currency, true)}
                      </span>
                    )
                  }
                />
              );
            })}
          </Rows>
        ) : null}
        <div className="flex gap-2">
          <select
            className="input flex-1"
            value={addKey || preferred}
            disabled={readOnly}
            onChange={(e) => setAddKey(e.target.value)}
          >
            {CATEGORY_ORDER.map((category) => {
              const items = catalogOptions.filter((o) => o.group === category);
              if (!items.length) return null;
              return (
                <optgroup key={category} label={category}>
                  {items.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <button
            type="button"
            className="btn"
            disabled={readOnly}
            onClick={() => addItem(room.id, addKey || preferred)}
          >
            Add
          </button>
        </div>
      </Section>

      <Section>
        {confirming === `del-room-${room.id}` ? (
          <ConfirmInline
            question={`Delete ${room.name}, its ${contents.length} pieces and its doors?`}
            confirmLabel="Delete room"
            onConfirm={() => deleteRoom(room.id)}
            onCancel={() => confirm(null)}
          />
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn"
              disabled={readOnly || !contents.length}
              onClick={() => clearRoom(room.id)}
            >
              Clear furniture
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={readOnly}
              onClick={() => confirm(`del-room-${room.id}`)}
            >
              Delete room
            </button>
          </div>
        )}
      </Section>
    </div>
  );
}

const OPENING_LABEL: Record<OpeningKind, string> = {
  door: "Door",
  cased: "Opening",
  window: "Window",
  frenchWindow: "French window",
  sliding: "Sliding door",
};

/* ------------------------------------------------------------------ *
 * Opening
 * ------------------------------------------------------------------ */

function OpeningInspector({ id }: { id: string }) {
  const project = useEditor((s) => s.project);
  const opening = project.openings.find((o) => o.id === id);
  const readOnly = useEditor((s) => s.readOnly);
  const select = useEditor((s) => s.select);
  const updateOpening = useEditor((s) => s.updateOpening);
  const deleteOpening = useEditor((s) => s.deleteOpening);
  const report = useEditor((s) => s.report);

  if (!opening) return <ProjectInspector />;

  const host = project.rooms.find((r) => openingSide(opening, r) !== null);
  const side = host ? openingSide(opening, host) : null;
  const offset = host ? (opening.o === "h" ? opening.x - host.x : opening.y - host.y) : 0;
  const issues = report.byItem.get(opening.id) ?? report.issues.filter((i) => i.target === opening.id);
  const blocked = report.blockedOpenings.has(opening.id);

  return (
    <div className="flex flex-col gap-5">
      <Section
        aside={
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => select({ kind: "none" })}>
            Done
          </button>
        }
      >
        <h2 className="m-0 font-display text-[16px] font-bold tracking-tight">
          {OPENING_LABEL[opening.kind]}
        </h2>
        <Note>
          {host ? `On the ${SIDE_LABEL[side ?? "N"].toLowerCase()} of ${host.name}` : "Not on any room wall"}
        </Note>
        {blocked ? <Pill tone="bad">Furniture is blocking this</Pill> : null}
        {issues.map((issue, i) => (
          <Note key={i} tone={issue.severity === "error" ? "bad" : "warn"}>
            {issue.message}
          </Note>
        ))}
      </Section>

      <Section title="Size and type">
        <SelectField<OpeningKind>
          label="Type"
          value={opening.kind}
          disabled={readOnly}
          options={(Object.keys(OPENING_LABEL) as OpeningKind[]).map((k) => ({
            value: k,
            label: OPENING_LABEL[k],
          }))}
          onChange={(v) => updateOpening(opening.id, { kind: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Width"
            value={opening.w}
            suffix="mm"
            min={300}
            disabled={readOnly}
            onCommit={(v) => updateOpening(opening.id, { w: v })}
          />
          <NumberField
            label="Height"
            value={opening.h}
            suffix="mm"
            min={300}
            disabled={readOnly}
            onCommit={(v) => updateOpening(opening.id, { h: v })}
          />
          <NumberField
            label="Sill height"
            value={opening.sill}
            suffix="mm"
            min={0}
            disabled={readOnly}
            hint={opening.sill === 0 ? "A door or opening to the floor" : undefined}
            onCommit={(v) => updateOpening(opening.id, { sill: v })}
          />
          {host ? (
            <NumberField
              label="From the corner"
              value={offset}
              suffix="mm"
              disabled={readOnly}
              onCommit={(v) =>
                updateOpening(
                  opening.id,
                  opening.o === "h" ? { x: host.x + v } : { y: host.y + v },
                )
              }
            />
          ) : null}
        </div>
      </Section>

      {opening.kind === "door" ? (
        <Section title="Swing">
          <div className="flex flex-wrap gap-2">
            <SegmentedControl
              value={opening.hinge ?? "start"}
              options={[
                { value: "start", label: "Hinge near corner" },
                { value: "end", label: "Hinge far corner" },
              ]}
              onChange={(v) => updateOpening(opening.id, { hinge: v as "start" | "end" })}
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={readOnly}
              onClick={() => updateOpening(opening.id, { swing: opening.swing === 1 ? -1 : 1 })}
            >
              Flip which way it opens
            </button>
          </div>
          <Note>
            The swing is checked against the furniture, so flipping a door is often all it takes to
            clear a clash.
          </Note>
        </Section>
      ) : null}

      <Section>
        <button
          type="button"
          className="btn btn-danger"
          disabled={readOnly}
          onClick={() => deleteOpening(opening.id)}
        >
          <Trash2 size={14} /> Remove
        </button>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Item
 * ------------------------------------------------------------------ */

function ItemInspector({ id }: { id: string }) {
  const project = useEditor((s) => s.project);
  const item = project.items.find((i) => i.id === id);
  const readOnly = useEditor((s) => s.readOnly);
  const select = useEditor((s) => s.select);
  const updateItem = useEditor((s) => s.updateItem);
  const rotateItem = useEditor((s) => s.rotateItem);
  const duplicateItem = useEditor((s) => s.duplicateItem);
  const deleteItem = useEditor((s) => s.deleteItem);
  const toggleLock = useEditor((s) => s.toggleLock);
  const setRate = useEditor((s) => s.setRate);
  const report = useEditor((s) => s.report);

  if (!item) return <ProjectInspector />;
  const catalog = CATALOG[item.key];
  if (!catalog) return <ProjectInspector />;

  const { w, d, h } = itemSize(item);
  const issues = report.byItem.get(item.id) ?? [];
  const host = project.rooms.find((r) => {
    const f = footprint(item);
    const cx = f.x + f.w / 2;
    const cy = f.y + f.d / 2;
    return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.d;
  });
  const rate = rateFor(project, item.key);
  const qty = quantityOf(item);
  const overridden = project.rates[item.key] !== undefined;

  return (
    <div className="flex flex-col gap-5">
      <Section
        aside={
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => select({ kind: "none" })}>
            Done
          </button>
        }
      >
        <h2 className="m-0 font-display text-[16px] font-bold tracking-tight">{catalog.name}</h2>
        <Note>
          {host ? `In ${host.name}` : "Outside every room"} · {w} × {d} × {h} mm
          {catalog.leadWeeks ? ` · ${catalog.leadWeeks} week lead time` : ""}
        </Note>
        {catalog.spec ? <Note>{catalog.spec}</Note> : null}
        {issues.length ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {issues.map((issue, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[12.5px] leading-snug",
                  issue.severity === "error" ? "bg-bad-soft text-bad" : "bg-warn/12 text-warn",
                )}
              >
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <Pill tone="ok">Clear of walls, doors and walkways</Pill>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            disabled={readOnly || item.locked}
            onClick={() => rotateItem(item.id)}
          >
            <RotateCw size={14} /> Rotate
          </button>
          <button type="button" className="btn" disabled={readOnly} onClick={() => duplicateItem(item.id)}>
            <Copy size={14} /> Duplicate
          </button>
          <button
            type="button"
            className="btn"
            disabled={readOnly}
            onClick={() => toggleLock(item.id)}
            title="Locked pieces are left alone by auto-layout and cannot be dragged"
          >
            {item.locked ? <Lock size={14} /> : <LockOpen size={14} />}
            {item.locked ? "Unlock" : "Lock"}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={readOnly}
            onClick={() => deleteItem(item.id)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </Section>

      <Section title="Position and size">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Centre from left"
            value={item.cx}
            step={25}
            suffix="mm"
            disabled={readOnly || item.locked}
            onCommit={(v) => updateItem(item.id, { cx: v })}
          />
          <NumberField
            label="Centre from top"
            value={item.cy}
            step={25}
            suffix="mm"
            disabled={readOnly || item.locked}
            onCommit={(v) => updateItem(item.id, { cy: v })}
          />
          {catalog.resize ? (
            <NumberField
              label={catalog.resize === "w" ? "Length" : "Width"}
              value={w}
              step={50}
              min={catalog.wRange?.[0] ?? 300}
              max={catalog.wRange?.[1] ?? 9000}
              suffix="mm"
              disabled={readOnly}
              onCommit={(v) => updateItem(item.id, { w: v })}
            />
          ) : null}
          {catalog.resize === "wd" ? (
            <NumberField
              label="Depth"
              value={d}
              step={50}
              min={300}
              suffix="mm"
              disabled={readOnly}
              onCommit={(v) => updateItem(item.id, { d: v })}
            />
          ) : null}
          {catalog.wallHung ? (
            <NumberField
              label="Height above floor"
              value={item.z ?? 0}
              step={50}
              min={0}
              suffix="mm"
              disabled={readOnly}
              onCommit={(v) => updateItem(item.id, { z: v })}
            />
          ) : null}
        </div>
        <SegmentedControl
          value={String(item.rot)}
          options={[
            { value: "0", label: "0°" },
            { value: "90", label: "90°" },
            { value: "180", label: "180°" },
            { value: "270", label: "270°" },
          ]}
          onChange={(v) => updateItem(item.id, { rot: Number(v) as 0 | 90 | 180 | 270 })}
        />
        <Note>
          Arrow keys nudge by 50 mm, shift-arrow by 10 mm.
          {catalog.clearance
            ? ` Needs ${catalog.clearance} mm clear in front, shown dashed on the plan.`
            : ""}
        </Note>
      </Section>

      <Section title="Pricing">
        {catalog.unit === "clientSupplied" ? (
          <Note>Supplied by the client, so it is listed on the quote but not priced.</Note>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NumberField
                label={`Rate per ${catalog.unit === "perMetre" ? "metre" : catalog.unit === "perSqm" ? "m²" : "piece"}`}
                value={rate}
                step={100}
                min={0}
                suffix={project.currency.code}
                disabled={readOnly}
                onCommit={(v) => setRate(item.key, v)}
              />
              <Field label="Amount for this piece">
                <div className="input input-num flex items-center bg-bg">
                  {formatMoney(rate * qty, project.currency)}
                </div>
              </Field>
            </div>
            {overridden ? (
              <button type="button" className="btn btn-sm" onClick={() => setRate(item.key, null)}>
                Reset to the catalog rate
              </button>
            ) : (
              <Note>
                Changing the rate here changes it for every {catalog.name.toLowerCase()} in this
                project.
              </Note>
            )}
          </>
        )}
      </Section>

      <Section title="Label on drawings">
        <TextField
          label="Label"
          value={item.label ?? ""}
          placeholder={catalog.name}
          disabled={readOnly}
          onCommit={(v) => updateItem(item.id, { label: v })}
        />
      </Section>

      {host ? (
        <Section>
          <button
            type="button"
            className="btn"
            onClick={() => select({ kind: "room", id: host.id })}
          >
            Back to {host.name}
          </button>
        </Section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
