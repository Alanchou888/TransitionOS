import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireRoles } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { exportPdfHtml } from "@/lib/export";
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

  const markdown =
    parsed.data.document === "handover"
      ? (
          await prisma.handoverDraft.findFirst({
            where: { transitionTaskId: parsed.data.transitionTaskId },
            orderBy: { version: "desc" }
          })
        )?.contentMarkdown
      : (
          await prisma.onboardingPack.findFirst({
            where: { transitionTaskId: parsed.data.transitionTaskId },
            orderBy: { version: "desc" }
          })
        )?.contentMarkdown;

  if (!markdown) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const file = exportPdfHtml({
    title: `${parsed.data.document}-${parsed.data.transitionTaskId}`,
    markdown
  });
  await createAuditLog({
    transitionTaskId: parsed.data.transitionTaskId,
    actorUserId: auth.principal?.id,
    action: "EXPORT_PDF_HTML",
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
