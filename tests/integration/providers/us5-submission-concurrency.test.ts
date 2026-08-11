import { ConcurrencyBarrier } from "../../helpers/provider-concurrency.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import { seedCompleteProviderApplicationContent } from "../../helpers/provider-fixtures.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 120_000 });

describe.skipIf(!hasDatabase)("US5 concurrent submission (T065)", () => {
  it("accepts one cycle/history/outbox intent under concurrent submit", async () => {
    const context = await startProviderApplicationTestApp();
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us5-concurrent",
      });

      const created = await request(context.app)
        .post("/api/v1/providers")
        .set("Authorization", `Bearer ${session.accessToken}`)
        .send({ providerKind: "INDIVIDUAL_TEAM" })
        .expect(201);
      const providerId = created.body.data.provider.id as string;
      const version = created.body.data.provider.version as number;

      await seedCompleteProviderApplicationContent(context.prisma, {
        providerId,
        ownerUserId: session.userId,
        emailNormalized: session.identity.email,
        phoneE164: session.identity.phone,
      });

      const barrier = new ConcurrencyBarrier(2);
      const runners = [0, 1].map(async () => {
        await barrier.arriveAndWait();
        return request(context.app)
          .post(`/api/v1/providers/${providerId}/application/submit`)
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ expectedVersion: version });
      });

      const responses = await Promise.all(runners);
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body.data.provider.applicationStatus).toBe(
          "PENDING_REVIEW",
        );
      }

      const provider = await context.prisma.provider.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(provider.reviewCycle).toBe(1);
      expect(provider.applicationStatus).toBe("PENDING_REVIEW");

      expect(
        await context.prisma.providerStatusHistory.count({
          where: {
            providerId,
            toApplicationStatus: "PENDING_REVIEW",
            reviewCycle: 1,
          },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerEmailOutbox.count({
          where: {
            providerId,
            template: "APPLICATION_SUBMITTED",
            reviewCycle: 1,
          },
        }),
      ).toBe(1);
    } finally {
      await context.stop();
    }
  });
});
