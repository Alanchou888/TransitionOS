"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type UserOption = { id: string; name: string; role: string };
type SourceOption = { id: string; type: string; enabled: boolean };
type SourceFilters = {
  branch?: string;
  author?: string;
  labels?: string[];
  keywords?: string[];
};
type TaskInput = {
  id: string;
  type: "HANDOVER" | "ONBOARDING" | "BOTH";
  ownerUserId: string;
  targetRole: string;
  successorUserId: string | null;
  dateFrom: string;
  dateTo: string;
  sourceSelection: unknown;
};

function parseList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function parseSourceSelection(input: unknown): {
  connectionIds: string[];
  filters: SourceFilters;
} {
  if (Array.isArray(input)) {
    return {
      connectionIds: input.filter((entry): entry is string => typeof entry === "string"),
      filters: {}
    };
  }
  if (!input || typeof input !== "object") {
    return { connectionIds: [], filters: {} };
  }
  const connectionIdsRaw = (input as { connectionIds?: unknown }).connectionIds;
  const filtersRaw = (input as { filters?: unknown }).filters;
  const connectionIds = Array.isArray(connectionIdsRaw)
    ? connectionIdsRaw.filter((entry): entry is string => typeof entry === "string")
    : [];
  const filtersObject = filtersRaw && typeof filtersRaw === "object" ? (filtersRaw as Record<string, unknown>) : {};
  const labels = Array.isArray(filtersObject.labels)
    ? filtersObject.labels.filter((entry): entry is string => typeof entry === "string")
    : [];
  const keywords = Array.isArray(filtersObject.keywords)
    ? filtersObject.keywords.filter((entry): entry is string => typeof entry === "string")
    : [];
  return {
    connectionIds,
    filters: {
      ...(typeof filtersObject.branch === "string" && filtersObject.branch.trim()
        ? { branch: filtersObject.branch.trim() }
        : {}),
      ...(typeof filtersObject.author === "string" && filtersObject.author.trim()
        ? { author: filtersObject.author.trim() }
        : {}),
      ...(labels.length > 0 ? { labels } : {}),
      ...(keywords.length > 0 ? { keywords } : {})
    }
  };
}

function toCsv(values: string[] | undefined): string {
  if (!values || values.length === 0) {
    return "";
  }
  return values.join(", ");
}

export function TaskManageForm({
  task,
  users,
  sources,
  canDelete
}: {
  task: TaskInput;
  users: UserOption[];
  sources: SourceOption[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<TaskInput["type"]>(task.type);
  const [ownerUserId, setOwnerUserId] = useState(task.ownerUserId);
  const [targetRole, setTargetRole] = useState(task.targetRole);
  const [successorUserId, setSuccessorUserId] = useState(task.successorUserId ?? "");
  const [dateFrom, setDateFrom] = useState(task.dateFrom.slice(0, 10));
  const [dateTo, setDateTo] = useState(task.dateTo.slice(0, 10));
  const initialSelection = useMemo(() => parseSourceSelection(task.sourceSelection), [task.sourceSelection]);
  const [sourceIds, setSourceIds] = useState<string[]>(() => initialSelection.connectionIds);
  const [branchFilter, setBranchFilter] = useState(initialSelection.filters.branch ?? "");
  const [authorFilter, setAuthorFilter] = useState(initialSelection.filters.author ?? "");
  const [labelsFilter, setLabelsFilter] = useState(toCsv(initialSelection.filters.labels));
  const [keywordsFilter, setKeywordsFilter] = useState(toCsv(initialSelection.filters.keywords));

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

  async function onSave() {
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

      const res = await fetch(`/api/transition-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          ownerUserId,
          targetRole,
          successorUserId: successorUserId || null,
          dateFrom: new Date(dateFrom).toISOString(),
          dateTo: new Date(dateTo).toISOString(),
          sourceConnectionIds: sourceIds,
          sourceFilters
        })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Update task failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update task failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onDelete() {
    const confirmed = window.confirm("Delete this task? All generated drafts and packs will be removed.");
    if (!confirmed) {
      return;
    }
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/transition-tasks/${task.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Delete task failed");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete task failed");
      setIsDeleting(false);
    }
  }

  return (
    <div className="card space-y-5">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Task Type</label>
        <select className="input" value={type} onChange={(event) => setType(event.target.value as TaskInput["type"])}>
          <option value="HANDOVER">HANDOVER</option>
          <option value="ONBOARDING">ONBOARDING</option>
          <option value="BOTH">BOTH</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Owner</label>
        <select className="input" value={ownerUserId} onChange={(event) => setOwnerUserId(event.target.value)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Successor (optional)</label>
        <select className="input" value={successorUserId} onChange={(event) => setSuccessorUserId(event.target.value)}>
          <option value="">(none)</option>
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

      <div className="flex gap-2">
        <button className="btn" disabled={isSubmitting || isDeleting} onClick={onSave}>
          {isSubmitting ? "Saving..." : "Save Task"}
        </button>
        {canDelete ? (
          <button className="btn-secondary" disabled={isSubmitting || isDeleting} onClick={onDelete}>
            {isDeleting ? "Deleting..." : "Delete Task"}
          </button>
        ) : null}
      </div>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
