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
  const task = await prisma.transitionTask.findUnique({ where: { id: resolvedParams.id } });
  if (!task) {
    return notFound("Task not found");
  }
  const items = await prisma.sourceItem.findMany({
    where: { transitionTaskId: task.id },
    orderBy: [{ sourceType: "asc" }, { createdAtSource: "desc" }]
  });
  return NextResponse.json(items);
}
