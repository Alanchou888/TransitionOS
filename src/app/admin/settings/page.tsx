import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { SourceConnectionForm } from "@/components/source-connection-form";
import type { Prisma } from "@prisma/client";
import { SourceConnectionsManager } from "@/components/source-connections-manager";
import { requirePageRoles } from "@/lib/page-auth";
import { maskSourceConfig } from "@/lib/source-secrets";

type JsonObject = Record<string, Prisma.JsonValue>;

function asObject(value: Prisma.JsonValue): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonObject;
  }
  return {};
}

function asString(value: Prisma.JsonValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: Prisma.JsonValue | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function hasSecret(value: string): boolean {
  return value.trim().length > 0;
}

function renderSourceSummary(source: {
  type: string;
  configJson: Prisma.JsonValue;
}) {
  const cfg = asObject(source.configJson);

  if (source.type === "GITHUB_REPO" || source.type === "GITHUB_ISSUE") {
    const owner = asString(cfg.owner);
    const repo = asString(cfg.repo);
    const token = asString(cfg.token);
    return `owner=${owner || "-"}, repo=${repo || "-"}, token=${hasSecret(token) ? "configured" : "missing"}`;
  }

  if (source.type === "NOTION_PAGE") {
    const databaseId = asString(cfg.databaseId);
    const token = asString(cfg.token);
    return `databaseId=${databaseId || "-"}, token=${hasSecret(token) ? "configured" : "missing"}`;
  }

  if (source.type === "SLACK_MESSAGE") {
    const workspaceDomain = asString(cfg.workspaceDomain);
    const channels = asStringArray(cfg.channels);
    const token = asString(cfg.token);
    return `workspace=${workspaceDomain || "-"}, channels=${channels.length ? channels.join(",") : "-"}, token=${hasSecret(token) ? "configured" : "missing"}`;
  }

  if (source.type === "JIRA_ISSUE") {
    const baseUrl = asString(cfg.baseUrl);
    const email = asString(cfg.email);
    const jql = asString(cfg.jql);
    const apiToken = asString(cfg.apiToken);
    return `baseUrl=${baseUrl || "-"}, email=${email || "-"}, jql=${jql || "-"}, apiToken=${hasSecret(apiToken) ? "configured" : "missing"}`;
  }

  return "No summary";
}

export default async function AdminSettingsPage() {
  await requirePageRoles([Role.ADMIN]);
  const sources = await prisma.sourceConnection.findMany({
    orderBy: [{ type: "asc" }, { createdAt: "desc" }]
  });
  const aiEnabled = Boolean(process.env.OPENAI_API_KEY?.trim());
  const aiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini";
  const roles = [
    { role: "ADMIN", permissions: "Manage connectors, templates, roles" },
    { role: "EMPLOYEE", permissions: "Create tasks, edit draft" },
    { role: "MANAGER", permissions: "Assign, review, approve/reject" },
    { role: "SUCCESSOR", permissions: "View docs, complete checklist" },
    { role: "MENTOR", permissions: "Annotate onboarding, update checklist notes" }
  ];

  return (
    <div className="space-y-6">
      <div className="card space-y-2">
        <h1 className="page-title">Admin Settings</h1>
        <p className="page-subtitle">Manage source connections, RBAC baseline, and AI mode visibility.</p>
      </div>

      <div className="card space-y-1">
        <h2 className="card-title">AI Mode</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className={`chip ${aiEnabled ? "" : "bg-amber-100 text-amber-800"}`}>
            OpenAI: {aiEnabled ? "enabled" : "disabled"}
          </span>
          <span className="chip">Model: {aiModel}</span>
        </div>
      </div>

      <SourceConnectionForm />

      <div className="card space-y-2">
        <h2 className="card-title">Source Connections</h2>
        <SourceConnectionsManager
          rows={sources.map((source) => ({
            id: source.id,
            type: source.type,
            enabled: source.enabled,
            configJson: maskSourceConfig(source.type, source.configJson),
            summary: renderSourceSummary(source)
          }))}
        />
      </div>

      <div className="card space-y-2">
        <h2 className="card-title">Role Permissions</h2>
        <ul className="space-y-1 text-sm text-slate-700">
          {roles.map((entry) => (
            <li key={entry.role}>
              {entry.role}: {entry.permissions}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
