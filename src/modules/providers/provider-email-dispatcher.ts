import type {
  ProviderEmailDeliveryPort,
  ProviderEmailOutboxRepositoryPort,
  ProviderIdentityReaderPort,
} from "./domain/providers.ports.js";
import type { ProviderEmailOutboxRecord } from "./domain/providers.types.js";
import { PROVIDER_EMAIL_TEMPLATES } from "./domain/providers.types.js";

/** Fixed retry delays: 1m / 5m / 30m / 2h / 12h. */
export const PROVIDER_EMAIL_RETRY_DELAYS_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  2 * 60 * 60_000,
  12 * 60 * 60_000,
] as const;

export const PROVIDER_EMAIL_MAX_ATTEMPTS = 5;

export interface ProviderEmailDispatcherConfig {
  readonly batchSize: number;
  readonly leaseSeconds: number;
}

export interface ProviderEmailDispatcherDependencies {
  readonly outbox: ProviderEmailOutboxRepositoryPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly emailDelivery: ProviderEmailDeliveryPort;
  readonly config: ProviderEmailDispatcherConfig;
  readonly now?: () => Date;
}

function safeErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z][A-Z0-9_]{1,63}$/u.test(error.code)
  ) {
    return error.code.slice(0, 100);
  }
  return "PROVIDER_EMAIL_DELIVERY_FAILED";
}

function templateSubject(
  template: (typeof PROVIDER_EMAIL_TEMPLATES)[number],
): string {
  switch (template) {
    case "APPLICATION_SUBMITTED":
      return "Your Cleanora Provider application was submitted";
    case "CHANGES_REQUESTED":
      return "Changes requested on your Cleanora Provider application";
    case "APPROVED":
      return "Your Cleanora Provider application was approved";
    case "REJECTED":
      return "Your Cleanora Provider application was rejected";
    case "SUSPENDED":
      return "Your Cleanora Provider account was suspended";
    case "REINSTATED":
      return "Your Cleanora Provider account was reinstated";
    case "VERIFICATION_DOCUMENT_SUBMITTED":
      return "Your Cleanora verification document was submitted";
    case "VERIFICATION_DOCUMENT_DECIDED":
      return "Your Cleanora verification document was reviewed";
    case "PAYOUT_DESTINATION_SUBMITTED":
      return "Your Cleanora payout destination was submitted";
    case "PAYOUT_DESTINATION_DECIDED":
      return "Your Cleanora payout destination was reviewed";
    case "PAYOUT_PRIMARY_CHANGED":
      return "Your Cleanora primary payout destination changed";
    case "PAYOUT_DESTINATION_REMOVED":
      return "Your Cleanora payout destination was removed";
    case "PAYOUT_SUCCESSOR_APPROVED":
      return "Your Cleanora replacement payout destination was approved";
  }
}

function nextAttemptAfterFailure(
  attemptCount: number,
  now: Date,
): { readonly status: "PENDING" | "FAILED"; readonly nextAttemptAt: Date | null } {
  if (attemptCount >= PROVIDER_EMAIL_MAX_ATTEMPTS) {
    return { status: "FAILED", nextAttemptAt: null };
  }
  const delay = PROVIDER_EMAIL_RETRY_DELAYS_MS[attemptCount - 1];
  if (delay === undefined) {
    return { status: "FAILED", nextAttemptAt: null };
  }
  return {
    status: "PENDING",
    nextAttemptAt: new Date(now.getTime() + delay),
  };
}

const PAYOUT_EMAIL_TEMPLATES = new Set<ProviderEmailOutboxRecord["template"]>([
  "PAYOUT_DESTINATION_SUBMITTED",
  "PAYOUT_DESTINATION_DECIDED",
  "PAYOUT_PRIMARY_CHANGED",
  "PAYOUT_DESTINATION_REMOVED",
  "PAYOUT_SUCCESSOR_APPROVED",
]);

function deliveryVariables(intent: ProviderEmailOutboxRecord): Readonly<Record<string, string>> {
  if (PAYOUT_EMAIL_TEMPLATES.has(intent.template)) {
    if (intent.payoutNotification === null) {
      throw Object.assign(new Error("Payout notification facts are unavailable."), {
        code: "PAYOUT_EMAIL_FACTS_UNAVAILABLE",
      });
    }
    return {
      destinationType: intent.payoutNotification.destinationType,
      mask: intent.payoutNotification.mask,
      status: intent.payoutNotification.status,
      reason: intent.payoutNotification.reason,
    };
  }
  return {
    template: intent.template,
    subject: templateSubject(intent.template),
    providerId: intent.providerId,
    ...(intent.reviewCycle === null
      ? {}
      : { reviewCycle: String(intent.reviewCycle) }),
  };
}

