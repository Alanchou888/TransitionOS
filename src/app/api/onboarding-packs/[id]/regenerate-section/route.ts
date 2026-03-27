import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notFound } from "@/lib/http";
import { regenerateDocumentSectionForTask } from "@/lib/generation/engine";
import { toMarkdown } from "@/lib/generation/markdown";

const schema = z.object({
  sectionKey: z.string().trim().min(1)
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.MENTOR]);
  if (auth.denied) {
    return auth.denied;
  }

  const resolved = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const current = await prisma.onboardingPack.findUnique({
    where: { id: resolved.id },
    include: { checklistItems: true }
  });
  if (!current) {
    return notFound("Onboarding pack not found");
  }
  const priorCitations = await prisma.citation.findMany({
    where: { onboardingPackId: current.id }
  });
  const latest = await prisma.onboardingPack.findFirst({
    where: { transitionTaskId: current.transitionTaskId },
    orderBy: { version: "desc" }
  });
  const nextVersion = (latest?.version ?? 0) + 1;

  const regenerated = await regenerateDocumentSectionForTask({
    transitionTaskId: current.transitionTaskId,
    documentType: "onboarding",
    sectionKey: parsed.data.sectionKey,
    baseDocument: current.structuredJson
  });

  const next = await prisma.onboardingPack.create({
    data: {
      transitionTaskId: current.transitionTaskId,
      version: nextVersion,
      contentMarkdown: toMarkdown(`Onboarding Pack v${nextVersion}`, regenerated.generated),
      structuredJson: regenerated.generated,
      status: "IN_REVIEW"
    }
  });
  if (current.checklistItems.length > 0) {
    await prisma.checklistItem.createMany({
      data: current.checklistItems.map((item) => ({
        onboardingPackId: next.id,
        section: item.section,
        title: item.title,
        description: item.description,
        priority: item.priority,
        completedBy: item.completedBy,
        completedAt: item.completedAt,
        mentorNote: item.mentorNote
      }))
    });
  }

  const keepCitations = priorCitations.filter((citation) => citation.sectionKey !== parsed.data.sectionKey);
  if (keepCitations.length > 0) {
    await prisma.citation.createMany({
      data: keepCitations.map((citation) => ({
        documentType: "onboarding",
        documentId: next.id,
        sectionKey: citation.sectionKey,
        sourceItemId: citation.sourceItemId,
        excerpt: citation.excerpt,
        confidenceScore: citation.confidenceScore,
        onboardingPackId: next.id
      }))
    });
  }
  for (const sourceItemId of regenerated.section.sourceItemIds) {
    await prisma.citation.create({
      data: {
        documentType: "onboarding",
        documentId: next.id,
        sectionKey: regenerated.section.key,
        sourceItemId,
        excerpt: "Regenerated section source reference",
        confidenceScore: 0.75,
        onboardingPackId: next.id
      }
    });
  }

  await createAuditLog({
    transitionTaskId: current.transitionTaskId,
    actorUserId: auth.principal?.id,
    action: "ONBOARDING_SECTION_REGENERATED",
    details: {
      sectionKey: parsed.data.sectionKey,
      fromVersion: current.version,
      toVersion: nextVersion,
      generationMode: regenerated.mode
    }
  });

  return NextResponse.json({
    ok: true,
    id: next.id,
    version: next.version,
    sectionKey: regenerated.section.key,
    generationMode: regenerated.mode
  });
}
