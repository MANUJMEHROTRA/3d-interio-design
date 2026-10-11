"use client";

import {
  buildQuote,
  formatArea,
  formatMoney,
  getStyle,
  innerRect,
  ROOM_TYPES,
  type Project,
} from "@layoutcraft/core";
import type { FocusRequest } from "@layoutcraft/render3d";
import { Eye, Footprints, MessageSquarePlus, Printer } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useMemo, useRef, useState } from "react";
import { QuoteSheet } from "@/components/editor/QuoteSheet";
import { SegmentedControl, Spinner, Toast } from "@/components/ui";
import { cn } from "@/lib/cn";

const Viewer = dynamic(() => import("@layoutcraft/render3d").then((m) => ({ default: m.Viewer })), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-[13px] text-muted">
      <span className="flex items-center gap-2">
        <Spinner /> Loading the 3D view…
      </span>
    </div>
  ),
});

interface Share {
  scope: "PRESENTATION" | "QUOTE" | "FULL";
  allowComments: boolean;
  design: Project;
  studio: {
    name: string;
    address?: string | null;
    contact?: string | null;
    taxId?: string | null;
    logoUrl?: string | null;
    brandColor?: string | null;
    showBranding: boolean;
  };
  pinnedAt: Date | string | null;
}

/**
 * What the client sees.
 *
 * Written for someone who has never used the app and will not be shown how:
 * no jargon, nothing to configure, and the one thing they are likely to want —
 * walking through their own flat — is a single button. The quote is a separate
 * tab so a presentation link can omit it entirely.
 */
