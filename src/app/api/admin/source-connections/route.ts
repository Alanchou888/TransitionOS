import { NextRequest, NextResponse } from "next/server";
import { Prisma, Role, SourceType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { validateAndNormalizeSourceConfig } from "@/lib/source-config";
import { maskSourceConfig } from "@/lib/source-secrets";

const schema = z.object({
  type: z.nativeEnum(SourceType),
  configJson: z.record(z.any()),
  enabled: z.boolean().default(true)
});

export async function GET(req: NextRequest) {
  const auth = await requireRoles(req, [Role.ADMIN]);
  if (auth.denied) {
    return auth.denied;
  }
  const rows = await prisma.sourceConnection.findMany({
    orderBy: [{ type: "asc" }, { createdAt: "desc" }]
  });
  return NextResponse.json(
    rows.map((row) => ({
      ...row,
      configJson: maskSourceConfig(row.type, row.configJson)
    }))
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(req, [Role.ADMIN]);
  if (auth.denied) {
    return auth.denied;
  }
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const validation = validateAndNormalizeSourceConfig(parsed.data.type, parsed.data.configJson);
  if ("error" in validation && validation.error) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const row = await prisma.sourceConnection.create({
    data: {
      type: parsed.data.type,
      configJson: validation.normalizedConfig as Prisma.InputJsonValue,
      enabled: parsed.data.enabled,
      createdBy: auth.principal!.id
    }
  });
  await createAuditLog({
    actorUserId: auth.principal?.id,
    action: "SOURCE_CONNECTION_CREATED",
    details: { sourceConnectionId: row.id, type: row.type }
  });
  return NextResponse.json(
    {
      ...row,
      configJson: maskSourceConfig(row.type, row.configJson)
    },
    { status: 201 }
  );
}
