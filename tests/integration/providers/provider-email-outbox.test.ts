import {
  PROVIDER_EMAIL_MAX_ATTEMPTS,
  PROVIDER_EMAIL_RETRY_DELAYS_MS,
  ProviderEmailDispatcher,
  startProviderEmailDispatcher,
} from "../../../src/modules/providers/provider-email-dispatcher.js";
import { PROVIDER_EMAIL_TEMPLATES } from "../../../src/modules/providers/domain/providers.types.js";
import type {
  ProviderEmailDeliveryPort,
  ProviderEmailOutboxRepositoryPort,
  ProviderIdentityReaderPort,
} from "../../../src/modules/providers/domain/providers.ports.js";
import type { ProviderEmailOutboxRecord } from "../../../src/modules/providers/domain/providers.types.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";
import { PrismaProviderEmailOutboxRepository } from "../../../src/modules/providers/infrastructure/prisma-provider-email-outbox.repository.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

function memoryIntent(
  overrides: Partial<ProviderEmailOutboxRecord> = {},
): ProviderEmailOutboxRecord {
  const now = new Date("2026-08-10T12:00:00.000Z");
  return {
    id: "outbox-1",
    providerId: "provider-1",
    template: "APPROVED",
    status: "PENDING",
    recipientUserId: "user-1",
    reviewCycle: 1,
    statusHistoryId: "history-1",
    idempotencyKey: "provider:provider-1:APPROVED:cycle:1",
    attemptCount: 0,
    nextAttemptAt: now,
    lockedUntil: null,
    sentAt: null,
    lastSafeErrorCode: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Provider email outbox dispatcher policy (T145)", () => {
  it("starts immediately and stops the owned background cadence", async () => {
    const dispatchDueBatch = vi.fn(async () => ({
      claimed: 0,
      sent: 0,
      failed: 0,
      retried: 0,
    }));
    const stop = startProviderEmailDispatcher(
      { dispatchDueBatch } as never,
      { warn: vi.fn() },
      60_000,
    );
    await vi.waitFor(() => expect(dispatchDueBatch).toHaveBeenCalledTimes(1));
    stop();
  });

  it("defines exactly six mandatory templates and fixed retry delays", () => {
    expect([...PROVIDER_EMAIL_TEMPLATES]).toEqual([
      "APPLICATION_SUBMITTED",
      "CHANGES_REQUESTED",
      "APPROVED",
      "REJECTED",
      "SUSPENDED",
      "REINSTATED",
    ]);
    expect(PROVIDER_EMAIL_TEMPLATES).not.toContain("INVITATION");
    expect([...PROVIDER_EMAIL_RETRY_DELAYS_MS]).toEqual([
      60_000,
      5 * 60_000,
      30 * 60_000,
      2 * 60 * 60_000,
      12 * 60 * 60_000,
    ]);
    expect(PROVIDER_EMAIL_MAX_ATTEMPTS).toBe(5);
  });

  it("retries with fixed delays and marks FAILED on the fifth attempt", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    let stored = memoryIntent({ attemptCount: 0, nextAttemptAt: now });
    const updates: Array<{
      attemptCount: number;
      status: string;
      nextAttemptAt: Date | null;
    }> = [];

    const outbox: ProviderEmailOutboxRepositoryPort = {
      async insertIntent() {
        return stored;
      },
      async findByIdempotencyKey() {
        return stored;
      },
      async claimBatch() {
        return [{ ...stored, status: "SENDING" }];
      },
      async markSent(input) {
        stored = { ...stored, status: "SENT", sentAt: input.sentAt };
        return stored;
      },
      async markRetryOrFailed(input) {
        updates.push({
          attemptCount: input.attemptCount,
          status: input.status,
          nextAttemptAt: input.nextAttemptAt,
        });
        stored = {
          ...stored,
          attemptCount: input.attemptCount,
          status: input.status,
          nextAttemptAt: input.nextAttemptAt,
          lastSafeErrorCode: input.lastSafeErrorCode,
          lockedUntil: input.lockedUntil,
        };
        return stored;
      },
    };

    const identityReader: ProviderIdentityReaderPort = {
      async getEligibilityFacts() {
        return null;
      },
      async getAuthoritativeEmail() {
        return "owner@example.com";
      },
      async findByEmailNormalized() {
        return null;
      },
    };

    const emailDelivery: ProviderEmailDeliveryPort = {
      async sendTemplate() {
        throw new Error("SMTP unavailable");
      },
    };

    const dispatcher = new ProviderEmailDispatcher({
      outbox,
      identityReader,
      emailDelivery,
      config: { batchSize: 10, leaseSeconds: 30 },
      now: () => now,
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      stored = {
        ...stored,
        status: "PENDING",
        lockedUntil: null,
        nextAttemptAt: now,
      };
      const result = await dispatcher.dispatchDueBatch();
      if (attempt < 5) {
        expect(result.retried).toBe(1);
        expect(updates.at(-1)).toMatchObject({
          attemptCount: attempt,
          status: "PENDING",
          nextAttemptAt: new Date(
            now.getTime() + PROVIDER_EMAIL_RETRY_DELAYS_MS[attempt - 1]!,
          ),
        });
      } else {
        expect(result.failed).toBe(1);
        expect(updates.at(-1)).toMatchObject({
          attemptCount: 5,
          status: "FAILED",
          nextAttemptAt: null,
        });
      }
    }
  });

  it("excludes invitation templates from the mandatory dispatcher path", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    let failedCode: string | null = null;
    const outbox: ProviderEmailOutboxRepositoryPort = {
      async insertIntent() {
        throw new Error("unused");
      },
      async findByIdempotencyKey() {
        return null;
      },
      async claimBatch() {
        return [
          memoryIntent({
            // Force a non-catalog template through the claim path.
            template: "INVITATION" as never,
            idempotencyKey: "invitation-excluded",
          }),
        ];
      },
      async markSent() {
        throw new Error("must not send invitation");
      },
      async markRetryOrFailed(input) {
        failedCode = input.lastSafeErrorCode;
        return memoryIntent({
          status: input.status,
          attemptCount: input.attemptCount,
          lastSafeErrorCode: input.lastSafeErrorCode,
        });
      },
    };

    const dispatcher = new ProviderEmailDispatcher({
      outbox,
      identityReader: {
        async getEligibilityFacts() {
          return null;
        },
        async getAuthoritativeEmail() {
          return "x@example.com";
        },
        async findByEmailNormalized() {
          return null;
        },
      },
      emailDelivery: {
        async sendTemplate() {
          throw new Error("must not deliver invitation");
        },
      },
      config: { batchSize: 10, leaseSeconds: 30 },
      now: () => now,
    });

    const result = await dispatcher.dispatchDueBatch();
    expect(result.failed).toBe(1);
    expect(failedCode).toBe("PROVIDER_EMAIL_TEMPLATE_EXCLUDED");
  });
});

