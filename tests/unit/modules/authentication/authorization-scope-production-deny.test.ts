import { isScopeFactSatisfied } from "../../../../src/modules/authentication/authorization.policy.js";
import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

/**
 * A production caller cannot supply `memberProviderId` or `workerRecordUserId`
 * because provider membership and worker records do not exist yet. Every such
 * scope decision must deny.
 */
describe("production denial without real scope records", () => {
  it("denies provider scope when no membership record backs the request", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["provider_admin"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "authz.scope.provider.admin",
        scope: { kind: "PROVIDER", requestedProviderId: "provider-1" },
      }),
    ).resolves.toEqual({ allowed: false, denialCode: "SCOPE_DENIED" });
  });

  it("denies worker scope when no worker record backs the request", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["worker"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "authz.scope.worker",
        scope: { kind: "WORKER", requestedWorkerUserId: "actor-1" },
      }),
    ).resolves.toEqual({ allowed: false, denialCode: "SCOPE_DENIED" });
  });

  it("treats a scope fact without a backing record as unsatisfied", () => {
    expect(
      isScopeFactSatisfied({
        kind: "PROVIDER",
        requestedProviderId: "provider-1",
      }),
    ).toBe(false);
    expect(
      isScopeFactSatisfied({
        kind: "WORKER",
        requestedWorkerUserId: "worker-1",
      }),
    ).toBe(false);
  });

  it("still allows a GLOBAL scope, which needs no provider or worker record", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["staff_admin"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "authz.roles.assign",
        scope: { kind: "GLOBAL" },
      }),
    ).resolves.toEqual({ allowed: true });
  });
});
