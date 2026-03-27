import { NextRequest, NextResponse } from "next/server";
import { Role, TaskType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { buildTaskSourceSelection } from "@/lib/task-source-selection";

const sourceFiltersSchema = z
  .object({
    branch: z.string().trim().min(1).optional(),
    author: z.string().trim().min(1).optional(),
    labels: z.array(z.string().trim().min(1)).optional(),
    keywords: z.array(z.string().trim().min(1)).optional()
  })
  .partial();

const createTaskSchema = z.object({
  type: z.nativeEnum(TaskType),
  ownerUserId: z.string().min(1),
  targetRole: z.string().min(1),
  successorUserId: z.string().optional().nullable(),
  dateFrom: z.string().datetime(),
  dateTo: z.string().datetime(),
  sourceConnectionIds: z.array(z.string()).default([]),
  sourceFilters: sourceFiltersSchema.optional()
});

export async function POST(req: NextRequest) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
  if (auth.denied) {
    return auth.denied;
  }

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const dateFrom = new Date(parsed.data.dateFrom);
  const dateTo = new Date(parsed.data.dateTo);
  if (dateFrom > dateTo) {
    return NextResponse.json({ error: "dateFrom must be less than or equal to dateTo" }, { status: 400 });
  }

  const task = await prisma.transitionTask.create({
    data: {
      type: parsed.data.type,
      ownerUserId: parsed.data.ownerUserId,
      targetRole: parsed.data.targetRole,
      successorUserId: parsed.data.successorUserId ?? null,
      dateFrom,
      dateTo,
      sourceSelection: buildTaskSourceSelection({
        connectionIds: parsed.data.sourceConnectionIds,
        filters: parsed.data.sourceFilters
      })
    }
  });

  await createAuditLog({
    transitionTaskId: task.id,
    actorUserId: auth.principal?.id,
    action: "TASK_CREATED",
    details: { payload: parsed.data }
  });

  return NextResponse.json(task, { status: 201 });
}

export async function GET(req: NextRequest) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.SUCCESSOR, Role.MENTOR]);
  if (auth.denied) {
    return auth.denied;
  }
  const tasks = await prisma.transitionTask.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      owner: {
        select: { id: true, name: true, email: true, role: true }
      }
    }
  });
  return NextResponse.json(tasks);
}