describe.skipIf(!hasDatabase)(
  "Provider email outbox persistence (T145)",
  () => {
    it("is idempotent on insert and claims with a lease", async () => {
      const context = await startProviderApplicationTestApp();
      try {
        await assertR1P05ProviderSchemaReady();
        const owner = await signupAndLogin(context.app, {
          accountCategory: "INDIVIDUAL",
          emailInbox: context.email,
          label: "outbox-owner",
        });
        const created = await request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${owner.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" })
          .expect(201);
        const providerId = created.body.data.provider.id as string;
        const repo = new PrismaProviderEmailOutboxRepository(context.prisma);
        const key = `provider:${providerId}:APPROVED:cycle:1`;
        const first = await repo.insertIntent({
          providerId,
          template: "APPROVED",
          recipientUserId: owner.userId,
          idempotencyKey: key,
          reviewCycle: 1,
          nextAttemptAt: new Date(0),
        });
        const second = await repo.insertIntent({
          providerId,
          template: "APPROVED",
          recipientUserId: owner.userId,
          idempotencyKey: key,
          reviewCycle: 1,
          nextAttemptAt: new Date(0),
        });
        expect(second.id).toBe(first.id);
        expect(
          await context.prisma.providerEmailOutbox.count({
            where: { idempotencyKey: key },
          }),
        ).toBe(1);

        const now = new Date();
        const leaseUntil = new Date(now.getTime() + 30_000);
        let claimedOurs = false;
        for (let attempt = 0; attempt < 20 && !claimedOurs; attempt += 1) {
          const claimed = await repo.claimBatch({
            now,
            batchSize: 100,
            leaseUntil,
          });
          claimedOurs = claimed.some((row) => row.id === first.id);
          if (claimed.length === 0) {
            break;
          }
        }
        expect(claimedOurs).toBe(true);
        const locked = await context.prisma.providerEmailOutbox.findUniqueOrThrow({
          where: { id: first.id },
        });
        expect(locked.status).toBe("SENDING");
        expect(locked.lockedUntil?.getTime()).toBe(leaseUntil.getTime());
      } finally {
        await context.stop();
      }
    });
  },
);
