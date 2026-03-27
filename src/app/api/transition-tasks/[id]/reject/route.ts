import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { transitionTaskStatus } from "@/lib/tasks";
import { createAuditLog } from "@/lib/audit";
import { notFound } from "@/lib/http";

const rejectSchema = z.object({
  comment: z.string().min(1).max(400)
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const auth = await requireRoles(req, [Role.ADMIN, Role.MANAGER]);
  if (auth.denied) {
    return auth.denied;
  }
  const task = await prisma.transitionTask.findUnique({ where: { id: resolvedParams.id } });
  if (!task) {
    return notFound("Task not found");
  }
  const body = await req.json().catch(() => null);
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await prisma.approval.create({
    data: {
      transitionTaskId: task.id,
      approverUserId: auth.principal!.id,
      decision: "REJECT",
      comment: parsed.data.comment
    }
  });
  await transitionTaskStatus(task.id, "CHANGES_REQUESTED");
  await createAuditLog({
    transitionTaskId: task.id,
    actorUserId: auth.principal?.id,
    action: "TASK_REJECTED",
    details: { comment: parsed.data.comment }
  });
  return NextResponse.json({ ok: true, taskId: task.id, status: "CHANGES_REQUESTED" });
}
