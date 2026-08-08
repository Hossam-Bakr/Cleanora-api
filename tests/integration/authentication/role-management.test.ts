import { seed } from "../../../prisma/seed.js";
import { getPrismaClient } from "../../../src/database/prisma.js";
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

describe.skipIf(!hasDatabase)("role management against the database", () => {
  let database: PrismaLifecycle;

  // Seeding the remote test database takes longer than the default hook timeout.
  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await seed(getPrismaClient());
  }, 180_000);

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "appends audit evidence for a real assignment and nothing for the repeat call",
    async () => {
      const fixture = await createRoleManagementFixture();

      const assigned = await fixture.service.assignRole({
        actor: fixture.actorPrincipal,
        targetUserId: fixture.targetUserId,
        roleCode: "customer",
        reasonCode: "role_grant_assign",
        requestId: "integration-assign",
      });

      expect(assigned).toMatchObject({
        status: "ENABLED",
        mutated: true,
        auditAppended: true,
      });
      expect(await readGrantStatus(fixture.targetUserId, "customer")).toBe(
        "ENABLED",
      );

      const auditAfterMutation = await readAuditRows(
        "identity.roles.assign",
        fixture.targetUserId,
      );
      expect(auditAfterMutation).toHaveLength(1);
      expect(auditAfterMutation[0]).toMatchObject({
        targetType: "user_role",
        reason: "role_grant_assign",
        actorId: fixture.actorPrincipal.userId,
      });

      const repeated = await fixture.service.assignRole({
        actor: fixture.actorPrincipal,
        targetUserId: fixture.targetUserId,
        roleCode: "customer",
        reasonCode: "role_grant_assign",
      });

      expect(repeated).toMatchObject({
        mutated: false,
        auditAppended: false,
      });
      expect(
        await readAuditRows("identity.roles.assign", fixture.targetUserId),
      ).toHaveLength(1);
    },
    120_000,
  );

  it(
    "walks disable, enable, and revoke and audits only the real mutations",
    async () => {
      const fixture = await createRoleManagementFixture();
      const command = {
        actor: fixture.actorPrincipal,
        targetUserId: fixture.targetUserId,
        roleCode: "customer",
      };

      await fixture.service.assignRole({
        ...command,
        reasonCode: "role_grant_assign",
      });
      await fixture.service.disableRole({
        ...command,
        reasonCode: "role_grant_disable",
      });
      const disabledNoop = await fixture.service.disableRole({
        ...command,
        reasonCode: "role_grant_disable",
      });
      await fixture.service.enableRole({
        ...command,
        reasonCode: "role_grant_enable",
      });
      await fixture.service.revokeRole({
        ...command,
        reasonCode: "role_grant_revoke",
      });

      expect(disabledNoop.mutated).toBe(false);
      expect(await readGrantStatus(fixture.targetUserId, "customer")).toBe(
        "REVOKED",
      );
      expect(
        await readAuditRows("identity.roles.disable", fixture.targetUserId),
      ).toHaveLength(1);
      expect(
        await readAuditRows("identity.roles.enable", fixture.targetUserId),
      ).toHaveLength(1);
      expect(
        await readAuditRows("identity.roles.revoke", fixture.targetUserId),
      ).toHaveLength(1);
    },
    120_000,
  );

  it(
    "rejects an illegal transition without touching the stored grant",
    async () => {
      const fixture = await createRoleManagementFixture();
      const command = {
        actor: fixture.actorPrincipal,
        targetUserId: fixture.targetUserId,
        roleCode: "customer",
      };

      await fixture.service.assignRole({
        ...command,
        reasonCode: "role_grant_assign",
      });
      await fixture.service.disableRole({
        ...command,
        reasonCode: "role_grant_disable",
      });

      await expect(
        fixture.service.assignRole({
          ...command,
          reasonCode: "role_grant_assign",
        }),
      ).rejects.toMatchObject({ code: "AUTHZ_ROLE_TRANSITION_INVALID" });
      expect(await readGrantStatus(fixture.targetUserId, "customer")).toBe(
        "DISABLED",
      );
    },
    120_000,
  );
});
