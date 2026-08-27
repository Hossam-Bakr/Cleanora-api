import type { LeasedWorkforceNotification } from "./infrastructure/prisma-provider-workforce-notification.repository.js";

export interface ProviderWorkforceNotificationLeasePort {
  lease(limit: number, now: Date, lockedUntil: Date): Promise<readonly LeasedWorkforceNotification[]>;
  markSent(id: string, now: Date): Promise<void>;
  markFailed(id: string, safeErrorCode: string, nextAttemptAt: Date): Promise<void>;
}

export interface ProviderWorkforceNotificationDeliveryPort {
  deliver(input: LeasedWorkforceNotification): Promise<void>;
}

export class ProviderWorkforceNotificationDispatcher {
  public constructor(
    private readonly repository: ProviderWorkforceNotificationLeasePort,
    private readonly delivery: ProviderWorkforceNotificationDeliveryPort,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async dispatch(limit = 25): Promise<{ readonly sent: number; readonly failed: number }> {
    const now = this.now();
    const rows = await this.repository.lease(limit, now, new Date(now.getTime() + 60_000));
    let sent = 0;
    let failed = 0;
    for (const row of rows) {
      try {
        await this.delivery.deliver(row);
        await this.repository.markSent(row.id, this.now());
        sent += 1;
      } catch {
        const failedAt = this.now();
        await this.repository.markFailed(row.id, "WORKFORCE_EMAIL_DELIVERY_FAILED", new Date(failedAt.getTime() + 60_000));
        failed += 1;
      }
    }
    return { sent, failed };
  }
}

export function startProviderWorkforceNotificationDispatcher(
  dispatcher: ProviderWorkforceNotificationDispatcher,
  logger: { error(message: string, context?: Readonly<Record<string, unknown>>): void },
  intervalMilliseconds = 30_000,
): () => void {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    void dispatcher.dispatch().catch((error: unknown) => {
      logger.error("Provider workforce notification dispatch failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }).finally(() => { running = false; });
  }, intervalMilliseconds);
  timer.unref();
  return () => clearInterval(timer);
}
