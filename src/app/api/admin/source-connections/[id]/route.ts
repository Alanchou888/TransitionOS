import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { validateAndNormalizeSourceConfig } from "@/lib/source-config";
import { badRequest, notFound } from "@/lib/http";
import { maskSourceConfig, mergeSecretConfigWithExisting } from "@/lib/source-secrets";

const patchSchema = z.object({
  configJson: z.record(z.any()).optional(),
  enabled: z.boolean().optional()
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(req, [Role.ADMIN]);
  if (auth.denied) {
    return auth.denied;
  }
  const resolved = await params;
  const existing = await prisma.sourceConnection.findUnique({
    where: { id: resolved.id }
  });
  if (!existing) {
    return notFound("Source connection not found");
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.configJson === undefined && parsed.data.enabled === undefined) {
    return badRequest("Provide at least one field: configJson or enabled");
  }

  let normalizedConfig = existing.configJson as Prisma.InputJsonValue;
  if (parsed.data.configJson) {
    const merged = mergeSecretConfigWithExisting({
      type: existing.type,
      incoming: parsed.data.configJson,
      existing: existing.configJson
    });
    const validation = validateAndNormalizeSourceConfig(existing.type, merged);
    if ("error" in validation && validation.error) {
      return badRequest(validation.error);
    }
    normalizedConfig = validation.normalizedConfig as Prisma.InputJsonValue;
  }

  const updated = await prisma.sourceConnection.update({
    where: { id: existing.id },
    data: {
      configJson: normalizedConfig,
      ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {})
    }
  });

  await createAuditLog({
    actorUserId: auth.principal?.id,
    action: "SOURCE_CONNECTION_UPDATED",
    details: {
      sourceConnectionId: updated.id,
      type: updated.type,
      changedFields: Object.keys(parsed.data)
    }
  });

  return NextResponse.json({
    ...updated,
    configJson: maskSourceConfig(updated.type, updated.configJson)
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(req, [Role.ADMIN]);
  if (auth.denied) {
    return auth.denied;
  }
  const resolved = await params;
  const existing = await prisma.sourceConnection.findUnique({
    where: { id: resolved.id }
  });
  if (!existing) {
    return notFound("Source connection not found");
  }

  await prisma.sourceConnection.delete({
    where: { id: existing.id }
  });
  await createAuditLog({
    actorUserId: auth.principal?.id,
    action: "SOURCE_CONNECTION_DELETED",
    details: {
      sourceConnectionId: existing.id,
      type: existing.type
    }
  });
  return NextResponse.json({ ok: true, deletedId: existing.id });
}
