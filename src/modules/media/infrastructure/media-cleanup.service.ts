import type { Logger } from "#shared/logger";

import type { MediaStoragePort } from "../domain/media.ports.js";
import { PrismaMediaRepository } from "./prisma-media.repository.js";

const DEFAULT_BATCH_SIZE = 25;
const STALE_PENDING_UPLOAD_MS = 15 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60_000;

/**
 * Bounded media cleanup for PENDING_DELETE and stale PENDING_UPLOAD rows.
 * Provider remove runs outside any Prisma transaction (DEC-033).
 */
export class MediaCleanupService {
  public constructor(
    private readonly repository: PrismaMediaRepository,
    private readonly storage: MediaStoragePort,
    private readonly batchSize: number = DEFAULT_BATCH_SIZE,
  ) {}

  public async sweepOnce(): Promise<{ readonly processed: number }> {
    const staleBefore = new Date(Date.now() - STALE_PENDING_UPLOAD_MS);
    const candidates = await this.repository.listCleanupCandidates(
      this.batchSize,
      staleBefore,
    );
    let processed = 0;
    for (const row of candidates) {
      if (row.status === "READY" || row.status === "PROCESSING") {
        continue;
      }
      try {
        await this.storage.remove({
          provider: row.storageProvider === "S3" ? "S3" : "CLOUDINARY",
          storageKey: row.storageKey,
        });
        await this.repository.markDeleted(row.id);
        processed += 1;
      } catch {
        // Leave retryable; next sweep will try again.
      }
    }
    return { processed };
  }
}

export function startMediaCleanupSweep(
  cleanup: MediaCleanupService,
  logger: Logger,
): () => void {
  let stopped = false;
  const run = (): void => {
    void cleanup.sweepOnce().catch((error: unknown) => {
      logger.warn("media cleanup sweep failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    });
  };
  run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return (): void => {
    if (stopped) {
      return;
    }
    stopped = true;
    clearInterval(timer);
  };
}
