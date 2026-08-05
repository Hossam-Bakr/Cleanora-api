import { seed } from "../../../prisma/seed.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import {
  createRoleManagementFixture,
  readAuditRows,
  readGrantStatus,
} from "../../helpers/authorization/role-management-integration.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";

const hasDatabase = hasApprovedTestDatabaseUrl();

/** Audit writer that always fails, to prove the mutation rolls back with it. */
const failingAuditWriterFactory = () => ({
  async append(): Promise<never> {
    throw new Error("forced audit append failure");
  },
});

describe.skipIf(!hasDatabase)("privileged audit rollback", () => {
  let database: PrismaLifecycle;

  // Seeding the remote test database takes longer than the default hook timeout.
  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await seed();
  }, 180_000);

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "rolls back a would-be successful assignment when the audit append fails",
    async () => {
      const fixture = await createRoleManagementFixture({
        auditWriterFactory: failingAuditWriterFactory,
      });

      await expect(
        fixture.service.assignRole({
          actor: fixture.actorPrincipal,
          targetUserId: fixture.targetUserId,
          roleCode: "customer",
          reasonCode: "role_grant_assign",
        }),
      ).rejects.toThrow(/forced audit append failure/u);

      expect(
        await readGrantStatus(fixture.targetUserId, "customer"),
      ).toBeUndefined();
      expect(
        await readAuditRows("identity.roles.assign", fixture.targetUserId),
      ).toHaveLength(0);
    },
    120_000,
  );

  it(
    "rolls back a status change when the audit append fails after the update",
    async () => {
      const working = await createRoleManagementFixture();
      const command = {
        actor: working.actorPrincipal,
        targetUserId: working.targetUserId,
        roleCode: "customer",
      };
      await working.service.assignRole({
        ...command,
        reasonCode: "role_grant_assign",
      });

      const failing = await createRoleManagementFixture({
        auditWriterFactory: failingAuditWriterFactory,
      });

      await expect(
        failing.service.disableRole({
          actor: failing.actorPrincipal,
          targetUserId: working.targetUserId,
          roleCode: "customer",
          reasonCode: "role_grant_disable",
        }),
      ).rejects.toThrow(/forced audit append failure/u);

      expect(await readGrantStatus(working.targetUserId, "customer")).toBe(
        "ENABLED",
      );
      expect(
        await readAuditRows("identity.roles.disable", working.targetUserId),
      ).toHaveLength(0);
    },
    120_000,
  );

  it(
    "keeps a reason-validated privileged write atomic (US6 coverage)",
    async () => {
      const fixture = await createRoleManagementFixture({
        auditWriterFactory: failingAuditWriterFactory,
      });

      await expect(
        fixture.service.assignRole({
          actor: fixture.actorPrincipal,
          targetUserId: fixture.targetUserId,
          roleCode: "worker",
          reasonCode: "role_grant_assign",
        }),
      ).rejects.toThrow(/forced audit append failure/u);
      expect(
        await readGrantStatus(fixture.targetUserId, "worker"),
      ).toBeUndefined();

      await expect(
        fixture.service.assignRole({
          actor: fixture.actorPrincipal,
          targetUserId: fixture.targetUserId,
          roleCode: "worker",
          reasonCode: "role_grant_revoke",
        }),
      ).rejects.toMatchObject({ code: "AUTHZ_REASON_INVALID" });
      expect(
        await readGrantStatus(fixture.targetUserId, "worker"),
      ).toBeUndefined();
    },
    120_000,
  );
});
