import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { badRequest, notFound } from "@/lib/http";
import { onboardingProgress } from "@/lib/generation/engine";
import { createAuditLog } from "@/lib/audit";
import {
  canDeleteTaskForPrincipal,
  canManageTaskForPrincipal
} from "@/lib/permissions";
import { buildTaskSourceSelection, parseTaskSourceSelection } from "@/lib/task-source-selection";

const sourceFiltersSchema = z
  .object({
    branch: z.string().trim().min(1).optional(),
    author: z.string().trim().min(1).optional(),
    labels: z.array(z.string().trim().min(1)).optional(),
    keywords: z.array(z.string().trim().min(1)).optional()
  })
  .partial();

const patchSchema = z.object({
  type: z.enum(["HANDOVER", "ONBOARDING", "BOTH"]).optional(),
  ownerUserId: z.string().min(1).optional(),
  successorUserId: z.string().min(1).nullable().optional(),
  targetRole: z.string().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sourceConnectionIds: z.array(z.string()).optional(),
  sourceFilters: sourceFiltersSchema.optional()
});

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.SUCCESSOR, Role.MENTOR]);
  if (auth.denied) {
    return auth.denied;
  }

  const task = await prisma.transitionTask.findUnique({
    where: { id: resolvedParams.id },
    include: {
      owner: true,
      approvals: { orderBy: { createdAt: "desc" } },
      handoverDrafts: { orderBy: { version: "desc" }, take: 1 },
      onboardingPacks: {
        orderBy: { version: "desc" },
        take: 1,
        include: { checklistItems: true }
      },
      jobs: { orderBy: { createdAt: "desc" }, take: 5 }
    }
  });
  if (!task) {
    return notFound("Task not found");
  }

  const pack = task.onboardingPacks[0];
  const progress = pack ? onboardingProgress(pack) : 0;

  return NextResponse.json({ ...task, onboardingProgress: progress });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
  if (auth.denied) {
    return auth.denied;
  }

  const resolved = await params;
  const existing = await prisma.transitionTask.findUnique({
    where: { id: resolved.id }
  });
  if (!existing) {
    return notFound("Task not found");
  }
  if (!canManageTaskForPrincipal(auth.principal!, existing.ownerUserId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return badRequest("No task fields provided");
  }
  if (
    auth.principal?.role === Role.EMPLOYEE &&
    parsed.data.ownerUserId !== undefined &&
    parsed.data.ownerUserId !== existing.ownerUserId
  ) {
    return badRequest("Employees cannot reassign task ownership");
  }

  const nextDateFrom =
    parsed.data.dateFrom !== undefined ? new Date(parsed.data.dateFrom) : existing.dateFrom;
  const nextDateTo = parsed.data.dateTo !== undefined ? new Date(parsed.data.dateTo) : existing.dateTo;
  if (nextDateFrom > nextDateTo) {
    return badRequest("dateFrom must be less than or equal to dateTo");
  }

  const updated = await prisma.transitionTask.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(parsed.data.ownerUserId !== undefined ? { ownerUserId: parsed.data.ownerUserId } : {}),
      ...(parsed.data.successorUserId !== undefined ? { successorUserId: parsed.data.successorUserId } : {}),
      ...(parsed.data.targetRole !== undefined ? { targetRole: parsed.data.targetRole } : {}),
      ...(parsed.data.dateFrom !== undefined ? { dateFrom: nextDateFrom } : {}),
      ...(parsed.data.dateTo !== undefined ? { dateTo: nextDateTo } : {}),
      ...(() => {
        if (parsed.data.sourceConnectionIds === undefined && parsed.data.sourceFilters === undefined) {
          return {};
        }
        const existingSelection = parseTaskSourceSelection(existing.sourceSelection);
        return {
          sourceSelection: buildTaskSourceSelection({
            connectionIds: parsed.data.sourceConnectionIds ?? existingSelection.connectionIds,
            filters: parsed.data.sourceFilters ?? existingSelection.filters
          })
        };
      })()
    }
  });

  await createAuditLog({
    transitionTaskId: updated.id,
    actorUserId: auth.principal?.id,
    action: "TASK_UPDATED",
    details: {
      changedFields: Object.keys(parsed.data)
    }
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
  if (auth.denied) {
    return auth.denied;
  }

  const resolved = await params;
  const existing = await prisma.transitionTask.findUnique({
    where: { id: resolved.id }
  });
  if (!existing) {
    return notFound("Task not found");
  }
  if (!canDeleteTaskForPrincipal(auth.principal!, existing.ownerUserId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.transitionTask.delete({
    where: { id: existing.id }
  });
  await createAuditLog({
    actorUserId: auth.principal?.id,
    action: "TASK_DELETED",
    details: {
      transitionTaskId: existing.id
    }
  });
  return NextResponse.json({ ok: true, deletedId: existing.id });
}
