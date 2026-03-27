import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function createAuditLog(input: {
  transitionTaskId?: string;
  actorUserId?: string;
  action: string;
  details?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      transitionTaskId: input.transitionTaskId,
      actorUserId: input.actorUserId,
      action: input.action,
      detailsJson: (input.details ?? {}) as Prisma.InputJsonValue
    }
  });
}
