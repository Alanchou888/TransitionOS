import type { SourceItem } from "@prisma/client";

const LAMBDA = 0.035;

const SECTION_HINTS: Record<string, string[]> = {
  role_overview: ["owner", "role", "module", "scope"],
  main_responsibilities: ["responsibility", "operate", "maintain", "service"],
  recent_completed_work: ["done", "completed", "merged", "released", "deploy"],
  work_in_progress: ["wip", "in progress", "draft", "pending", "todo"],
  current_blockers_and_risks: ["blocker", "risk", "incident", "outage", "bug"],
  important_sop_workflows: ["sop", "runbook", "workflow", "process"],
  pending_tasks: ["follow-up", "pending", "next", "todo", "open"],
  key_stakeholders: ["owner", "reviewer", "mentor", "manager", "team"],
  important_source_references: ["link", "reference", "decision", "doc", "discussion"],
  notes_and_caveats: ["caveat", "warning", "limitation", "tradeoff"],
  role_introduction: ["role", "mission", "objective"],
  team_context_and_mission: ["team", "context", "mission", "goal"],
  first_week_must_know: ["first week", "onboarding", "must know", "quick start"],
  key_systems_and_tools: ["tool", "system", "stack", "platform"],
  essential_sop_runbook: ["sop", "runbook", "incident", "playbook"],
  common_issues_and_faq: ["faq", "common", "issue", "troubleshoot"],
  who_to_ask_for_what: ["owner", "contact", "ask", "responsible"],
  "30_60_90_day_learning_checklist": ["30", "60", "90", "milestone", "learning"],
  required_reading_items: ["read", "document", "guide", "spec"],
  learning_completion_tracker: ["checklist", "progress", "complete", "status"]
};

function keywordScore(text: string, sectionKey: string): number {
  const hints = SECTION_HINTS[sectionKey] ?? [];
  const normalized = text.toLowerCase();
  let score = 0;
  for (const hint of hints) {
    if (normalized.includes(hint)) {
      score += 1;
    }
  }
  return score;
}

function decayScore(createdAtSource: Date | null, targetDate: Date): number {
  if (!createdAtSource) {
    return 0.6;
  }
  const deltaMs = Math.max(targetDate.getTime() - createdAtSource.getTime(), 0);
  const deltaDays = deltaMs / (1000 * 60 * 60 * 24);
  return Math.exp(-LAMBDA * deltaDays);
}

export function pickRelevantSources(
  sourceItems: SourceItem[],
  sectionKey: string,
  targetDate: Date,
  limit = 3
): SourceItem[] {
  const scored = sourceItems
    .map((item) => {
      const semantic = keywordScore(`${item.title}\n${item.rawContent}`, sectionKey);
      const timeWeight = decayScore(item.createdAtSource, targetDate);
      const score = (1 + semantic) * timeWeight;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.item);
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 2);
}

export function pickRelevantByQuery(
  sourceItems: SourceItem[],
  query: string,
  targetDate: Date,
  limit = 5
): SourceItem[] {
  const queryTokens = tokenize(query);
  const scored = sourceItems
    .map((item) => {
      const haystack = `${item.title}\n${item.rawContent}`.toLowerCase();
      let overlap = 0;
      for (const token of queryTokens) {
        if (haystack.includes(token)) {
          overlap += 1;
        }
      }
      const timeWeight = decayScore(item.createdAtSource, targetDate);
      const score = (1 + overlap) * timeWeight;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((entry) => entry.item);
}
