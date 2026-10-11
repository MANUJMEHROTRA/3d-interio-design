"use client";

import { buildQuote, formatMoney, type Project } from "@layoutcraft/core";
import { AlertTriangle, ArrowLeft, Check, Cloud, CloudOff, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Pill, Section, Toast } from "@/components/ui";
import { Fabrication } from "./Fabrication";
import { Inspector } from "./Inspector";
import { PlanCanvas } from "./PlanCanvas";
import { QuoteSheet, type StudioIdentity } from "./QuoteSheet";
import { QuoteSettings } from "./QuoteSettings";
import { ShareDialog } from "./ShareDialog";
import { ViewPanel, ViewSettings } from "./ViewPanel";
import { useEditor } from "@/lib/editor-store";
import { cn } from "@/lib/cn";

export type EditorTab = "plan" | "view" | "quote" | "files";

export interface EditorCapabilities {
  stillRender: boolean;
  modelExport: boolean;
  printExport: boolean;
  shareLinks: boolean;
}

export function Editor({
  projectId,
  initial,
  studio,
  readOnly,
  capabilities,
}: {
  projectId: string;
  initial: Project;
  studio: StudioIdentity;
  readOnly: boolean;
  capabilities: EditorCapabilities;
}) {
  const [tab, setTab] = useState<EditorTab>("plan");
  const [sharing, setSharing] = useState(false);

  const init = useEditor((s) => s.init);
  const ready = useEditor((s) => s.projectId === projectId);
  const project = useEditor((s) => s.project);
  const toast = useEditor((s) => s.toast);
  const setRate = useEditor((s) => s.setRate);

  // seed the store from the server-rendered document
  useEffect(() => {
    init(projectId, initial, readOnly);
  }, [projectId, initial, readOnly, init]);

  // warn before leaving with an unsaved change in flight
  const saveStatus = useEditor((s) => s.save.status);
  useEffect(() => {
    if (saveStatus !== "dirty" && saveStatus !== "saving") return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [saveStatus]);

  if (!ready || !project) {
    return (
      <div className="grid h-dvh place-items-center text-[13px] text-muted">Opening the project…</div>
    );
  }

  return (
    <div className="flex h-dvh flex-col gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
      <EditorHeader
        tab={tab}
        setTab={setTab}
        onShare={() => setSharing(true)}
        canShare={capabilities.shareLinks}
      />

      <main className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-h-0 min-w-0">
          {tab === "plan" ? <PlanCanvas /> : null}
          {tab === "view" ? <ViewPanel canRenderStills={capabilities.stillRender} /> : null}
          {tab === "quote" ? (
            <div className="h-full min-h-0 overflow-auto rounded-xl border border-line bg-bg p-4">
              <QuoteSheet
                project={project}
                studio={studio}
                editableRates={!readOnly}
                onRateChange={setRate}
              />
            </div>
          ) : null}
          {tab === "files" ? (
            <div className="h-full min-h-0 overflow-auto rounded-xl border border-line bg-panel p-4">
              <Fabrication
                canPrintExport={capabilities.printExport}
                canModelExport={capabilities.modelExport}
              />
            </div>
          ) : null}
        </section>

        <aside
          className="no-print min-h-0 overflow-y-auto rounded-xl border border-line bg-panel p-4"
          aria-label="Inspector"
        >
          {tab === "view" ? <ViewSettings /> : null}
          {tab === "quote" ? <QuoteSettings /> : null}
          {tab === "plan" || tab === "files" ? <Inspector /> : null}
        </aside>
      </main>

      {sharing ? (
        <ShareDialog projectId={projectId} onClose={() => setSharing(false)} />
      ) : null}

      {toast ? <Toast key={toast.id} message={toast.message} tone={toast.tone} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Header
 * ------------------------------------------------------------------ */

const TABS: Array<{ id: EditorTab; label: string }> = [
  { id: "plan", label: "Plan" },
  { id: "view", label: "3D view" },
  { id: "quote", label: "Quote" },
  { id: "files", label: "Exports" },
];

function EditorHeader({
  tab,
  setTab,
  onShare,
  canShare,
}: {
  tab: EditorTab;
  setTab: (tab: EditorTab) => void;
  onShare: () => void;
  canShare: boolean;
}) {
  const project = useEditor((s) => s.project);
  const report = useEditor((s) => s.report);
  const quote = useMemo(() => buildQuote(project), [project]);

  return (
    <header className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 pt-3">
      <Link
        href="/projects"
        className="btn btn-ghost btn-sm shrink-0"
        title="Back to all projects"
      >
        <ArrowLeft size={15} />
      </Link>

      <div className="flex min-w-0 flex-col">
        <h1 className="truncate font-display text-[17px] font-bold leading-tight tracking-tight">
          {project.name}
        </h1>
        <p className="truncate text-[12px] text-muted">
          {project.client ? `for ${project.client} · ` : ""}
          {formatMoney(quote.total, project.currency, true)}
          {report.errorCount ? ` · ${report.errorCount} to fix` : ""}
        </p>
      </div>

      <SaveIndicator />

      {report.errorCount ? (
        <Pill tone="bad">
          <AlertTriangle size={12} /> {report.errorCount}
        </Pill>
      ) : report.warningCount ? (
        <Pill tone="warn">{report.warningCount} to review</Pill>
      ) : (
        <Pill tone="ok">
          <Check size={12} /> Clear
        </Pill>
      )}

      <nav
        className="ml-auto flex gap-0.5 rounded-lg bg-line2 p-[3px]"
        role="tablist"
        aria-label="Workspace"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              tab === t.id ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <button
        type="button"
        className="btn btn-sm"
        onClick={onShare}
        title={canShare ? "Create a link for the client" : "Share links need a paid plan"}
      >
        <Share2 size={14} /> Share
      </button>
    </header>
  );
}

function SaveIndicator() {
  const save = useEditor((s) => s.save);

  const content =
    save.status === "saving" ? (
      <>
        <Cloud size={13} /> Saving…
      </>
    ) : save.status === "dirty" ? (
      <>
        <Cloud size={13} /> Unsaved
      </>
    ) : save.status === "error" ? (
      <>
        <CloudOff size={13} /> {save.message}
      </>
    ) : save.status === "readonly" ? (
      <>Read-only</>
    ) : (
      <>
        <Check size={13} /> Saved
      </>
    );

  return (
    <span
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-1.5 font-mono text-[11.5px]",
        save.status === "error" ? "text-bad" : "text-muted",
      )}
    >
      {content}
    </span>
  );
}
