import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notFound } from "@/lib/http";

const patchSchema = z.object({
  contentMarkdown: z.string().min(1),
  structuredJson: z.any().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.MENTOR]);
  if (auth.denied) {
    return auth.denied;
  }
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const current = await prisma.handoverDraft.findUnique({ where: { id: resolvedParams.id } });
  if (!current) {
    return notFound("Handover draft not found");
  }
  const priorCitations = await prisma.citation.findMany({
    where: { handoverDraftId: current.id }
  });
  const taskId = current.transitionTaskId;
  const latest = await prisma.handoverDraft.findFirst({
    where: { transitionTaskId: taskId },
    orderBy: { version: "desc" }
  });
  const version = (latest?.version ?? 0) + 1;
  const next = await prisma.handoverDraft.create({
    data: {
      transitionTaskId: taskId,
      version,
      contentMarkdown: parsed.data.contentMarkdown,
      structuredJson: parsed.data.structuredJson ?? current.structuredJson,
      status: "IN_REVIEW"
    }
  });
  if (priorCitations.length > 0) {
    await prisma.citation.createMany({
      data: priorCitations.map((citation) => ({
        documentType: "handover",
        documentId: next.id,
        sectionKey: citation.sectionKey,
        sourceItemId: citation.sourceItemId,
        excerpt: citation.excerpt,
        confidenceScore: citation.confidenceScore,
        handoverDraftId: next.id
      }))
    });
  }
  await createAuditLog({
    transitionTaskId: taskId,
    actorUserId: auth.principal?.id,
    action: "HANDOVER_UPDATED",
    details: { fromVersion: current.version, toVersion: version }
  });
  return NextResponse.json(next);
}
