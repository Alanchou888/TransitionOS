"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunTaskButton({ taskId }: { taskId: string }) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function run() {
    setIsRunning(true);
    setError("");
    try {
      const res = await fetch(`/api/transition-tasks/${taskId}/run`, { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Run failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="space-y-2">
      <button className="btn min-w-40" onClick={run} disabled={isRunning}>
        {isRunning ? "Running..." : "Generate / Refresh"}
      </button>
      <p className="text-xs text-slate-500">This triggers ingestion + generation with current source filters.</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
