"use client";

import { cn } from "@/lib/cn";
import { useEffect, useId, useState } from "react";

/* ------------------------------------------------------------------ *
 * Form fields
 * ------------------------------------------------------------------ */

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("field", className)}>
      <span>{label}</span>
      {children}
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

/**
 * A number input that commits on blur and on Enter rather than on every
 * keystroke.
 *
 * Committing per keystroke means typing "1800" over "900" momentarily applies
 * 1, then 18, then 180 — each of which re-runs validation and the auto-layout
 * scorer, and each of which lands in the undo history. This holds a local
 * draft and only tells the store when the designer is finished.
 */
export function NumberField({
  label,
  value,
  onCommit,
  step = 50,
  min,
  max,
  suffix,
  hint,
  disabled,
  className,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // follow the store while the field is not being typed into
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    let next = parsed;
    if (min !== undefined) next = Math.max(min, next);
    if (max !== undefined) next = Math.min(max, next);
    if (next !== value) onCommit(next);
    else setDraft(String(value));
  };

  return (
    <Field label={label} hint={hint} className={className}>
      <div className="relative">
        <input
          type="number"
          className={cn("input input-num", suffix && "pr-9")}
          value={draft}
          step={step}
          min={min}
          max={max}
          disabled={disabled}
          inputMode="numeric"
          onFocus={() => setEditing(true)}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              setDraft(String(value));
              setEditing(false);
              e.currentTarget.blur();
            }
          }}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted">
            {suffix}
          </span>
        ) : null}
      </div>
    </Field>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  placeholder,
  hint,
  maxLength,
  disabled,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  return (
    <Field label={label} hint={hint}>
      <input
        className="input"
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onCommit,
  rows = 5,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  rows?: number;
  hint?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  return (
    <Field label={label} hint={hint}>
      <textarea
        className="input resize-y"
        rows={rows}
        value={draft}
        disabled={disabled}
        onFocus={() => setEditing(true)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onCommit(draft);
        }}
      />
    </Field>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; group?: string }>;
  onChange: (value: T) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const groups = options.reduce<Record<string, typeof options>>((acc, option) => {
    const key = option.group ?? "";
    (acc[key] ??= []).push(option);
    return acc;
  }, {});
  const grouped = Object.keys(groups).some((k) => k !== "");

  return (
    <Field label={label} hint={hint}>
      <select
        className="input"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {grouped
          ? Object.entries(groups).map(([group, items]) => (
              <optgroup key={group} label={group || "Other"}>
                {items.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))
          : options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
      </select>
    </Field>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        className="mt-[3px] accent-[var(--accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="text-[13px] leading-snug">
        {label}
        {hint ? <span className="block text-[11.5px] text-muted">{hint}</span> : null}
      </label>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex flex-wrap gap-0.5 rounded-lg bg-line2 p-[3px]", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-[12.5px] transition-colors",
            value === o.value ? "bg-paper text-ink shadow-sm" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

export function Section({
  title,
  aside,
  children,
  className,
}: {
  title?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2.5", className)}>
      {title || aside ? (
        <header className="flex items-baseline justify-between gap-2">
          {title ? <h3 className="label-caps">{title}</h3> : <span />}
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Stats({ cells }: { cells: Array<[string, string]> }) {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
      {cells.map(([value, label]) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5 bg-paper px-2.5 py-2">
          <b className="tnum truncate text-[15px] font-medium">{value}</b>
          <span className="truncate text-[11px] text-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function Pill({
  tone = "on",
  children,
}: {
  tone?: "ok" | "warn" | "bad" | "on";
  children: React.ReactNode;
}) {
  return <span className={cn("pill", `pill-${tone}`)}>{children}</span>;
}

export function Rows({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex list-none flex-col overflow-hidden rounded-lg border border-line bg-paper">
      {children}
    </ul>
  );
}

export function Row({
  onClick,
  left,
  right,
  active,
}: {
  onClick?: () => void;
  left: React.ReactNode;
  right?: React.ReactNode;
  active?: boolean;
}) {
  return (
    <li className="border-t border-line2 first:border-t-0">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[13px] transition-colors",
          active ? "bg-accent-soft" : "hover:bg-bg",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">{left}</span>
        {right ? <span className="flex shrink-0 items-center gap-1.5">{right}</span> : null}
      </button>
    </li>
  );
}

/** A destructive action that asks once, inline, rather than in a modal. */
export function ConfirmInline({
  question,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-bad bg-bad-soft p-2.5 text-[13px]">
      <p className="m-0">{question}</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-sm btn-primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-sm" onClick={onCancel}>
          Keep it
        </button>
      </div>
    </div>
  );
}

export function Note({ children, tone }: { children: React.ReactNode; tone?: "bad" | "warn" }) {
  return (
    <p
      className={cn(
        "m-0 text-[12px] leading-relaxed",
        tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-muted",
      )}
    >
      {children}
    </p>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-muted">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

export function Toast({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "good" | "bad";
}) {
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-none fixed bottom-6 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-lg px-3.5 py-2.5 text-[13px] shadow-pop",
        tone === "bad"
          ? "bg-bad text-white"
          : tone === "good"
            ? "bg-good text-white"
            : "bg-ink text-paper",
      )}
    >
      {message}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
      aria-hidden
    />
  );
}
