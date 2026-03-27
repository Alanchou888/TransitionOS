"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SectionOption = {
  key: string;
  title: string;
  needsHumanFill?: boolean;
};

export function SectionRegeneratePanel({
  endpoint,
  sections,
  canRegenerate
}: {
  endpoint: string;
  sections: SectionOption[];
  canRegenerate: boolean;
}) {
  const router = useRouter();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function run(sectionKey: string) {
    setBusyKey(sectionKey);
    setError("");
    setNotice("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionKey })
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        generationMode?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Section regeneration failed");
      }
      setNotice(
        `Section regenerated (${sectionKey}) using ${data.generationMode ?? "retrieval"} mode.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Section regeneration failed");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => (
        <div
          key={section.key}
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-2"
        >
          <div>
            <p className="text-sm font-medium text-slate-900">{section.title}</p>
            <p className="text-xs text-slate-500">
              key: {section.key}
              {section.needsHumanFill ? " | needs_human_fill" : ""}
            </p>
          </div>
          {canRegenerate ? (
            <button className="btn-secondary" disabled={busyKey !== null} onClick={() => run(section.key)}>
              {busyKey === section.key ? "Regenerating..." : "Regenerate Section"}
            </button>
          ) : (
            <p className="text-xs text-slate-500">Read only</p>
          )}
        </div>
      ))}
      {notice ? <p className="text-xs text-emerald-700">{notice}</p> : null}
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
    </div>
  );
}
