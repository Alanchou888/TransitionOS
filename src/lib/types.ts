import { Role } from "@prisma/client";

export const HANDOVER_SECTION_KEYS = [
  "role_overview",
  "main_responsibilities",
  "recent_completed_work",
  "work_in_progress",
  "current_blockers_and_risks",
  "important_sop_workflows",
  "pending_tasks",
  "key_stakeholders",
  "important_source_references",
  "notes_and_caveats"
] as const;

export const ONBOARDING_SECTION_KEYS = [
  "role_introduction",
  "team_context_and_mission",
  "first_week_must_know",
  "key_systems_and_tools",
  "essential_sop_runbook",
  "common_issues_and_faq",
  "who_to_ask_for_what",
  "30_60_90_day_learning_checklist",
  "required_reading_items",
  "learning_completion_tracker"
] as const;

export type HandoverSectionKey = (typeof HANDOVER_SECTION_KEYS)[number];
export type OnboardingSectionKey = (typeof ONBOARDING_SECTION_KEYS)[number];

export type DocumentSection = {
  key: string;
  title: string;
  content: string;
  needsHumanFill?: boolean;
  sourceItemIds: string[];
};

export type GeneratedDocument = {
  sections: DocumentSection[];
};

export type SourceMaterial = {
  sourceType: "GITHUB_REPO" | "GITHUB_ISSUE" | "NOTION_PAGE" | "SLACK_MESSAGE" | "JIRA_ISSUE";
  sourceObjectId: string;
  title: string;
  url?: string;
  author?: string;
  createdAtSource?: Date;
  rawContent: string;
  metadata: Record<string, unknown>;
};

export type DemoPrincipal = {
  id: string;
  email: string;
  role: Role;
};
