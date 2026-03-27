import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { buildTimeline } from "@/lib/knowledge/insights";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.SUCCESSOR, Role.MENTOR]);
  if (auth.denied) {
    return auth.denied;
  }
  const resolved = await params;
  const sourceItems = await prisma.sourceItem.findMany({
    where: { transitionTaskId: resolved.id },
    orderBy: { createdAtSource: "desc" }
  });
  return NextResponse.json({ taskId: resolved.id, timeline: buildTimeline(sourceItems) });
}

