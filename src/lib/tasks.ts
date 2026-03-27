import { TaskStatus } from "@prisma/client";
import { canTransition } from "@/lib/status";
import { prisma } from "@/lib/prisma";

export async function transitionTaskStatus(taskId: string, to: TaskStatus) {
  const task = await prisma.transitionTask.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error("Task not found");
  }
  if (!canTransition(task.status, to)) {
    throw new Error(`Invalid task status transition: ${task.status} -> ${to}`);
  }
  return prisma.transitionTask.update({ where: { id: taskId }, data: { status: to } });
}

