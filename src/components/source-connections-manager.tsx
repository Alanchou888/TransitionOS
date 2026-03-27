"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SECRET_MASK } from "@/lib/source-secrets";

type SourceConnectionRow = {
  id: string;
  type: string;
  enabled: boolean;
  configJson: unknown;
  summary: string;
};

type EditState = {
  enabled: boolean;
  configText: string;
};

type TestState = {
  status: "idle" | "testing" | "ok" | "error";
  message?: string;
};

export function SourceConnectionsManager({ rows }: { rows: SourceConnectionRow[] }) {
  const router = useRouter();
  const initial = useMemo(() => {
    const byId: Record<string, EditState> = {};
    for (const row of rows) {
      byId[row.id] = {
        enabled: row.enabled,
        configText: JSON.stringify(row.configJson, null, 2)
      };
    }
    return byId;
  }, [rows]);
  const [drafts, setDrafts] = useState<Record<string, EditState>>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [tests, setTests] = useState<Record<string, TestState>>({});

  useEffect(() => {
    setDrafts(initial);
  }, [initial]);

  function patchDraft(id: string, next: Partial<EditState>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...next }
    }));
  }

  async function save(id: string) {
    const state = drafts[id];
    if (!state) {
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const parsed = JSON.parse(state.configText) as Record<string, unknown>;
      const res = await fetch(`/api/admin/source-connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: state.enabled,
          configJson: parsed
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Update source connection failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update source connection failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    const confirmed = window.confirm("Delete this source connection? This action cannot be undone.");
    if (!confirmed) {
      return;
    }
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/source-connections/${id}`, {
        method: "DELETE"
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Delete source connection failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete source connection failed");
    } finally {
      setBusyId(null);
    }
  }

  async function testConnection(id: string) {
    setTests((prev) => ({
      ...prev,
      [id]: { status: "testing" }
    }));
    try {
      const res = await fetch(`/api/admin/source-connections/${id}/test`, {
        method: "POST"
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        itemCount?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Connection test failed");
      }
      setTests((prev) => ({
        ...prev,
        [id]: { status: "ok", message: `Success, fetched ${data.itemCount ?? 0} items.` }
      }));
    } catch (err) {
      setTests((prev) => ({
        ...prev,
        [id]: { status: "error", message: err instanceof Error ? err.message : "Connection test failed" }
      }));
    }
  }

  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const state = drafts[row.id] ?? {
          enabled: row.enabled,
          configText: JSON.stringify(row.configJson, null, 2)
        };
        const testState = tests[row.id] ?? { status: "idle" as const };
        return (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="font-semibold text-slate-900">
              {row.type} [{state.enabled ? "enabled" : "disabled"}] - {row.id}
            </p>
            <p className="mb-2 text-xs text-slate-600">{row.summary}</p>
            <label className="mb-2 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={state.enabled}
                onChange={(event) => patchDraft(row.id, { enabled: event.target.checked })}
              />
              Enabled
            </label>
            <textarea
              className="input min-h-28 font-mono text-xs"
              value={state.configText}
              onChange={(event) => patchDraft(row.id, { configText: event.target.value })}
            />
            <p className="mt-1 text-xs text-slate-500">
              Secret fields are hidden as <code>{SECRET_MASK}</code>. Keep this value to preserve current secret, or
              replace with a new token to rotate.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn" disabled={busyId === row.id} onClick={() => save(row.id)}>
                {busyId === row.id ? "Saving..." : "Save"}
              </button>
              <button
                className="btn-secondary"
                disabled={busyId === row.id || testState.status === "testing"}
                onClick={() => testConnection(row.id)}
              >
                {testState.status === "testing" ? "Testing..." : "Test"}
              </button>
              <button className="btn-secondary" disabled={busyId === row.id} onClick={() => remove(row.id)}>
                Delete
              </button>
            </div>
            {testState.status === "ok" && testState.message ? (
              <p className="mt-2 text-xs text-emerald-700">{testState.message}</p>
            ) : null}
            {testState.status === "error" && testState.message ? (
              <p className="mt-2 text-xs text-rose-700">{testState.message}</p>
            ) : null}
          </div>
        );
      })}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
