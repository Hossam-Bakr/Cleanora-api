import { ConcurrencyBarrier } from "../../helpers/provider-concurrency.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import { assertR1P05ProviderSchemaReady } from "../../helpers/assert-r1-p05-schema.js";
import {
  signupAndLogin,
  startProviderApplicationTestApp,
} from "../../helpers/authentication/provider-application-test-app.js";

const request = require("supertest") as typeof import("supertest");

const hasDatabase = hasApprovedTestDatabaseUrl();

vi.setConfig({ testTimeout: 240_000 });

describe.skipIf(!hasDatabase)("US1 concurrent provider create (T028)", () => {
  it("allows exactly one Provider, application row, and history under concurrent create", async () => {
    const context = await startProviderApplicationTestApp({
      preferDirectMigrationUrl: true,
    });
    try {
      await assertR1P05ProviderSchemaReady();
      const session = await signupAndLogin(context.app, {
        accountCategory: "INDIVIDUAL",
        emailInbox: context.email,
        label: "us1-concurrent",
      });

      const barrier = new ConcurrencyBarrier(2);
      const runners = [0, 1].map(async () => {
        await barrier.arriveAndWait();
        return request(context.app)
          .post("/api/v1/providers")
          .set("Authorization", `Bearer ${session.accessToken}`)
          .send({ providerKind: "INDIVIDUAL_TEAM" });
      });

      const responses = await Promise.all(runners);
      const statuses = responses.map((response) => response.status).sort();
      expect(statuses).toEqual([200, 201]);
      const ids = new Set(
        responses.map((response) => response.body.data.provider.id as string),
      );
      expect(ids.size).toBe(1);
      const providerId = [...ids][0]!;

      expect(
        await context.prisma.provider.count({
          where: { applicationOwnerUserId: session.userId },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerStatusHistory.count({
          where: { providerId },
        }),
      ).toBe(1);
      expect(
        await context.prisma.providerMember.count({
          where: { providerId },
        }),
      ).toBe(0);
    } finally {
      await context.stop();
    }
  });
});
