import { seed } from "../prisma/seed.js";

/**
 * @desc Run the repository-owned idempotent seed operations.
 * @access Local developer script
 * @explanation This wrapper gives developers one stable command while each
 * active phase keeps its seed behavior inside prisma/seed.ts.
 */
async function runSeed(): Promise<void> {
  await seed();
}

void runSeed().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: "SEED_FAILED",
      errorName: error instanceof Error ? error.name : "UnknownError"
    })}\n`
  );
  process.exitCode = 1;
});
