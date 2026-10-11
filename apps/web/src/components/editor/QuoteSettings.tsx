"use client";

import {
  buildQuote,
  CURRENCY_LIST,
  formatMoney,
  printStats,
  STYLE_LIST,
  type Currency,
} from "@layoutcraft/core";
import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import {
  Note,
  NumberField,
  Section,
  SelectField,
  Stats,
  TextArea,
  TextField,
  Toggle,
} from "@/components/ui";
import { useEditor } from "@/lib/editor-store";

/** The side panel for the Quote tab: commercial terms rather than geometry. */
export function QuoteSettings() {
  const project = useEditor((s) => s.project);
  const setQuote = useEditor((s) => s.setQuote);
  const edit = useEditor((s) => s.edit);
  const readOnly = useEditor((s) => s.readOnly);
  const notify = useEditor((s) => s.notify);

  const quote = useMemo(() => buildQuote(project), [project]);
  const modelCost = useMemo(() => Math.round(printStats(project).cost / 100) * 100, [project]);
  const overrides = Object.keys(project.rates).length;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Totals">
        <Stats
          cells={[
            [formatMoney(quote.subtotal, project.currency, true), "Fit-out"],
            [
              formatMoney(
                quote.taxes.reduce((s, t) => s + t.amount, 0),
                project.currency,
                true,
              ),
              "Tax",
            ],
            [formatMoney(quote.total, project.currency, true), "Total"],
          ]}
        />
        <Note>Click any rate in the quotation to change it for this project.</Note>
      </Section>

      <Section title="Commercial terms">
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="Quote number"
            value={project.quote.number}
            disabled={readOnly}
            onCommit={(v) => setQuote({ number: v.trim() || project.quote.number })}
          />
          <NumberField
            label="Valid for"
            value={project.quote.validDays}
            step={1}
            min={1}
            max={365}
            suffix="days"
            disabled={readOnly}
            onCommit={(v) => setQuote({ validDays: Math.round(v) })}
          />
          <NumberField
            label="Design fee"
            value={project.quote.designFeePct}
            step={0.5}
            min={0}
            max={100}
            suffix="%"
            disabled={readOnly}
            onCommit={(v) => setQuote({ designFeePct: v })}
          />
          <NumberField
            label="Discount"
            value={project.quote.discountPct}
            step={0.5}
            min={0}
            max={90}
            suffix="%"
            disabled={readOnly}
            onCommit={(v) => setQuote({ discountPct: v })}
          />
        </div>
        <Note>
          The design fee is charged on the fit-out total after any discount. Tax applies to
          everything above it.
        </Note>
      </Section>

      <Section
        title="Tax"
        aside={
          project.quote.taxes.length < 4 ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              disabled={readOnly}
              onClick={() =>
                setQuote({ taxes: [...project.quote.taxes, { label: "Tax", rate: 0 }] })
              }
            >
              <Plus size={13} /> Add line
            </button>
          ) : null
        }
      >
        {project.quote.taxes.length ? (
          project.quote.taxes.map((tax, index) => (
            <div key={index} className="flex items-end gap-2">
              <TextField
                label="Label"
                value={tax.label}
                disabled={readOnly}
                onCommit={(v) => {
                  const taxes = [...project.quote.taxes];
                  taxes[index] = { ...tax, label: v.trim() || "Tax" };
                  setQuote({ taxes });
                }}
              />
              <NumberField
                label="Rate"
                value={tax.rate}
                step={0.5}
                min={0}
                max={100}
                suffix="%"
                disabled={readOnly}
                onCommit={(v) => {
                  const taxes = [...project.quote.taxes];
                  taxes[index] = { ...tax, rate: v };
                  setQuote({ taxes });
                }}
              />
              <button
                type="button"
                className="btn btn-sm btn-danger mb-[1px]"
                disabled={readOnly}
                aria-label={`Remove ${tax.label}`}
                onClick={() =>
                  setQuote({ taxes: project.quote.taxes.filter((_, i) => i !== index) })
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        ) : (
          <Note>No tax lines. Add GST, VAT or sales tax as your jurisdiction requires.</Note>
        )}
      </Section>

      <Section title="Currency and units">
        <div className="grid grid-cols-2 gap-2">
          <SelectField<string>
            label="Currency"
            value={project.currency.code}
            disabled={readOnly}
            options={CURRENCY_LIST.map((c) => ({ value: c.code, label: `${c.code} ${c.symbol}` }))}
            onChange={(code) => {
              const currency = CURRENCY_LIST.find((c) => c.code === code);
              if (!currency) return;
              edit((p) => {
                p.currency = currency as Currency;
                // Rate overrides were typed in the old currency; keeping them
                // would silently re-price the job, so they are cleared and the
                // designer is told.
                p.rates = {};
              });
              if (overrides) notify("Currency changed — your rate overrides were reset.", "info");
            }}
          />
          <SelectField<string>
            label="Units"
            value={project.units}
            disabled={readOnly}
            options={[
              { value: "metric", label: "Metric (m, m²)" },
              { value: "imperial", label: "Imperial (ft, sq ft)" },
            ]}
            onChange={(v) =>
              edit((p) => {
                p.units = v === "imperial" ? "imperial" : "metric";
              })
            }
          />
        </div>
        {overrides ? (
          <Note>
            {overrides} rate{overrides === 1 ? "" : "s"} overridden on this project.
          </Note>
        ) : null}
      </Section>

      <Section title="Style and finishes">
        <SelectField<string>
          label="Design style"
          value={project.styleId}
          disabled={readOnly}
          options={STYLE_LIST.map((s) => ({
            value: s.id,
            label:
              s.priceMultiplier === 1
                ? s.name
                : `${s.name} (${s.priceMultiplier > 1 ? "+" : ""}${Math.round((s.priceMultiplier - 1) * 100)}%)`,
          }))}
          onChange={(v) =>
            edit((p) => {
              p.styleId = v;
            })
          }
        />
        <Note>
          The style sets the finish schedule in 3D and scales the catalog rates — a luxe scheme costs
          more than a modern one for identical joinery.
        </Note>
      </Section>

      <Section title="Extras">
        <Toggle
          label={`Include the 3D-printed scale model (${formatMoney(modelCost, project.currency)})`}
          hint={`At 1:${project.print.scale}, about ${Math.round(printStats(project).grams)} g of material`}
          checked={project.quote.includeScaleModel}
          disabled={readOnly}
          onChange={(v) => setQuote({ includeScaleModel: v })}
        />
      </Section>

      <Section title="Terms printed under the quote">
        <TextArea
          label="Terms"
          value={project.quote.terms}
          rows={8}
          disabled={readOnly}
          onCommit={(v) => setQuote({ terms: v })}
        />
      </Section>
    </div>
  );
}
