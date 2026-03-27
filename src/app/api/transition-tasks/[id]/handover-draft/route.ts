import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { notFound } from "@/lib/http";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.SUCCESSOR, Role.MENTOR]);
  if (auth.denied) {
    return auth.denied;
  }
  const draft = await prisma.handoverDraft.findFirst({
    where: { transitionTaskId: resolvedParams.id },
    orderBy: { version: "desc" }
  });
  if (!draft) {
    return notFound("Handover draft not found");
  }
  const citations = await prisma.citation.findMany({
    where: { handoverDraftId: draft.id },
    include: { sourceItem: true }
  });
  return NextResponse.json({ ...draft, citations });
}
