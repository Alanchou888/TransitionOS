import { processOneJob } from "@/lib/jobs/process-job";

export async function runJobLoop(options?: { intervalMs?: number; maxIterations?: number }) {
  const intervalMs = options?.intervalMs ?? 2000;
  const maxIterations = options?.maxIterations ?? Number.POSITIVE_INFINITY;
  let iterations = 0;

  while (iterations < maxIterations) {
    iterations += 1;
    await processOneJob();
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

