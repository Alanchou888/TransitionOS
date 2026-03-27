import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { processOneJob } from "@/lib/jobs/process-job";

export async function POST(req: NextRequest) {
  const auth = await requireRoles(req, [Role.ADMIN, Role.MANAGER]);
  if (auth.denied) {
    return auth.denied;
  }
  const result = await processOneJob();
  return NextResponse.json(result);
}