/**
 * Bounded in-process dispatcher for the closed Provider template catalog.
 * Invitation email is intentionally excluded and must never enter this path.
 */
export class ProviderEmailDispatcher {
  private readonly outbox: ProviderEmailOutboxRepositoryPort;
  private readonly identityReader: ProviderIdentityReaderPort;
  private readonly emailDelivery: ProviderEmailDeliveryPort;
  private readonly config: ProviderEmailDispatcherConfig;
  private readonly now: () => Date;

  public constructor(dependencies: ProviderEmailDispatcherDependencies) {
    this.outbox = dependencies.outbox;
    this.identityReader = dependencies.identityReader;
    this.emailDelivery = dependencies.emailDelivery;
    this.config = dependencies.config;
    this.now = dependencies.now ?? (() => new Date());
  }

  public async dispatchDueBatch(): Promise<{
    readonly claimed: number;
    readonly sent: number;
    readonly failed: number;
    readonly retried: number;
  }> {
    const now = this.now();
    const leaseUntil = new Date(
      now.getTime() + Math.max(1, this.config.leaseSeconds) * 1_000,
    );
    const batch = await this.outbox.claimBatch({
      now,
      batchSize: this.config.batchSize,
      leaseUntil,
    });

    let sent = 0;
    let failed = 0;
    let retried = 0;

    for (const intent of batch) {
      if (
        !(PROVIDER_EMAIL_TEMPLATES as readonly string[]).includes(
          intent.template,
        )
      ) {
        await this.recordFailure(intent, now, "PROVIDER_EMAIL_TEMPLATE_EXCLUDED");
        failed += 1;
        continue;
      }

      const outcome = await this.deliverOne(intent, now);
      if (outcome === "SENT") {
        sent += 1;
      } else if (outcome === "FAILED") {
        failed += 1;
      } else {
        retried += 1;
      }
    }

    return {
      claimed: batch.length,
      sent,
      failed,
      retried,
    };
  }

  private async deliverOne(
    intent: ProviderEmailOutboxRecord,
    now: Date,
  ): Promise<"SENT" | "FAILED" | "RETRIED"> {
    try {
      const recipientEmail = await this.identityReader.getAuthoritativeEmail(
        intent.recipientUserId,
      );
      if (recipientEmail === null || recipientEmail.trim().length === 0) {
        return this.recordFailure(
          intent,
          now,
          "PROVIDER_EMAIL_RECIPIENT_UNAVAILABLE",
        );
      }

      await this.emailDelivery.sendTemplate({
        template: intent.template,
        to: recipientEmail,
        locale: "AR",
        variables: deliveryVariables(intent),
        idempotencyKey: intent.idempotencyKey,
      });

      await this.outbox.markSent({ id: intent.id, sentAt: now });
      return "SENT";
    } catch (error) {
      return this.recordFailure(intent, now, safeErrorCode(error));
    }
  }

  private async recordFailure(
    intent: ProviderEmailOutboxRecord,
    now: Date,
    lastSafeErrorCode: string,
  ): Promise<"FAILED" | "RETRIED"> {
    const attemptCount = intent.attemptCount + 1;
    const next = nextAttemptAfterFailure(attemptCount, now);
    await this.outbox.markRetryOrFailed({
      id: intent.id,
      attemptCount,
      status: next.status,
      nextAttemptAt: next.nextAttemptAt,
      lastSafeErrorCode,
      lockedUntil: null,
    });
    return next.status === "FAILED" ? "FAILED" : "RETRIED";
  }
}

export function startProviderEmailDispatcher(
  dispatcher: ProviderEmailDispatcher,
  logger: { warn(message: string, context?: object): void },
  intervalMs = 60_000,
): () => void {
  let stopped = false;
  const run = (): void => {
    void dispatcher.dispatchDueBatch().catch((error: unknown) => {
      logger.warn("Provider email outbox dispatch failed", {
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    });
  };
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return (): void => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
  };
}
