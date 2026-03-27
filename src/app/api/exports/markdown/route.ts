import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireRoles } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { exportMarkdownFile } from "@/lib/export";
import { createAuditLog } from "@/lib/audit";
import { transitionTaskStatus } from "@/lib/tasks";
import { badRequest } from "@/lib/http";

const schema = z.object({
  transitionTaskId: z.string().min(1),
  document: z.enum(["handover", "onboarding"])
});

export async function POST(req: NextRequest) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.EMPLOYEE, Role.MANAGER, Role.SUCCESSOR, Role.MENTOR]);
  if (auth.denied) {
    return auth.denied;
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const task = await prisma.transitionTask.findUnique({
    where: { id: parsed.data.transitionTaskId }
  });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.status !== "APPROVED") {
    return badRequest("Export is allowed only after manager approval");
  }

  if (parsed.data.document === "handover") {
    const draft = await prisma.handoverDraft.findFirst({
      where: { transitionTaskId: parsed.data.transitionTaskId },
      orderBy: { version: "desc" }
    });
    if (!draft) {
      return NextResponse.json({ error: "Handover draft not found" }, { status: 404 });
    }
    const file = exportMarkdownFile({
      title: `handover-${parsed.data.transitionTaskId}-v${draft.version}`,
      markdown: draft.contentMarkdown
    });
    await createAuditLog({
      transitionTaskId: parsed.data.transitionTaskId,
      actorUserId: auth.principal?.id,
      action: "EXPORT_MARKDOWN",
      details: { document: parsed.data.document }
    });
    await transitionTaskStatus(parsed.data.transitionTaskId, "EXPORTED").catch(() => undefined);
    return new NextResponse(file.content, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`
      }
    });
  }

  const pack = await prisma.onboardingPack.findFirst({
    where: { transitionTaskId: parsed.data.transitionTaskId },
    orderBy: { version: "desc" }
  });
  if (!pack) {
    return NextResponse.json({ error: "Onboarding pack not found" }, { status: 404 });
  }
  const file = exportMarkdownFile({
    title: `onboarding-${parsed.data.transitionTaskId}-v${pack.version}`,
    markdown: pack.contentMarkdown
  });
  await createAuditLog({
    transitionTaskId: parsed.data.transitionTaskId,
    actorUserId: auth.principal?.id,
    action: "EXPORT_MARKDOWN",
    details: { document: parsed.data.document }
  });
  await transitionTaskStatus(parsed.data.transitionTaskId, "EXPORTED").catch(() => undefined);
  return new NextResponse(file.content, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.fileName}"`
    }
  });
}
