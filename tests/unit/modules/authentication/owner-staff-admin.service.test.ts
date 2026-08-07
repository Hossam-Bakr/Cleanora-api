import type { SafePrivilegedAuditInput } from "#modules/admin/audit.service";
import type { RoleGrantRecord } from "#modules/authentication/domain/authorization.ports";
import {
  OWNER_STAFF_ADMIN_ROLE,
  OwnerStaffAdminProvisionService,
  ownerAdminSecretMatches,
  type OwnerProvisionTarget,
  type OwnerStaffAdminUnitOfWork,
  type OwnerStaffAdminUnitOfWorkContext,
} from "#modules/authentication/owner-staff-admin.service";
import { AppError } from "#shared/errors/app-error";

const STAFF_ADMIN_ROLE_ID = "role-staff_admin";
const TARGET_USER_ID = "target-user-1";
const TARGET_EMAIL = "owner-provision@example.test";
const VALID_SECRET = "test-owner-secret-that-is-at-least-32-chars";

interface FakeOwnerWorldOptions {
  readonly enabled?: boolean;
  readonly secret?: string;
  readonly target?: OwnerProvisionTarget | null;
  readonly existingGrant?: RoleGrantRecord | null;
  readonly failAuditAppend?: boolean;
}

interface FakeOwnerWorld {
  readonly service: OwnerStaffAdminProvisionService;
  readonly auditAppends: SafePrivilegedAuditInput[];
  readonly grantCreates: number;
  readonly grantTransitions: number;
}

function baseGrant(overrides: Partial<RoleGrantRecord> = {}): RoleGrantRecord {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: "grant-1",
    userId: TARGET_USER_ID,
    roleId: STAFF_ADMIN_ROLE_ID,
    status: "ENABLED",
    assignedAt: now,
    enabledAt: now,
    disabledAt: null,
    revokedAt: null,
    ...overrides,
  };
}

function activeVerifiedTarget(): OwnerProvisionTarget {
  return {
    userId: TARGET_USER_ID,
    status: "ACTIVE",
    emailVerified: true,
  };
}

function createFakeOwnerWorld(
  options: FakeOwnerWorldOptions = {},
): FakeOwnerWorld {
  const auditAppends: SafePrivilegedAuditInput[] = [];
  let grantCreates = 0;
  let grantTransitions = 0;
  let existingGrant = options.existingGrant ?? null;

  const unitOfWork: OwnerStaffAdminUnitOfWork = {
    async run(work) {
      const context: OwnerStaffAdminUnitOfWorkContext = {
        findTargetByEmail: async (emailNormalized) => {
          if (emailNormalized !== TARGET_EMAIL) {
            return null;
          }
          return options.target === undefined
            ? activeVerifiedTarget()
            : options.target;
        },
        roles: {
          async findByCode(code) {
            return code === OWNER_STAFF_ADMIN_ROLE
              ? {
                  id: STAFF_ADMIN_ROLE_ID,
                  code: OWNER_STAFF_ADMIN_ROLE,
                  name: "Staff Admin",
                }
              : null;
          },
        },
        grants: {
          async findByUserAndRole(userId, roleId) {
            if (
              userId !== TARGET_USER_ID ||
              roleId !== STAFF_ADMIN_ROLE_ID ||
              existingGrant === null
            ) {
              return null;
            }
            return existingGrant;
          },
          async createEnabledGrant({ userId, roleId }) {
            grantCreates += 1;
            const created = baseGrant({
              id: `grant-${grantCreates}`,
              userId,
              roleId,
              status: "ENABLED",
            });
            existingGrant = created;
            return created;
          },
          async applyStatusTransition({ grantId, nextStatus }) {
            grantTransitions += 1;
            if (existingGrant === null || existingGrant.id !== grantId) {
              throw new Error(`unknown grant ${grantId}`);
            }
            const updated = baseGrant({
              ...existingGrant,
              status: nextStatus,
              enabledAt: new Date(),
              disabledAt: null,
              revokedAt: null,
            });
            existingGrant = updated;
            return updated;
          },
          async findEnabledRolesAndPermissions() {
            return { roleCodes: [], permissionCodes: [] };
          },
        },
        audit: {
          async append(input) {
            if (options.failAuditAppend === true) {
              throw new Error("audit append failed");
            }
            auditAppends.push(input);
            return {
              id: `audit-${auditAppends.length}`,
              createdAt: new Date().toISOString(),
            };
          },
        },
      };
      return work(context);
    },
  };

  const service = new OwnerStaffAdminProvisionService(
    {
      enabled: options.enabled ?? true,
      secret: options.secret ?? VALID_SECRET,
    },
    unitOfWork,
  );

  return {
    service,
    get auditAppends() {
      return auditAppends;
    },
    get grantCreates() {
      return grantCreates;
    },
    get grantTransitions() {
      return grantTransitions;
    },
  };
}

