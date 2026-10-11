"use client";

import { Check, Copy, Link2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Note, Pill, Section, SegmentedControl, Toggle } from "@/components/ui";
import { useEditor } from "@/lib/editor-store";

type Scope = "PRESENTATION" | "QUOTE" | "FULL";

interface LinkRecord {
  id: string;
  token: string;
  scope: Scope;
  versionId: string | null;
  expiresAt: string | null;
  viewCount: number;
  allowComments: boolean;
  createdAt: string;
  hasPassword: boolean;
}

const SCOPE_NOTE: Record<Scope, string> = {
  PRESENTATION: "3D walkthrough and the plan. No prices at all — safe to send before you have agreed a number.",
  QUOTE: "The priced quotation only.",
  FULL: "The walkthrough and the quotation together.",
};

/**
 * Share links.
 *
 * The two choices that matter are in front of the designer rather than buried:
 * what the client can see, and whether the link is frozen at today's version.
 * Freezing is the default for a priced link, because a quote that changes after
 * it has been sent is how studios lose arguments.
 */
export function ShareDialog({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const notify = useEditor((s) => s.notify);
  const [links, setLinks] = useState<LinkRecord[] | null>(null);
  const [scope, setScope] = useState<Scope>("FULL");
  const [pin, setPin] = useState(true);
  const [allowComments, setAllowComments] = useState(true);
  const [password, setPassword] = useState("");
  const [expiryDays, setExpiryDays] = useState("30");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/share`);
    if (!response.ok) {
      setLinks([]);
      return;
    }
    const body = (await response.json()) as { links: LinkRecord[] };
    setLinks(body.links);
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const create = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/share`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          pinToCurrentVersion: pin,
          allowComments,
          password: password || undefined,
          expiresInDays: expiryDays === "never" ? undefined : Number(expiryDays),
        }),
      });
      const body = (await response.json()) as { error?: string; url?: string };
      if (!response.ok) {
        notify(body.error ?? "The link could not be created.", "bad");
        return;
      }
      if (body.url) {
        await copy(body.url);
        notify("Link created and copied to your clipboard.", "good");
      }
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    const response = await fetch(`/api/projects/${projectId}/share?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      notify("The link could not be revoked.", "bad");
      return;
    }
    notify("Link revoked. It will no longer open.");
    await load();
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      notify("Copying is blocked here — select the link and copy it manually.", "bad");
    }
  };

  const urlFor = (token: string) =>
    `${typeof window === "undefined" ? "" : window.location.origin}/share/${token}`;

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Share with the client"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="my-auto flex w-full max-w-[560px] flex-col gap-5 rounded-xl border border-line bg-panel p-5 shadow-pop">
        <header className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 font-display text-[18px] font-bold tracking-tight">
              Share with the client
            </h2>
            <p className="m-0 text-[12.5px] text-muted">
              Anyone with the link can open it. No account needed.
            </p>
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <Section title="What can they see?">
          <SegmentedControl
            value={scope}
            options={[
              { value: "PRESENTATION", label: "Design only" },
              { value: "QUOTE", label: "Quote only" },
              { value: "FULL", label: "Both" },
            ]}
            onChange={(v) => setScope(v as Scope)}
          />
          <Note>{SCOPE_NOTE[scope]}</Note>
        </Section>

        <Section title="Options">
          <Toggle
            label="Freeze the link at today's version"
            hint="Keep editing without changing what this client is looking at"
            checked={pin}
            onChange={setPin}
          />
          <Toggle
            label="Let them leave comments"
            hint="Comments appear in your project, tagged with their name"
            checked={allowComments}
            onChange={setAllowComments}
          />
          <div className="grid grid-cols-2 gap-2">
            <label className="field">
              <span>Password (optional)</span>
              <input
                className="input"
                type="text"
                value={password}
                placeholder="Leave blank for none"
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="field">
              <span>Expires</span>
              <select
                className="input"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
              >
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
                <option value="never">Never</option>
              </select>
            </label>
          </div>
        </Section>

        <button type="button" className="btn btn-primary" disabled={busy} onClick={create}>
          <Link2 size={14} /> {busy ? "Creating…" : "Create the link"}
        </button>

        <Section title="Existing links">
          {links === null ? (
            <Note>Loading…</Note>
          ) : links.length === 0 ? (
            <Note>No live links for this project yet.</Note>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {links.map((link) => {
                const url = urlFor(link.token);
                return (
                  <li
                    key={link.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-paper px-2.5 py-2"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <code className="truncate font-mono text-[11.5px] text-muted">{url}</code>
                      <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                        <Pill tone={link.scope === "PRESENTATION" ? "on" : "ok"}>
                          {link.scope === "PRESENTATION"
                            ? "Design only"
                            : link.scope === "QUOTE"
                              ? "Quote only"
                              : "Design + quote"}
                        </Pill>
                        {link.versionId ? <span>frozen</span> : <span>live</span>}
                        {link.hasPassword ? <span>· password</span> : null}
                        <span>
                          · {link.viewCount} view{link.viewCount === 1 ? "" : "s"}
                        </span>
                        {link.expiresAt ? (
                          <span>
                            · expires {new Date(link.expiresAt).toLocaleDateString()}
                          </span>
                        ) : null}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void copy(url)}
                      aria-label="Copy link"
                    >
                      {copied === url ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => void revoke(link.id)}
                      aria-label="Revoke link"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
