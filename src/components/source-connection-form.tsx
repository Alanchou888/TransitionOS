"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SourceConnectionForm() {
  const router = useRouter();
  const [type, setType] = useState("GITHUB_REPO");
  const [configJson, setConfigJson] = useState('{"owner":"","repo":"","token":""}');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const parsed = JSON.parse(configJson) as Record<string, unknown>;
      const res = await fetch("/api/admin/source-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, configJson: parsed, enabled })
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Create source failed");
      }
      setConfigJson('{"owner":"demo-org","repo":"transitionos","token":""}');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create source failed");
    } finally {
      setBusy(false);
    }
  }

  function applyTypePreset(nextType: string) {
    setType(nextType);
    if (nextType === "NOTION_PAGE") {
      setConfigJson('{"databaseId":"","token":""}');
      return;
    }
    if (nextType === "SLACK_MESSAGE") {
      setConfigJson('{"token":"","workspaceDomain":"","channels":["C0123456789"]}');
      return;
    }
    if (nextType === "JIRA_ISSUE") {
      setConfigJson('{"baseUrl":"https://example.atlassian.net","email":"","apiToken":"","jql":"ORDER BY updated DESC"}');
      return;
    }
    if (nextType === "GITHUB_ISSUE" || nextType === "GITHUB_REPO") {
      setConfigJson('{"owner":"","repo":"","token":""}');
    }
  }

  return (
    <div className="card space-y-4">
      <h2 className="card-title">Create Source Connection</h2>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Type</label>
        <select className="input" value={type} onChange={(event) => applyTypePreset(event.target.value)}>
          <option value="GITHUB_REPO">GITHUB_REPO</option>
          <option value="GITHUB_ISSUE">GITHUB_ISSUE</option>
          <option value="NOTION_PAGE">NOTION_PAGE</option>
          <option value="SLACK_MESSAGE">SLACK_MESSAGE</option>
          <option value="JIRA_ISSUE">JIRA_ISSUE</option>
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Config JSON</label>
        <textarea
          className="input min-h-28 font-mono text-xs"
          value={configJson}
          onChange={(event) => setConfigJson(event.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          GitHub repo must be repo name only (e.g. <code>meet-flow</code>), not full URL.
          Slack only supports channel IDs (e.g. <code>C0123456789</code>), not DMs.
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        Enabled
      </label>
      <button className="btn w-full md:w-auto" onClick={submit} disabled={busy}>
        {busy ? "Creating..." : "Create Source Connection"}
      </button>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
