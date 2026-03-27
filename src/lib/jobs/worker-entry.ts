import { runJobLoop } from "@/lib/jobs/runner";

async function main() {
  console.log("TransitionOS worker started.");
  await runJobLoop();
}

main().catch((error) => {
  console.error("Worker exited with error:", error);
  process.exit(1);
});

