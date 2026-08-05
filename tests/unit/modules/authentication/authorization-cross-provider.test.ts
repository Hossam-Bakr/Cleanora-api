import { AuthorizationService } from "../../../../src/modules/authentication/authorization.service.js";
import {
  createGrantReaderForEnabledRoles,
  createTestPrincipal,
} from "../../../helpers/authorization/authorization-fixtures.js";

function serviceForRole(roleCode: string): AuthorizationService {
  return new AuthorizationService(
    createGrantReaderForEnabledRoles({ "actor-1": [roleCode] }),
  );
}

const providerScopePermissions = [
  { roleCode: "provider_member", permissionCode: "authz.scope.provider.member" },
  {
    roleCode: "provider_supervisor",
    permissionCode: "authz.scope.provider.supervisor",
  },
  { roleCode: "provider_admin", permissionCode: "authz.scope.provider.admin" },
];

describe("cross-provider denial", () => {
  it.each(providerScopePermissions)(
    "denies a $roleCode acting inside another provider",
    async ({ roleCode, permissionCode }) => {
      await expect(
        serviceForRole(roleCode).authorize({
          principal: createTestPrincipal(),
          permissionCode,
          scope: {
            kind: "PROVIDER",
            requestedProviderId: "provider-other",
            memberProviderId: "provider-own",
          },
        }),
      ).resolves.toEqual({ allowed: false, denialCode: "SCOPE_DENIED" });
    },
  );

  it.each(providerScopePermissions)(
    "allows a $roleCode acting inside their own provider",
    async ({ roleCode, permissionCode }) => {
      await expect(
        serviceForRole(roleCode).authorize({
          principal: createTestPrincipal(),
          permissionCode,
          scope: {
            kind: "PROVIDER",
            requestedProviderId: "provider-own",
            memberProviderId: "provider-own",
          },
        }),
      ).resolves.toEqual({ allowed: true });
    },
  );

  it("does not let a provider role act in a worker scope", async () => {
    const decision = await serviceForRole("provider_admin").authorize({
      principal: createTestPrincipal(),
      permissionCode: "authz.scope.worker",
      scope: {
        kind: "WORKER",
        requestedWorkerUserId: "actor-1",
        workerRecordUserId: "actor-1",
      },
    });

    expect(decision.denialCode).toBe("PERMISSION_DENIED");
  });
});
