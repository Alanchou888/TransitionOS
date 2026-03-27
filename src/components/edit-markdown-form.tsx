"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function EditMarkdownForm({
  patchUrl,
  initialValue,
  buttonLabel = "Save New Version"
}: {
  patchUrl: string;
  initialValue: string;
  buttonLabel?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  async function onSave() {
    setIsSaving(true);
    setError("");
    try {
      const res = await fetch(patchUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentMarkdown: value })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Save failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        className="input min-h-80 font-mono text-xs"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="flex items-center gap-3">
        <button className="btn" onClick={onSave} disabled={isSaving}>
          {isSaving ? "Saving..." : buttonLabel}
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}

