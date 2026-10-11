"use client";

import { FilePlus2, Sparkles, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Spinner } from "@/components/ui";

/**
 * The three ways a project starts: from the sample, from nothing, or from a
 * JSON file someone exported. Import matters more than it looks — it is how a
 * studio moves a project between accounts and how support recovers one.
 */
export function NewProjectButtons({
  disabled,
  quotaMessage,
}: {
  disabled?: boolean;
  quotaMessage?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = async (body: Record<string, unknown>, label: string) => {
    setBusy(label);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setError(data.error ?? "The project could not be created.");
        return;
      }
      router.push(`/projects/${data.id}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || busy !== null}
          onClick={() => void create({ from: "sample" }, "sample")}
        >
          {busy === "sample" ? <Spinner /> : <Sparkles size={14} />} Sample 2BHK
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled || busy !== null}
          onClick={() => void create({ from: "blank" }, "blank")}
        >
          {busy === "blank" ? <Spinner /> : <FilePlus2 size={14} />} Blank project
        </button>
        <button
          type="button"
          className="btn"
          disabled={disabled || busy !== null}
          onClick={() => fileRef.current?.click()}
          title="Import a .layoutcraft.json file"
        >
          {busy === "import" ? <Spinner /> : <Upload size={14} />} Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            try {
              const text = await file.text();
              const design = JSON.parse(text) as unknown;
              await create({ from: "import", design }, "import");
            } catch {
              setError("That file is not a Layoutcraft project.");
            }
          }}
        />
      </div>
      {error ? <p className="m-0 text-[12px] text-bad">{error}</p> : null}
      {quotaMessage && !error ? (
        <p className="m-0 text-[12px] text-muted">{quotaMessage}</p>
      ) : null}
    </div>
  );
}
