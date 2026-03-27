import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { processOneJob } from "@/lib/jobs/process-job";
import { notFound } from "@/lib/http";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER]);
  if (auth.denied) {
    return auth.denied;
  }

  const task = await prisma.transitionTask.findUnique({ where: { id: resolvedParams.id } });
  if (!task) {
    return notFound("Task not found");
  }

  const existingRunning = await prisma.generationJob.findFirst({
    where: {
      transitionTaskId: task.id,
      status: { in: ["QUEUED", "RUNNING"] }
    }
  });
  if (!existingRunning) {
    await prisma.generationJob.create({
      data: {
        transitionTaskId: task.id,
        status: "QUEUED"
      }
    });
  }

  await createAuditLog({
    transitionTaskId: task.id,
    actorUserId: auth.principal?.id,
    action: "TASK_RUN_TRIGGERED"
  });

  const result = await processOneJob(task.id);
  return NextResponse.json({
    ok: true,
    taskId: task.id,
    run: result
  });
}
