import { NextRequest, NextResponse } from "next/server";
import { Role, TaskStatus, TaskType, type TransitionTask } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoles } from "@/lib/rbac";
import { createAuditLog } from "@/lib/audit";
import { notFound } from "@/lib/http";
import { resolveConnectorAdapter } from "@/lib/connectors";

function buildProbeTask(): TransitionTask {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    id: "source-connection-probe",
    type: TaskType.BOTH,
    ownerUserId: "source-connection-probe",
    targetRole: "Probe",
    successorUserId: null,
    dateFrom: from,
    dateTo: now,
    sourceSelection: null,
    status: TaskStatus.DRAFT,
    createdAt: now,
    updatedAt: now
  };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRoles(req, [Role.ADMIN]);
  if (auth.denied) {
    return auth.denied;
  }

  const resolved = await params;
  const connection = await prisma.sourceConnection.findUnique({
    where: { id: resolved.id }
  });
  if (!connection) {
    return notFound("Source connection not found");
  }

  const adapter = resolveConnectorAdapter(connection);
  if (!adapter) {
    return NextResponse.json({ error: `No adapter for source type ${connection.type}` }, { status: 400 });
  }

  try {
    const items = await adapter.fetchItems(connection, buildProbeTask());
    await createAuditLog({
      actorUserId: auth.principal?.id,
      action: "SOURCE_CONNECTION_TESTED",
      details: {
        sourceConnectionId: connection.id,
        sourceType: connection.type,
        ok: true,
        importedPreviewCount: items.length
      }
    });

    return NextResponse.json({
      ok: true,
      sourceConnectionId: connection.id,
      sourceType: connection.type,
      itemCount: items.length,
      sample: items.slice(0, 5).map((item) => ({
        sourceObjectId: item.sourceObjectId,
        title: item.title,
        author: item.author ?? null,
        createdAtSource: item.createdAtSource?.toISOString() ?? null,
        url: item.url ?? null
      }))
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connector test error";
    await createAuditLog({
      actorUserId: auth.principal?.id,
      action: "SOURCE_CONNECTION_TESTED",
      details: {
        sourceConnectionId: connection.id,
        sourceType: connection.type,
        ok: false,
        error: message
      }
    });
    return NextResponse.json(
      {
        ok: false,
        sourceConnectionId: connection.id,
        sourceType: connection.type,
        error: message
      },
      { status: 400 }
    );
  }
}
