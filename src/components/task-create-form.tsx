"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserOption = { id: string; name: string; role: string };
type SourceOption = { id: string; type: string; enabled: boolean };

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function TaskCreateForm({
  users,
  sources
}: {
  users: UserOption[];
  sources: SourceOption[];
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<"HANDOVER" | "ONBOARDING" | "BOTH">("BOTH");
  const [ownerUserId, setOwnerUserId] = useState(users[0]?.id ?? "");
  const [targetRole, setTargetRole] = useState("Backend Engineer");
  const [sourceIds, setSourceIds] = useState<string[]>(sources.filter((s) => s.enabled).map((s) => s.id));
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [branchFilter, setBranchFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [labelsFilter, setLabelsFilter] = useState("");
  const [keywordsFilter, setKeywordsFilter] = useState("");
  const sourceSet = useMemo(() => new Set(sourceIds), [sourceIds]);
  const enabledSourceIds = useMemo(
    () => sources.filter((source) => source.enabled).map((source) => source.id),
    [sources]
  );
  const nonSeedSourceIds = useMemo(
    () => sources.filter((source) => !source.id.startsWith("seed-")).map((source) => source.id),
    [sources]
  );

  function toggleSource(sourceId: string) {
    setSourceIds((current) =>
      current.includes(sourceId) ? current.filter((id) => id !== sourceId) : [...current, sourceId]
    );
  }
  function selectAllSources() {
    setSourceIds(sources.map((source) => source.id));
  }
  function clearAllSources() {
    setSourceIds([]);
  }
  function selectEnabledSources() {
    setSourceIds(enabledSourceIds);
  }
  function selectNonSeedSources() {
    setSourceIds(nonSeedSourceIds);
  }

  async function onSubmit() {
    setIsSubmitting(true);
    setError("");
    try {
      const labels = parseList(labelsFilter);
      const keywords = parseList(keywordsFilter);
      const sourceFilters = {
        ...(branchFilter.trim() ? { branch: branchFilter.trim() } : {}),
        ...(authorFilter.trim() ? { author: authorFilter.trim() } : {}),
        ...(labels.length > 0 ? { labels } : {}),
        ...(keywords.length > 0 ? { keywords } : {})
      };

      const res = await fetch("/api/transition-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ownerUserId,
          targetRole,
          dateFrom: new Date(dateFrom).toISOString(),
          dateTo: new Date(dateTo).toISOString(),
          sourceConnectionIds: sourceIds,
          sourceFilters
        })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof data.error === "string" ? data.error : "Create task failed");
      }
      const task = (await res.json()) as { id: string };
      router.push(`/tasks/${task.id}/draft`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create task failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="card space-y-5">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Task Type</label>
        <select className="input" value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="HANDOVER">HANDOVER</option>
          <option value="ONBOARDING">ONBOARDING</option>
          <option value="BOTH">BOTH</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Owner</label>
        <select
          className="input"
          value={ownerUserId}
          onChange={(event) => setOwnerUserId(event.target.value)}
        >
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Target Role</label>
        <input className="input" value={targetRole} onChange={(event) => setTargetRole(event.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">From</label>
          <input className="input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">To</label>
          <input className="input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Source Connections</label>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">
            Selected {sourceIds.length} / {sources.length}
          </span>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={selectAllSources}>
            Select All
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={clearAllSources}>
            Clear All
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={selectEnabledSources}>
            Enabled Only
          </button>
          <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={selectNonSeedSources}>
            Non-seed Only
          </button>
        </div>
        <div className="max-h-56 space-y-2 overflow-auto rounded-xl border border-slate-200 bg-white p-3">
          {sources.map((source) => (
            <label key={source.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={sourceSet.has(source.id)}
                onChange={() => toggleSource(source.id)}
              />
              {source.type} ({source.id}) {source.enabled ? "" : "[disabled]"}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Branch Filter (optional)</label>
          <input
            className="input"
            placeholder="main"
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Author Filter (optional)</label>
          <input
            className="input"
            placeholder="alan"
            value={authorFilter}
            onChange={(event) => setAuthorFilter(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Label Filters (optional)</label>
          <input
            className="input"
            placeholder="bug,handover"
            value={labelsFilter}
            onChange={(event) => setLabelsFilter(event.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">Keyword Filters (optional)</label>
          <input
            className="input"
            placeholder="retry,incident,sop"
            value={keywordsFilter}
            onChange={(event) => setKeywordsFilter(event.target.value)}
          />
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Filters are applied on ingested items. Leave blank to use all selected source content.
      </p>
      <button className="btn" disabled={isSubmitting} onClick={onSubmit}>
        {isSubmitting ? "Creating..." : "Create Transition Task"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
