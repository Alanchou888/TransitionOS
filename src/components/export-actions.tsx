"use client";

import { useState } from "react";

async function download(url: string, payload: Record<string, unknown>, fallbackName: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Export failed");
  }
  const blob = await res.blob();
  const href = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const disposition = res.headers.get("Content-Disposition");
  const nameMatch = disposition?.match(/filename="(.+)"/);
  anchor.href = href;
  anchor.download = nameMatch?.[1] ?? fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(href);
}

export function ExportActions({ taskId }: { taskId: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(api: string, document: "handover" | "onboarding", name: string) {
    setBusy(true);
    setError("");
    try {
      await download(api, { transitionTaskId: taskId, document }, name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3">
      <p className="text-sm text-slate-700">Export handover and onboarding artifacts.</p>
      <div className="grid gap-2 md:grid-cols-2">
        <button
          className="btn"
          disabled={busy}
          onClick={() => run("/api/exports/markdown", "handover", "handover.md")}
        >
          Handover Markdown
        </button>
        <button
          className="btn"
          disabled={busy}
          onClick={() => run("/api/exports/pdf", "handover", "handover.html")}
        >
          Handover PDF(HTML)
        </button>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => run("/api/exports/markdown", "onboarding", "onboarding.md")}
        >
          Onboarding Markdown
        </button>
        <button
          className="btn-secondary"
          disabled={busy}
          onClick={() => run("/api/exports/pdf", "onboarding", "onboarding.html")}
        >
          Onboarding PDF(HTML)
        </button>
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