export function ClientPortal({
  token,
  share,
  password,
}: {
  token: string;
  share: Share;
  password?: string;
}) {
  const showDesign = share.scope !== "QUOTE";
  const showQuote = share.scope !== "PRESENTATION";
  const [tab, setTab] = useState<"design" | "quote">(showDesign ? "design" : "quote");
  const [mode, setMode] = useState<"orbit" | "walk">("orbit");
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [commenting, setCommenting] = useState(false);
  const [toast, setToast] = useState<{ id: number; message: string; tone: "good" | "bad" } | null>(null);
  const nonce = useRef(0);

  const project = share.design;
  const quote = useMemo(() => buildQuote(project), [project]);
  const style = getStyle(project.styleId);
  const carpetArea = project.rooms.reduce((sum, r) => {
    const inner = innerRect(r);
    return sum + inner.w * inner.d;
  }, 0);

  const requestFocus = useCallback((preset: FocusRequest["preset"]) => {
    nonce.current += 1;
    setFocus({ preset, nonce: nonce.current });
  }, []);

  const accent = share.studio.brandColor ?? undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            {share.studio.logoUrl ? (
              <img src={share.studio.logoUrl} alt="" className="h-8 w-auto object-contain" />
            ) : null}
            <div className="min-w-0">
              <b className="block truncate font-display text-[15.5px] font-bold" style={{ color: accent }}>
                {share.studio.name}
              </b>
              <span className="block truncate text-[12px] text-muted">
                {project.name}
                {project.client ? ` · for ${project.client}` : ""}
              </span>
            </div>
          </div>

          {showDesign && showQuote ? (
            <nav className="ml-auto">
              <SegmentedControl
                value={tab}
                options={[
                  { value: "design", label: "The design" },
                  { value: "quote", label: "The quotation" },
                ]}
                onChange={(v) => setTab(v as "design" | "quote")}
              />
            </nav>
          ) : (
            <span className="ml-auto" />
          )}

          {share.allowComments ? (
            <button type="button" className="btn btn-sm" onClick={() => setCommenting(true)}>
              <MessageSquarePlus size={14} /> Leave a note
            </button>
          ) : null}
          {tab === "quote" ? (
            <button type="button" className="btn btn-sm" onClick={() => window.print()}>
              <Printer size={14} /> Print
            </button>
          ) : null}
        </div>
      </header>

      {tab === "design" && showDesign ? (
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-4 px-5 py-5">
          <section className="grid gap-3 sm:grid-cols-4">
            <Figure label="Style" value={style.name} />
            <Figure label="Rooms" value={String(project.rooms.length)} />
            <Figure label="Carpet area" value={formatArea(carpetArea, project.units)} />
            {showQuote ? (
              <Figure label="Total" value={formatMoney(quote.total, project.currency, true)} />
            ) : (
              <Figure label="Pieces specified" value={String(project.items.length)} />
            )}
          </section>

          <section className="relative h-[clamp(380px,62vh,760px)] overflow-hidden rounded-xl border border-line bg-paper">
            <Viewer
              project={project}
              mode={mode}
              focus={focus}
              quality="standard"
              className="h-full w-full"
            />
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
              <div className="pointer-events-auto flex flex-wrap gap-1.5">
                <SegmentedControl
                  value={mode}
                  options={[
                    { value: "orbit", label: "Look around" },
                    { value: "walk", label: "Walk through" },
                  ]}
                  onChange={(v) => setMode(v as "orbit" | "walk")}
                  className="bg-paper/90 shadow-card backdrop-blur"
                />
              </div>
            </div>
            <p className="pointer-events-none absolute bottom-2.5 left-3 right-3 text-[11.5px] text-muted">
              {mode === "walk"
                ? "Use W A S D to walk, and drag to look around."
                : "Drag to turn the model, scroll to zoom."}
            </p>
          </section>

          <section>
            <h2 className="label-caps m-0 mb-2">Go to a room</h2>
            <div className="flex flex-wrap gap-2">
              {project.rooms.map((room) => (
                <button
                  key={room.id}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setMode("orbit");
                    requestFocus({ kind: "eyeLevel", roomId: room.id });
                  }}
                >
                  <Eye size={13} />
                  {room.name}
                </button>
              ))}
              {project.rooms.length ? (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => requestFocus({ kind: "overview" })}
                >
                  <Footprints size={13} /> Whole flat
                </button>
              ) : null}
            </div>
          </section>

          <section>
            <h2 className="label-caps m-0 mb-2">Room by room</h2>
            <ul className="grid list-none gap-2 p-0 sm:grid-cols-2 lg:grid-cols-3">
              {project.rooms.map((room) => {
                const inner = innerRect(room);
                const group = quote.groups.find((g) => g.roomId === room.id);
                return (
                  <li
                    key={room.id}
                    className="flex flex-col gap-1.5 rounded-xl border border-line bg-paper p-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <i
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: `hsl(${ROOM_TYPES[room.type].hue} 52% 50% / 0.6)` }}
                      />
                      <b className="text-[14px] font-semibold">{room.name}</b>
                    </div>
                    <span className="text-[12px] text-muted">
                      {formatArea(inner.w * inner.d, project.units)}
                      {group ? ` · ${group.rows.length} items specified` : ""}
                    </span>
                    {showQuote && group ? (
                      <span className="tnum text-[13px]">
                        {formatMoney(group.total, project.currency)}
                      </span>
                    ) : null}
                    {room.notes ? (
                      <p className="m-0 text-[12px] leading-snug text-muted">{room.notes}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        </main>
      ) : null}

      {tab === "quote" && showQuote ? (
        <main className="flex-1 bg-bg px-4 py-6">
          {/* the portal footer already carries the credit, so the sheet omits it */}
          <QuoteSheet project={project} studio={{ ...share.studio, showBranding: false }} />
          {share.pinnedAt ? (
            <p className="no-print mx-auto mt-4 max-w-[860px] text-center text-[11.5px] text-muted">
              This quotation is fixed as of{" "}
              {new Date(share.pinnedAt).toLocaleDateString(project.currency.locale, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              . Later changes to the design will not alter it.
            </p>
          ) : null}
        </main>
      ) : null}

      <footer className="no-print border-t border-line px-5 py-5 text-center text-[11.5px] text-muted">
        {share.studio.showBranding ? "Prepared with Layoutcraft Studio" : share.studio.name}
      </footer>

      {commenting ? (
        <CommentDialog
          token={token}
          password={password}
          rooms={project.rooms.map((r) => ({ id: r.id, name: r.name }))}
          onClose={() => setCommenting(false)}
          onDone={(ok) =>
            setToast({
              id: Date.now(),
              message: ok
                ? "Thank you — your designer has it."
                : "That could not be sent. Please try again.",
              tone: ok ? "good" : "bad",
            })
          }
        />
      ) : null}

      {toast ? <Toast key={toast.id} message={toast.message} tone={toast.tone} /> : null}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-paper px-4 py-3">
      <span className="label-caps block">{label}</span>
      <b className="tnum mt-0.5 block text-[18px] font-semibold">{value}</b>
    </div>
  );
}

function CommentDialog({
  token,
  password,
  rooms,
  onClose,
  onDone,
}: {
  token: string;
  password?: string;
  rooms: Array<{ id: string; name: string }>;
  onClose: () => void;
  onDone: (ok: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [roomId, setRoomId] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!name.trim() || !body.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/share/${token}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          authorName: name,
          body,
          password,
          targetKind: roomId ? "ROOM" : "PROJECT",
          targetId: roomId || undefined,
        }),
      });
      onDone(response.ok);
      if (response.ok) onClose();
    } catch {
      onDone(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Leave a note"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-[460px] flex-col gap-3.5 rounded-xl border border-line bg-panel p-5 shadow-pop">
        <h2 className="m-0 font-display text-[18px] font-bold tracking-tight">Leave a note</h2>
        <p className="m-0 text-[12.5px] text-muted">
          Your designer will see this against the project.
        </p>

        <label className="field">
          <span>Your name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>

        {rooms.length ? (
          <label className="field">
            <span>About which room?</span>
            <select className="input" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">The project overall</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="field">
          <span>Your note</span>
          <textarea
            className="input resize-y"
            rows={5}
            value={body}
            maxLength={4000}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !name.trim() || !body.trim()}
            onClick={send}
          >
            {busy ? <Spinner /> : null} Send
          </button>
        </div>
      </div>
    </div>
  );
}
