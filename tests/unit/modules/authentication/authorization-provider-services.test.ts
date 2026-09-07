import type {
  ProviderServiceStaffPermissionCode,
  TransactionalProviderServiceStaffAuthorizer,
  TransactionalProviderServiceStaffAuthorizerFactory,
} from "../../../../src/modules/authentication/authentication.public.js";
import {
  AUTHORIZATION_PERMISSIONS,
  PROTECTED_OPERATIONS,
  ROLE_PERMISSION_MAP,
  findProtectedOperation,
} from "../../../../src/modules/authentication/domain/authorization.catalog.js";
import { PrismaProviderServiceStaffAuthorizer } from "../../../../src/modules/authentication/infrastructure/prisma-r1-p06-security.adapters.js";

const APPROVE_PERMISSION = "providers.services.prices.approve" as const;

describe("R1-P09 provider service price approval authorization (T008)", () => {
  it("declares providers.services.prices.approve exactly once in AUTHORIZATION_PERMISSIONS", () => {
    const matches = AUTHORIZATION_PERMISSIONS.filter(
      (permission) => permission.code === APPROVE_PERMISSION,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.name.trim().length).toBeGreaterThan(0);
  });

  it("maps the approve permission only to active staff_admin", () => {
    const holders = Object.entries(ROLE_PERMISSION_MAP)
      .filter(([, codes]) => codes.includes(APPROVE_PERMISSION))
      .map(([roleCode]) => roleCode);
    expect(holders).toEqual(["staff_admin"]);
  });

  it("declares a matching PROTECTED_OPERATIONS entry", () => {
    const matches = PROTECTED_OPERATIONS.filter(
      (operation) => operation.operationId === APPROVE_PERMISSION,
    );
    expect(matches).toHaveLength(1);
    expect(findProtectedOperation(APPROVE_PERMISSION)).toEqual({
      operationId: APPROVE_PERMISSION,
      permissionCode: APPROVE_PERMISSION,
      ownership: "NONE",
      scope: "GLOBAL",
      privileged: false,
      publicHttp: false,
    });
  });

  it("exports TransactionalProviderServiceStaffAuthorizer types from authentication.public", () => {
    const permission: ProviderServiceStaffPermissionCode = APPROVE_PERMISSION;
    expect(permission).toBe(APPROVE_PERMISSION);

    const authorizer: TransactionalProviderServiceStaffAuthorizer = {
      authorize: async () => true,
    };
    expect(typeof authorizer.authorize).toBe("function");

    const factory: TransactionalProviderServiceStaffAuthorizerFactory = () =>
      authorizer;
    expect(typeof factory).toBe("function");
  });

  it("authorizes providers.services.prices.approve through PrismaProviderServiceStaffAuthorizer", async () => {
    const calls: Array<{ actorUserId: string; permission: string }> = [];
    const fakeDb = {
      userRole: {
        findFirst: async (args: {
          readonly where: {
            readonly userId: string;
            readonly role: {
              readonly rolePermissions: {
                readonly some: { readonly permission: { readonly code: string } };
              };
            };
          };
        }) => {
          calls.push({
            actorUserId: args.where.userId,
            permission: args.where.role.rolePermissions.some.permission.code,
          });
          return args.where.role.rolePermissions.some.permission.code ===
            APPROVE_PERMISSION && args.where.userId === "staff-admin-r1p09"
            ? { id: "grant-1" }
            : null;
        },
      },
    };

    const authorizer = new PrismaProviderServiceStaffAuthorizer(
      fakeDb as never,
    );

    await expect(
      authorizer.authorize("staff-admin-r1p09", APPROVE_PERMISSION),
    ).resolves.toBe(true);
    await expect(
      authorizer.authorize("other-user", APPROVE_PERMISSION),
    ).resolves.toBe(false);

    expect(calls).toEqual([
      { actorUserId: "staff-admin-r1p09", permission: APPROVE_PERMISSION },
      { actorUserId: "other-user", permission: APPROVE_PERMISSION },
    ]);
  });
});
