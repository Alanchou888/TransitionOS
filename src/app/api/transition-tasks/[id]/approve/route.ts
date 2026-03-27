import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { transitionTaskStatus } from "@/lib/tasks";
import { createAuditLog } from "@/lib/audit";
import { badRequest, notFound } from "@/lib/http";
import {
  listMissingCitationSections,
  listNeedsHumanFillSections
} from "@/lib/generation/validation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const auth = await requireRoles(req, [Role.ADMIN, Role.MANAGER]);
  if (auth.denied) {
    return auth.denied;
  }
  const task = await prisma.transitionTask.findUnique({
    where: { id: resolvedParams.id },
    include: {
      handoverDrafts: { orderBy: { version: "desc" }, take: 1 },
      onboardingPacks: {
        orderBy: { version: "desc" },
        take: 1,
        include: { checklistItems: true }
      }
    }
  });
  if (!task) {
    return notFound("Task not found");
  }
  const latestHandover = task.handoverDrafts[0];
  const latestOnboarding = task.onboardingPacks[0];
  if (!latestHandover || !latestOnboarding) {
    return badRequest("Both handover draft and onboarding pack must exist before approval");
  }

  const missingCitationSections = [
    ...listMissingCitationSections(latestHandover.structuredJson).map((key) => `handover:${key}`),
    ...listMissingCitationSections(latestOnboarding.structuredJson).map((key) => `onboarding:${key}`)
  ];
  if (missingCitationSections.length > 0) {
    return badRequest(
      `Approval blocked: missing citations in sections ${missingCitationSections.join(", ")}`
    );
  }
  const needsHumanFillSections = [
    ...listNeedsHumanFillSections(latestHandover.structuredJson).map((key) => `handover:${key}`),
    ...listNeedsHumanFillSections(latestOnboarding.structuredJson).map((key) => `onboarding:${key}`)
  ];
  if (needsHumanFillSections.length > 0) {
    return badRequest(
      `Approval blocked: needs_human_fill sections found ${needsHumanFillSections.join(", ")}`
    );
  }

  const latestGenerationLog = await prisma.auditLog.findFirst({
    where: {
      transitionTaskId: task.id,
      action: "TASK_GENERATED"
    },
    orderBy: { createdAt: "desc" }
  });
  const warnings =
    ((latestGenerationLog?.detailsJson as { warnings?: string[] } | null)?.warnings ?? []).filter(
      (entry): entry is string => typeof entry === "string"
    );
  if (warnings.length > 0) {
    return badRequest("Approval blocked: resolve generation warnings before approval");
  }

  const checklist = latestOnboarding.checklistItems;
  const done = checklist.filter((item) => Boolean(item.completedAt)).length;
  const progress = checklist.length ? Math.round((done / checklist.length) * 100) : 0;
  const configuredThreshold = Number(process.env.APPROVAL_CHECKLIST_MIN_PERCENT ?? "60");
  const minProgress = Number.isFinite(configuredThreshold)
    ? Math.min(100, Math.max(0, Math.round(configuredThreshold)))
    : 60;
  if (checklist.length > 0 && progress < minProgress) {
    return badRequest(
      `Approval blocked: checklist completion is ${progress}% (minimum ${minProgress}% required)`
    );
  }

  await prisma.$transaction([
    prisma.approval.create({
      data: {
        transitionTaskId: task.id,
        approverUserId: auth.principal!.id,
        decision: "APPROVE"
      }
    }),
    prisma.handoverDraft.update({
      where: { id: latestHandover.id },
      data: { status: "APPROVED" }
    }),
    prisma.onboardingPack.update({
      where: { id: latestOnboarding.id },
      data: { status: "APPROVED" }
    })
  ]);
  await transitionTaskStatus(task.id, "APPROVED");
  await createAuditLog({
    transitionTaskId: task.id,
    actorUserId: auth.principal?.id,
    action: "TASK_APPROVED",
    details: {
      checklistProgress: progress,
      checklistThreshold: minProgress
    }
  });
  return NextResponse.json({ ok: true, taskId: task.id, status: "APPROVED" });
}
