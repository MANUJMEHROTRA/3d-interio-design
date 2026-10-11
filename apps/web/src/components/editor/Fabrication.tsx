"use client";

import {
  bomCsv,
  buildBom,
  formatMoney,
  issuesCsv,
  modelBundle,
  printBundle,
  printStats,
  quoteCsv,
  roomScheduleCsv,
  slug,
} from "@layoutcraft/core";
import { Box, Download, FileSpreadsheet, Printer } from "lucide-react";
import { useMemo } from "react";
import { Note, NumberField, Pill, Section, SegmentedControl, SelectField, Stats, Toggle } from "@/components/ui";
import { useEditor } from "@/lib/editor-store";

/** Trigger a browser download for a blob or a string. */
function save(filename: string, data: Blob | string, mime = "text/csv;charset=utf-8") {
  const blob = typeof data === "string" ? new Blob([data], { type: mime }) : data;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Everything that leaves the app as a file.
 *
 * Grouped by who receives it — the client, the factory, the print bureau, the
 * visualiser — rather than by file format, because that is how a designer
 * thinks about it at the end of a project.
 */
export function Fabrication({
  canPrintExport,
  canModelExport,
}: {
  canPrintExport: boolean;
  canModelExport: boolean;
}) {
  const project = useEditor((s) => s.project);
  const setPrint = useEditor((s) => s.setPrint);
  const readOnly = useEditor((s) => s.readOnly);
  const notify = useEditor((s) => s.notify);

  const stats = useMemo(() => printStats(project), [project]);
  const bom = useMemo(() => buildBom(project), [project]);
  const base = slug(project.name);

  const guard = (allowed: boolean, what: string, action: () => void) => () => {
    if (!allowed) {
      notify(`${what} needs a paid plan. Upgrade from Settings → Billing.`, "bad");
      return;
    }
    action();
  };

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 p-1">
      <Section title="For the client and the site">
        <div className="grid gap-2 sm:grid-cols-2">
          <ExportCard
            icon={<FileSpreadsheet size={16} />}
            title="Quotation"
            detail="The priced schedule, room by room, as a spreadsheet."
            onClick={() => save(`${base}-quotation.csv`, quoteCsv(project))}
          />
          <ExportCard
            icon={<FileSpreadsheet size={16} />}
            title="Bill of materials"
            detail={`${bom.length} rows: every piece with its size, finish and lead time.`}
            onClick={() => save(`${base}-bom.csv`, bomCsv(project))}
          />
          <ExportCard
            icon={<FileSpreadsheet size={16} />}
            title="Room schedule"
            detail="Area and cost per room, for the summary page of a proposal."
            onClick={() => save(`${base}-rooms.csv`, roomScheduleCsv(project))}
          />
          <ExportCard
            icon={<FileSpreadsheet size={16} />}
            title="Design review"
            detail="The issue list, so it can be circulated and signed off."
            onClick={() => save(`${base}-review.csv`, issuesCsv(project))}
          />
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => window.print()}
        >
          <Printer size={14} /> Print or save the quotation as PDF
        </button>
      </Section>

      <Section title="For a 3D visualiser">
        <ExportCard
          icon={<Box size={16} />}
          title="OBJ and MTL massing model"
          detail="Block geometry in metres, grouped by room and by piece, with the finish schedule carried across as PBR materials."
          locked={!canModelExport}
          onClick={guard(canModelExport, "Model export", () =>
            save(`${base}-model.zip`, modelBundle(project, base), "application/zip"),
          )}
        />
        <Note>
          Group names are stable across exports, so a visualiser can replace the blocking with their
          own assets and re-import an updated layout without losing their work.
        </Note>
      </Section>

      <Section
        title="3D-printed presentation model"
        aside={stats.fitsBed ? <Pill tone="ok">Fits the bed</Pill> : <Pill tone="bad">Too big</Pill>}
      >
        <Stats
          cells={[
            [`${stats.sx.toFixed(0)}×${stats.sy.toFixed(0)}`, "Footprint, mm"],
            [`${stats.sz.toFixed(0)} mm`, "Height"],
            [`${Math.round(stats.grams)} g`, "Material"],
            [`${stats.hours.toFixed(1)} h`, "Print time"],
            [formatMoney(stats.cost, project.currency), "Bureau cost"],
            [`${(stats.triangles / 1000).toFixed(1)}k`, "Triangles"],
          ]}
        />
        {!stats.fitsBed ? (
          <Note tone="bad">
            Larger than a {stats.bed} mm bed. Choose 1:100, a bigger printer, or split the model.
          </Note>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <SelectField<string>
            label="Scale"
            value={String(project.print.scale)}
            disabled={readOnly}
            options={[
              { value: "50", label: "1:50" },
              { value: "75", label: "1:75" },
              { value: "100", label: "1:100" },
            ]}
            onChange={(v) => setPrint({ scale: Number(v) as 50 | 75 | 100 })}
          />
          <SelectField<string>
            label="Walls"
            value={project.print.walls}
            disabled={readOnly}
            options={[
              { value: "full", label: `Full height, ${(project.ceiling / 1000).toFixed(2)} m` },
              { value: "cut", label: "Cutaway, 1.15 m" },
            ]}
            onChange={(v) => setPrint({ walls: v as "full" | "cut" })}
          />
          <SelectField<string>
            label="Printer bed"
            value={String(project.print.bed)}
            disabled={readOnly}
            options={[220, 256, 300, 350, 500].map((v) => ({ value: String(v), label: `${v} × ${v} mm` }))}
            onChange={(v) => setPrint({ bed: Number(v) })}
          />
          <NumberField
            label="Thinnest part"
            value={project.print.minFeature}
            step={0.1}
            min={0.6}
            max={5}
            suffix="mm"
            disabled={readOnly}
            onCommit={(v) => setPrint({ minFeature: v })}
          />
          <NumberField
            label="Bureau rate"
            value={project.print.ratePerGram}
            step={1}
            min={0}
            suffix={`${project.currency.code}/g`}
            disabled={readOnly}
            onCommit={(v) => setPrint({ ratePerGram: v })}
          />
        </div>

        <Toggle
          label="Include the furniture"
          checked={project.print.includeFurniture}
          onChange={(v) => setPrint({ includeFurniture: v })}
        />
        <Toggle
          label="Furniture as a separate file"
          hint="So it can be printed in a contrasting colour and arranged by hand"
          checked={project.print.separateFurniture}
          disabled={!project.print.includeFurniture}
          onChange={(v) => setPrint({ separateFurniture: v })}
        />
        <Note>
          Legs, shelves and glass partitions that scale below {project.print.minFeature} mm are
          thickened rather than dropped, because a chair with no legs reads as broken while a chair
          with chunky legs reads as a model. Rugs are left out.
        </Note>

        <button
          type="button"
          className="btn btn-primary self-start"
          onClick={guard(canPrintExport, "The 3D-print bundle", () =>
            save(
              `${base}-print-1to${project.print.scale}.zip`,
              printBundle(project, base),
              "application/zip",
            ),
          )}
        >
          <Download size={14} /> Download print files (.zip)
          {!canPrintExport ? " — paid plans" : ""}
        </button>
        <Note>
          The zip holds STL files in millimetres, ready for Cura, PrusaSlicer or Bambu Studio, plus a
          note with the suggested settings.
        </Note>
      </Section>

      <Section title="Backup">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn"
            onClick={() =>
              save(
                `${base}.layoutcraft.json`,
                JSON.stringify(project, null, 1),
                "application/json",
              )
            }
          >
            <Download size={14} /> Export this project (.json)
          </button>
        </div>
        <Note>
          The JSON is the complete design document. It imports back into any Layoutcraft account, and
          older files are migrated forward automatically.
        </Note>
      </Section>
    </div>
  );
}

function ExportCard({
  icon,
  title,
  detail,
  onClick,
  locked,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 rounded-lg border border-line bg-paper px-3 py-3 text-left transition-colors hover:border-muted"
    >
      <span className="mt-0.5 shrink-0 text-accent">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="text-[13px] font-semibold">
          {title}
          {locked ? <span className="ml-1.5 font-normal text-muted">· paid plans</span> : null}
        </b>
        <span className="text-[11.5px] leading-snug text-muted">{detail}</span>
      </span>
    </button>
  );
}
