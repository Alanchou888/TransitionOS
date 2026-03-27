import { TaskStatus } from "@prisma/client";

const transitions: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ["INGESTING"],
  INGESTING: ["GENERATED"],
  GENERATED: ["IN_REVIEW", "INGESTING"],
  IN_REVIEW: ["CHANGES_REQUESTED", "APPROVED", "INGESTING"],
  CHANGES_REQUESTED: ["IN_REVIEW", "INGESTING"],
  APPROVED: ["EXPORTED"],
  EXPORTED: []
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return transitions[from].includes(to);
}
