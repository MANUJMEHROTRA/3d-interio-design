"use client";

import { Check } from "lucide-react";
import { useActionState } from "react";
import { Note, Section, Spinner } from "@/components/ui";
import { saveStudioAction, type ActionResult } from "./actions";

export interface StudioInitial {
  name: string;
  studioName: string;
  studioAddress: string;
  studioContact: string;
  taxId: string;
  logoUrl: string;
  brandColor: string;
  defaultCurrency: string;
  defaultUnits: string;
  defaultTaxLabel: string;
  defaultTaxRate: number;
  defaultTerms: string;
}

export function StudioForm({
  initial,
  canEdit,
  currencies,
}: {
  initial: StudioInitial;
  canEdit: boolean;
  currencies: Array<{ code: string; symbol: string }>;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(saveStudioAction, {});

  return (
    <form action={action} className="flex flex-col gap-6">
      <Section title="On your quotations">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Studio name as billed</span>
            <input
              className="input"
              name="name"
              defaultValue={initial.name}
              disabled={!canEdit}
              required
            />
          </label>
          <label className="field">
            <span>Trading name shown to clients</span>
            <input
              className="input"
              name="studioName"
              defaultValue={initial.studioName}
              placeholder={initial.name}
              disabled={!canEdit}
            />
          </label>
          <label className="field sm:col-span-2">
            <span>Address</span>
            <textarea
              className="input resize-y"
              name="studioAddress"
              rows={2}
              defaultValue={initial.studioAddress}
              disabled={!canEdit}
            />
          </label>
          <label className="field">
            <span>Phone or email</span>
            <input
              className="input"
              name="studioContact"
              defaultValue={initial.studioContact}
              disabled={!canEdit}
            />
          </label>
          <label className="field">
            <span>GSTIN or tax number</span>
            <input className="input" name="taxId" defaultValue={initial.taxId} disabled={!canEdit} />
          </label>
        </div>
      </Section>

      <Section title="Branding on client pages">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="field">
            <span>Logo URL</span>
            <input
              className="input"
              name="logoUrl"
              type="url"
              placeholder="https://…/logo.png"
              defaultValue={initial.logoUrl}
              disabled={!canEdit}
            />
          </label>
          <label className="field">
            <span>Accent colour</span>
            <input
              className="input"
              name="brandColor"
              placeholder="#a96c18"
              pattern="^#[0-9a-fA-F]{6}$"
              defaultValue={initial.brandColor}
              disabled={!canEdit}
            />
          </label>
        </div>
        <Note>
          Host the logo somewhere public and paste the address. The accent colour must be a six-digit
          hex value; it is used on the quotation header and the client portal.
        </Note>
      </Section>

      <Section title="Defaults for new projects">
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="field">
            <span>Currency</span>
            <select
              className="input"
              name="defaultCurrency"
              defaultValue={initial.defaultCurrency}
              disabled={!canEdit}
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.symbol}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Units</span>
            <select
              className="input"
              name="defaultUnits"
              defaultValue={initial.defaultUnits}
              disabled={!canEdit}
            >
              <option value="metric">Metric</option>
              <option value="imperial">Imperial</option>
            </select>
          </label>
          <label className="field">
            <span>Tax label</span>
            <input
              className="input"
              name="defaultTaxLabel"
              defaultValue={initial.defaultTaxLabel}
              disabled={!canEdit}
            />
          </label>
          <label className="field">
            <span>Tax rate %</span>
            <input
              className="input input-num"
              name="defaultTaxRate"
              type="number"
              step={0.5}
              min={0}
              max={100}
              defaultValue={initial.defaultTaxRate}
              disabled={!canEdit}
            />
          </label>
        </div>
        <label className="field">
          <span>Standard terms</span>
          <textarea
            className="input resize-y"
            name="defaultTerms"
            rows={6}
            placeholder="Payment schedule, what is excluded, how long the quote is valid…"
            defaultValue={initial.defaultTerms}
            disabled={!canEdit}
          />
        </label>
        <Note>
          Changing these does not touch existing projects — only ones you create afterwards.
        </Note>
      </Section>

      {canEdit ? (
        <div className="flex items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? <Spinner /> : null} Save studio details
          </button>
          {state.ok ? (
            <span className="flex items-center gap-1.5 text-[12.5px] text-good">
              <Check size={14} /> Saved
            </span>
          ) : null}
          {state.error ? <span className="text-[12.5px] text-bad">{state.error}</span> : null}
        </div>
      ) : (
        <Note>Only an owner or admin can change these.</Note>
      )}
    </form>
  );
}
