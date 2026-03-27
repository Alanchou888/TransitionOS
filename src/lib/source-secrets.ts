import { SourceType } from "@prisma/client";

export const SECRET_MASK = "__HIDDEN_SECRET__";

const SECRET_KEYS_BY_TYPE: Record<SourceType, string[]> = {
  GITHUB_REPO: ["token"],
  GITHUB_ISSUE: ["token"],
  NOTION_PAGE: ["token"],
  SLACK_MESSAGE: ["token"],
  JIRA_ISSUE: ["apiToken"]
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function secretKeys(type: SourceType): string[] {
  return SECRET_KEYS_BY_TYPE[type] ?? [];
}

export function maskSourceConfig(type: SourceType, config: unknown): Record<string, unknown> {
  const input = asObject(config);
  const output: Record<string, unknown> = { ...input };
  for (const key of secretKeys(type)) {
    const value = output[key];
    if (typeof value === "string" && value.trim() !== "") {
      output[key] = SECRET_MASK;
    }
  }
  return output;
}

export function mergeSecretConfigWithExisting(args: {
  type: SourceType;
  incoming: Record<string, unknown>;
  existing: unknown;
}): Record<string, unknown> {
  const next: Record<string, unknown> = { ...args.incoming };
  const prev = asObject(args.existing);

  for (const key of secretKeys(args.type)) {
    const candidate = next[key];
    const shouldKeepExisting =
      candidate === undefined ||
      (typeof candidate === "string" && (candidate.trim() === "" || candidate === SECRET_MASK));

    if (!shouldKeepExisting) {
      continue;
    }

    const prevValue = prev[key];
    if (typeof prevValue === "string" && prevValue.trim() !== "") {
      next[key] = prevValue;
    }
  }

  return next;
}
