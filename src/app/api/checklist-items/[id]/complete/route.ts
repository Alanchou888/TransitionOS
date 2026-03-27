import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notFound } from "@/lib/http";

const completeSchema = z.object({
  completed: z.boolean(),
  mentorNote: z.string().max(500).optional()
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const auth = await requireRoles(req, [Role.ADMIN, Role.SUCCESSOR, Role.MENTOR, Role.MANAGER]);
  if (auth.denied) {
    return auth.denied;
  }
  const body = await req.json().catch(() => null);
  const parsed = completeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const item = await prisma.checklistItem.findUnique({
    where: { id: resolvedParams.id },
    include: {
      onboardingPack: true
    }
  });
  if (!item) {
    return notFound("Checklist item not found");
  }
  const next = await prisma.checklistItem.update({
    where: { id: item.id },
    data: {
      completedAt: parsed.data.completed ? new Date() : null,
      completedBy: parsed.data.completed ? auth.principal!.id : null,
      mentorNote: parsed.data.mentorNote ?? item.mentorNote
    }
  });
  await createAuditLog({
    transitionTaskId: item.onboardingPack.transitionTaskId,
    actorUserId: auth.principal?.id,
    action: "CHECKLIST_ITEM_UPDATED",
    details: { checklistItemId: item.id, completed: parsed.data.completed }
  });
  return NextResponse.json(next);
}
