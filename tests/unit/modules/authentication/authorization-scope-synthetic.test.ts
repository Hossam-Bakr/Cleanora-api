import {
  isScopeFactSatisfied,
  isScopeRuleSatisfied,
} from "../../../../src/modules/authentication/authorization.policy.js";
import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

/**
 * Provider and worker records do not exist in R1-P03, so these tests supply
 * synthetic scope facts to prove the rules without creating any new table.
 */
describe("synthetic provider and worker scope matrix", () => {
  it("allows a provider member acting inside the provider they belong to", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["provider_member"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "authz.scope.provider.member",
        scope: {
          kind: "PROVIDER",
          requestedProviderId: "provider-1",
          memberProviderId: "provider-1",
        },
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("allows a worker acting inside their own worker scope", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["worker"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "authz.scope.worker",
        scope: {
          kind: "WORKER",
          requestedWorkerUserId: "actor-1",
          workerRecordUserId: "actor-1",
        },
      }),
    ).resolves.toEqual({ allowed: true });
  });

  it("denies a worker acting on another worker's scope", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["worker"] }),
    );

    await expect(
      service.authorize({
        principal: createTestPrincipal(),
        permissionCode: "authz.scope.worker",
        scope: {
          kind: "WORKER",
          requestedWorkerUserId: "worker-9",
          workerRecordUserId: "actor-1",
        },
      }),
    ).resolves.toEqual({ allowed: false, denialCode: "SCOPE_DENIED" });
  });

  it("denies a provider supervisor without the supervisor permission", async () => {
    const service = new AuthorizationService(
      createGrantReaderForEnabledRoles({ "actor-1": ["provider_member"] }),
    );

    const decision = await service.authorize({
      principal: createTestPrincipal(),
      permissionCode: "authz.scope.provider.supervisor",
      scope: {
        kind: "PROVIDER",
        requestedProviderId: "provider-1",
        memberProviderId: "provider-1",
      },
    });

    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });

  it("evaluates scope facts directly", () => {
    expect(isScopeFactSatisfied({ kind: "GLOBAL" })).toBe(true);
    expect(
      isScopeFactSatisfied({
        kind: "PROVIDER",
        requestedProviderId: "provider-1",
        memberProviderId: "provider-1",
      }),
    ).toBe(true);
    expect(
      isScopeFactSatisfied({
        kind: "WORKER",
        requestedWorkerUserId: "worker-1",
        workerRecordUserId: "worker-2",
      }),
    ).toBe(false);
  });

  it("requires a matching fact kind for a declared scope rule", () => {
    expect(isScopeRuleSatisfied("NONE", undefined)).toBe(true);
    expect(isScopeRuleSatisfied("GLOBAL", undefined)).toBe(true);
    expect(isScopeRuleSatisfied("PROVIDER", undefined)).toBe(false);
    expect(
      isScopeRuleSatisfied("PROVIDER", {
        kind: "WORKER",
        requestedWorkerUserId: "worker-1",
        workerRecordUserId: "worker-1",
      }),
    ).toBe(false);
    expect(
      isScopeRuleSatisfied("WORKER", {
        kind: "WORKER",
        requestedWorkerUserId: "worker-1",
        workerRecordUserId: "worker-1",
      }),
    ).toBe(true);
  });
});
