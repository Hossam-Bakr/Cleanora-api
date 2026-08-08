import { PrismaPrivacyRequestRepository } from "./infrastructure/prisma-privacy-request.repository.js";
import { PrismaCustomersUnitOfWork } from "./infrastructure/prisma-customers.unit-of-work.js";

export const PRIVACY_RETENTION_SWEEP_BATCH_SIZE = 100;
export const PRIVACY_RETENTION_SWEEP_INTERVAL_MS = 60 * 60 * 1_000;

/** Customers-owned bounded purge of expired terminal request metadata only. */
export class PrivacyRetentionSweep {
  public constructor(
    private readonly unitOfWork: PrismaCustomersUnitOfWork,
    private readonly repository: PrismaPrivacyRequestRepository,
    private readonly now: () => Date = () => new Date(),
    private readonly batchSize = PRIVACY_RETENTION_SWEEP_BATCH_SIZE,
  ) {}

  public async run(): Promise<number> {
    return this.unitOfWork.run((context) =>
      this.repository.purgeExpiredTerminal(context.prisma, this.now(), this.batchSize));
  }
}

export function startPrivacyRetentionSweep(
  sweep: PrivacyRetentionSweep,
  logger: { warn(message: string, context?: object): void },
): () => void {
  void sweep.run().catch(() => logger.warn("Privacy retention startup sweep failed"));
  const timer = setInterval(() => {
    void sweep.run().catch(() => logger.warn("Privacy retention hourly sweep failed"));
  }, PRIVACY_RETENTION_SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
