import { seed } from "../../../prisma/seed.js";
import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { AuthorizationService } from "../../../src/modules/authentication/authorization.service.js";
import { AuthorizationRepository } from "../../../src/modules/authentication/infrastructure/authorization.repository.js";
import { createRoleManagementFixture } from "../../helpers/authorization/role-management-integration.js";
import { hasApprovedTestDatabaseUrl } from "../../helpers/resolve-test-database-url.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";

const hasDatabase = hasApprovedTestDatabaseUrl();

describe.skipIf(!hasDatabase)("authorization freshness after a real mutation", () => {
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
    "denies the target immediately after their grant is disabled and then revoked",
    async () => {
      const fixture = await createRoleManagementFixture();
      const authorization = new AuthorizationService(
        new AuthorizationRepository(),
      );
      const targetPrincipal = {
        ...fixture.actorPrincipal,
        userId: fixture.targetUserId,
      };
      const command = {
        actor: fixture.actorPrincipal,
        targetUserId: fixture.targetUserId,
        roleCode: "customer",
      };

      await fixture.service.assignRole({
        ...command,
        reasonCode: "role_grant_assign",
      });
      await expect(
        authorization.authorize({
          principal: targetPrincipal,
          permissionCode: "resource.self.read",
        }),
      ).resolves.toEqual({ allowed: true });

      await fixture.service.disableRole({
        ...command,
        reasonCode: "role_grant_disable",
      });
      await expect(
        authorization.authorize({
          principal: targetPrincipal,
          permissionCode: "resource.self.read",
        }),
      ).resolves.toEqual({ allowed: false, denialCode: "PERMISSION_DENIED" });

      await fixture.service.enableRole({
        ...command,
        reasonCode: "role_grant_enable",
      });
      await expect(
        authorization.effectivePermissions(targetPrincipal),
      ).resolves.toMatchObject({ roleCodes: ["customer"] });

      await fixture.service.revokeRole({
        ...command,
        reasonCode: "role_grant_revoke",
      });
      await expect(
        authorization.effectivePermissions(targetPrincipal),
      ).resolves.toEqual({ roleCodes: [], permissionCodes: [] });
    },
    180_000,
  );
});
