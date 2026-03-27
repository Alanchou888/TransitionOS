import { prisma } from "@/lib/prisma";
import { ingestSourcesForTask } from "@/lib/connectors";
import { generateDocumentsForTask } from "@/lib/generation/engine";
import { transitionTaskStatus } from "@/lib/tasks";
import { createAuditLog } from "@/lib/audit";

export async function processOneJob(targetTaskId?: string) {
  const job = await prisma.generationJob.findFirst({
    where: {
      ...(targetTaskId ? { transitionTaskId: targetTaskId } : {}),
      status: "QUEUED",
      runAfter: {
        lte: new Date()
      }
    },
    orderBy: { createdAt: "asc" }
  });

  if (!job) {
    return { processed: false as const };
  }

  await prisma.generationJob.update({
    where: { id: job.id },
    data: { status: "RUNNING", attempts: { increment: 1 } }
  });

  try {
    await transitionTaskStatus(job.transitionTaskId, "INGESTING");
    const ingestResult = await ingestSourcesForTask(job.transitionTaskId);
    const generationResult = await generateDocumentsForTask(job.transitionTaskId);
    await transitionTaskStatus(job.transitionTaskId, "IN_REVIEW");

    await prisma.generationJob.update({
      where: { id: job.id },
      data: { status: "SUCCEEDED", error: null }
    });

    await createAuditLog({
      transitionTaskId: job.transitionTaskId,
      action: "TASK_GENERATED",
      details: {
        importedSourceItems: ingestResult.imported,
        warnings: ingestResult.warnings,
        hasCitationGap: generationResult.hasCitationGap,
        generationMode: generationResult.generationMode,
        handoverMode: generationResult.handoverMode,
        onboardingMode: generationResult.onboardingMode
      }
    });

    return {
      processed: true as const,
      jobId: job.id,
      result: { ingestResult, generationResult }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown job failure";
    await prisma.generationJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: message
      }
    });
    await createAuditLog({
      transitionTaskId: job.transitionTaskId,
      action: "TASK_GENERATION_FAILED",
      details: { error: message }
    });
    return {
      processed: true as const,
      jobId: job.id,
      error: message
    };
  }
}