function provision(service: OwnerStaffAdminProvisionService, secret?: string) {
  return service.provision({
    email: TARGET_EMAIL,
    presentedSecret: secret ?? VALID_SECRET,
    requestId: "req-owner-provision",
  });
}

describe("ownerAdminSecretMatches", () => {
  it("returns false when either secret is missing", () => {
    expect(ownerAdminSecretMatches(undefined, VALID_SECRET)).toBe(false);
    expect(ownerAdminSecretMatches(VALID_SECRET, undefined)).toBe(false);
  });

  it("uses timing-safe length checks before comparing values", () => {
    expect(ownerAdminSecretMatches("short", VALID_SECRET)).toBe(false);
    expect(ownerAdminSecretMatches(VALID_SECRET, VALID_SECRET)).toBe(true);
  });
});

describe("OwnerStaffAdminProvisionService", () => {
  it("rejects when the owner API is disabled", async () => {
    const world = createFakeOwnerWorld({ enabled: false });

    await expect(provision(world.service)).rejects.toMatchObject({
      code: "OWNER_STAFF_ADMIN_REJECTED",
      statusCode: 403,
    });
  });

  it("rejects missing or wrong secrets before touching the unit of work", async () => {
    const world = createFakeOwnerWorld();

    await expect(
      world.service.provision({
        email: TARGET_EMAIL,
        presentedSecret: undefined,
      }),
    ).rejects.toMatchObject({ code: "OWNER_STAFF_ADMIN_REJECTED" });
    await expect(
      world.service.provision({
        email: TARGET_EMAIL,
        presentedSecret: "wrong-secret-that-is-still-32-characters",
      }),
    ).rejects.toMatchObject({ code: "OWNER_STAFF_ADMIN_REJECTED" });
    expect(world.grantCreates).toBe(0);
    expect(world.auditAppends).toHaveLength(0);
  });

  it("creates an ENABLED staff_admin grant for an active verified target", async () => {
    const world = createFakeOwnerWorld();

    const result = await provision(world.service);

    expect(result).toMatchObject({
      outcome: "CREATED",
      targetUserId: TARGET_USER_ID,
      roleCode: "staff_admin",
      grantStatus: "ENABLED",
    });
    expect(world.grantCreates).toBe(1);
    expect(world.auditAppends).toHaveLength(1);
    expect(world.auditAppends[0]).toMatchObject({
      action: "identity.roles.owner_provision_staff_admin",
      reason: "owner_staff_admin_provision",
      targetType: "user_role",
    });
  });

  it("re-enables a disabled grant and audits the transition", async () => {
    const world = createFakeOwnerWorld({
      existingGrant: baseGrant({ status: "DISABLED", enabledAt: null }),
    });

    const result = await provision(world.service);

    expect(result.outcome).toBe("RE_ENABLED");
    expect(world.grantTransitions).toBe(1);
    expect(world.grantCreates).toBe(0);
    expect(world.auditAppends).toHaveLength(1);
  });

  it("returns ALREADY_ENABLED without appending audit evidence", async () => {
    const world = createFakeOwnerWorld({
      existingGrant: baseGrant({ status: "ENABLED" }),
    });

    const result = await provision(world.service);

    expect(result).toMatchObject({
      outcome: "ALREADY_ENABLED",
      grantStatus: "ENABLED",
    });
    expect(world.grantCreates).toBe(0);
    expect(world.grantTransitions).toBe(0);
    expect(world.auditAppends).toHaveLength(0);
  });

  it.each([
    ["missing target", null],
    ["inactive target", { userId: TARGET_USER_ID, status: "SUSPENDED" as const, emailVerified: true }],
    ["unverified target", { userId: TARGET_USER_ID, status: "ACTIVE" as const, emailVerified: false }],
  ])("rejects a %s without creating a grant", async (_label, target) => {
    const world = createFakeOwnerWorld({ target });

    await expect(provision(world.service)).rejects.toBeInstanceOf(AppError);
    expect(world.grantCreates).toBe(0);
    expect(world.grantTransitions).toBe(0);
    expect(world.auditAppends).toHaveLength(0);
  });

  it("propagates audit append failures to the caller", async () => {
    const world = createFakeOwnerWorld({ failAuditAppend: true });

    await expect(provision(world.service)).rejects.toThrow("audit append failed");
    expect(world.grantCreates).toBe(1);
    expect(world.auditAppends).toHaveLength(0);
  });
});
