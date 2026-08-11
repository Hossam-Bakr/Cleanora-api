import type { AuthenticationPrincipal } from "../../../../src/modules/authentication/authentication.public.js";
import { hashInvitationToken } from "../../../../src/modules/providers/domain/provider-invitation.policy.js";
import type {
  ProviderAdminInvitationRecord,
  ProviderMemberRecord,
  ProviderRecord,
} from "../../../../src/modules/providers/domain/providers.types.js";
import { ProviderMembershipService } from "../../../../src/modules/providers/provider-membership.service.js";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const SECRET = "unit-invitation-secret";

function principal(
  overrides: Partial<AuthenticationPrincipal> = {},
): AuthenticationPrincipal {
  return {
    userId: "owner-1",
    sessionId: "session-1",
    accountCategories: ["INDIVIDUAL"],
    verifiedCategories: ["INDIVIDUAL"],
    pendingCategories: [],
    status: "ACTIVE",
    verificationOnly: false,
    ...overrides,
  };
}

function provider(
  overrides: Partial<ProviderRecord> = {},
): ProviderRecord {
  return {
    id: "prov-1",
    applicationOwnerUserId: "owner-1",
    ownerUserId: "owner-1",
    kind: "INDIVIDUAL_TEAM",
    applicationStatus: "APPROVED",
    operationalStatus: "INACTIVE",
    reviewCycle: 1,
    version: 3,
    firstSubmittedAt: NOW,
    lastSubmittedAt: NOW,
    applicationChangedAt: NOW,
    operationalChangedAt: NOW,
    approvedAt: NOW,
    rejectedAt: null,
    suspendedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function invitation(
  overrides: Partial<ProviderAdminInvitationRecord> = {},
): ProviderAdminInvitationRecord {
  return {
    id: "inv-1",
    providerId: "prov-1",
    emailNormalized: "admin@example.com",
    tokenVerifier: hashInvitationToken(SECRET, "raw-token-value-32chars-xxxx"),
    tokenVersion: 1,
    status: "PENDING",
    version: 2,
    invitedByUserId: "owner-1",
    acceptedByUserId: null,
    expiresAt: new Date("2026-08-13T12:00:00.000Z"),
    sentAt: null,
    deliveryFailedAt: null,
    lastSafeDeliveryErrorCode: null,
    acceptedAt: null,
    revokedAt: null,
    expiredAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function member(
  overrides: Partial<ProviderMemberRecord> = {},
): ProviderMemberRecord {
  return {
    id: "mem-1",
    providerId: "prov-1",
    userId: "owner-1",
    level: "OWNER",
    status: "ACTIVE",
    invitedByUserId: null,
    enabledAt: NOW,
    disabledAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    "utf8",
  ).toString("base64url");
}

describe("ProviderMembershipService branch coverage (T156)", () => {
  function buildService(options: {
    readonly providerRecord?: ProviderRecord | null;
    readonly membership?: ProviderMemberRecord | null;
    readonly identity?: {
      readonly active?: boolean;
      readonly providerAdminEnabled?: boolean;
    } | null;
    readonly invitations?: ProviderAdminInvitationRecord[];
    readonly lockInvitation?: ProviderAdminInvitationRecord | null;
    readonly updateInvitation?: (
      input: Record<string, unknown>,
    ) => Promise<ProviderAdminInvitationRecord>;
    readonly findPending?: ProviderAdminInvitationRecord | null;
    readonly findByEmail?: { userId: string } | null;
    readonly findTargetMember?: ProviderMemberRecord | null;
    readonly lockProvider?: ProviderRecord | null;
    readonly listMembers?: ProviderMemberRecord[];
  }) {
    const providerRecord =
      options.providerRecord === undefined
        ? provider()
        : options.providerRecord;
    const ownership = options.membership === undefined
      ? member()
      : options.membership;
    const denialAudit = { append: vi.fn(async () => ({ id: "a1", createdAt: NOW.toISOString() })) };
    const generalAudit = { append: vi.fn(async () => ({ id: "a2", createdAt: NOW.toISOString() })) };
    const listInvitations = vi.fn(async () => options.invitations ?? []);
    const lockInvitationById = vi.fn(
      async () =>
        options.lockInvitation === undefined
          ? invitation()
          : options.lockInvitation,
    );
    const updateInvitation = vi.fn(
      async (input: Record<string, unknown>) =>
        options.updateInvitation
          ? options.updateInvitation(input)
          : invitation({
              ...invitation(),
              ...(input as Partial<ProviderAdminInvitationRecord>),
            }),
    );
    const createInvitation = vi.fn(async () => invitation());
    const bumpVersion = vi.fn(async () => provider({ version: 4 }));
    const lockById = vi.fn(
      async () =>
        options.lockProvider === undefined ? provider() : options.lockProvider,
    );
    const findMember = vi.fn(async (query: { userId: string }) => {
      if (query.userId === "owner-1") {
        return ownership;
      }
      return options.findTargetMember === undefined
        ? null
        : options.findTargetMember;
    });
    const providers = {
      findById: vi.fn(async () => providerRecord),
      findMember,
      listMembers: vi.fn(async () => options.listMembers ?? [member()]),
      listInvitations,
      lockInvitationById,
      updateInvitation,
      createInvitation,
      findPendingInvitationByEmail: vi.fn(
        async () => options.findPending ?? null,
      ),
      lockById,
      bumpVersion,
      lockAuthorityReconciliationForUser: vi.fn(async () => undefined),
      countActiveAuthorityMemberships: vi.fn(async () => 0),
      upsertMember: vi.fn(async () =>
        member({
          userId: "admin-2",
          level: "ADMIN",
          status: "DISABLED",
          disabledAt: NOW,
        }),
      ),
      updateMember: vi.fn(async () =>
        member({
          userId: "admin-2",
          level: "ADMIN",
          status: "DISABLED",
          disabledAt: NOW,
        }),
      ),
    };
    const unitOfWork = {
      run: vi.fn(async (work: (ctx: unknown) => unknown) =>
        work({
          providers,
          generalAudit,
          identityReader,
          identityAuthority: {
            reconcileProviderAdminRole: vi.fn(async () => undefined),
          },
        }),
      ),
    };
    const identityReader = {
      getEligibilityFacts: vi.fn(async () =>
        options.identity === undefined
          ? {
              active: true,
              enrolledCategories: ["INDIVIDUAL"],
              verifiedCategories: ["INDIVIDUAL"],
              emailNormalized: "owner@example.com",
              emailVerified: true,
              phoneE164: "+201012345678",
              phoneVerified: true,
              verificationOnly: false,
              providerAdminEnabled: true,
            }
          : options.identity === null
            ? null
            : {
                active: true,
                enrolledCategories: ["INDIVIDUAL"],
                verifiedCategories: ["INDIVIDUAL"],
                emailNormalized: "owner@example.com",
                emailVerified: true,
                phoneE164: "+201012345678",
                phoneVerified: true,
                verificationOnly: false,
                providerAdminEnabled: true,
                ...options.identity,
              },
      ),
      getAuthoritativeEmail: vi.fn(async () => "owner@example.com"),
      findByEmailNormalized: vi.fn(async () => options.findByEmail ?? null),
    };
    const invitationEmail = {
      deliverInvitationOnce: vi.fn(async () => "DELIVERED" as const),
    };

    const service = new ProviderMembershipService({
      unitOfWork: unitOfWork as never,
      providers: providers as never,
      identityReader: identityReader as never,
      denialAudit: denialAudit as never,
      invitationEmail: invitationEmail as never,
      invitationTokenSecret: SECRET,
      invitationTokenBytes: 32,
      invitationTtlHours: 72,
      now: () => NOW,
    });

    return {
      service,
      providers,
      unitOfWork,
      denialAudit,
      identityReader,
      invitationEmail,
    };
  }

  it("lists invitations with limit clamping, cursor decode, and nextCursor", async () => {
    const rows = [
      invitation({ id: "inv-1", createdAt: new Date("2026-08-10T10:00:00.000Z") }),
      invitation({ id: "inv-2", createdAt: new Date("2026-08-10T09:00:00.000Z") }),
      invitation({ id: "inv-3", createdAt: new Date("2026-08-10T08:00:00.000Z") }),
    ];
    const { service, providers } = buildService({ invitations: rows });
    const cursor = encodeCursor(rows[0]!.createdAt, rows[0]!.id);
    const page = await service.listInvitations({
      principal: principal(),
      providerId: "prov-1",
      cursor,
      limit: 200,
    });
    expect(providers.listInvitations).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: 101,
        cursorCreatedAt: rows[0]!.createdAt,
        cursorId: "inv-1",
      }),
    );
    expect(page.items).toHaveLength(3);
    expect(page.nextCursor).toBeNull();

    const paged = await buildService({
      invitations: [rows[0]!, rows[1]!, rows[2]!],
    }).service.listInvitations({
      principal: principal(),
      providerId: "prov-1",
      limit: 2,
    });
    expect(paged.items).toHaveLength(2);
    expect(paged.nextCursor).toEqual(expect.any(String));
  });

  it("rejects malformed invitation cursors", async () => {
    const { service } = buildService({});
    await expect(
      service.listInvitations({
        principal: principal(),
        providerId: "prov-1",
        cursor: "!!!",
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    await expect(
      service.listInvitations({
        principal: principal(),
        providerId: "prov-1",
        cursor: Buffer.from(
          JSON.stringify({ createdAt: 1, id: "x" }),
          "utf8",
        ).toString("base64url"),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("revokes invitations with idempotent, conflict, and version branches", async () => {
    const revoked = invitation({ status: "REVOKED", version: 5 });
    await expect(
      buildService({ lockInvitation: revoked }).service.revokeInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 5,
        requestId: "req-1",
      }),
    ).resolves.toMatchObject({ status: "REVOKED" });

    await expect(
      buildService({
        lockInvitation: invitation({ status: "ACCEPTED" }),
      }).service.revokeInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_CONFLICT" });

    await expect(
      buildService({
        lockInvitation: invitation({ providerId: "other" }),
      }).service.revokeInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_INVALID" });

    await expect(
      buildService({ lockInvitation: invitation({ version: 9 }) }).service.revokeInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_VERSION_CONFLICT" });

    const { service, providers } = buildService({
      lockInvitation: invitation({ status: "PENDING", version: 2 }),
      updateInvitation: async () =>
        invitation({ status: "REVOKED", version: 3, revokedAt: NOW }),
    });
    await expect(
      service.revokeInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 2,
      }),
    ).resolves.toMatchObject({ status: "REVOKED" });
    expect(providers.updateInvitation).toHaveBeenCalled();
  });

  it("denies access when provider is missing or actor has no relationship", async () => {
    await expect(
      buildService({ providerRecord: null }).service.listMembers({
        principal: principal(),
        providerId: "missing",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });

    await expect(
      buildService({
        membership: null,
        identity: null,
      }).service.listMembers({
        principal: principal({ userId: "stranger" }),
        providerId: "prov-1",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
  });

  it("denies invitation management for non-managers and audits the denial", async () => {
    const { service, denialAudit } = buildService({
      membership: member({
        userId: "member-1",
        level: "ADMIN",
        status: "DISABLED",
      }),
      identity: { providerAdminEnabled: false },
    });
    await expect(
      service.listInvitations({
        principal: principal({ userId: "member-1" }),
        providerId: "prov-1",
        requestId: "deny-1",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
    expect(denialAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "providers.invitations.list",
        requestId: "deny-1",
      }),
    );
  });

  it("blocks createInvitation when an active membership or live pending invite exists", async () => {
    await expect(
      buildService({
        findByEmail: { userId: "admin-2" },
        findTargetMember: member({
          userId: "admin-2",
          level: "ADMIN",
          status: "ACTIVE",
        }),
      }).service.createInvitation({
        principal: principal(),
        providerId: "prov-1",
        email: "Admin@Example.com",
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_INVITATION_CONFLICT",
      details: expect.objectContaining({ reason: "ACTIVE_MEMBERSHIP_EXISTS" }),
    });

    await expect(
      buildService({
        findPending: invitation({
          expiresAt: new Date("2026-08-12T12:00:00.000Z"),
        }),
      }).service.createInvitation({
        principal: principal(),
        providerId: "prov-1",
        email: "admin@example.com",
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_INVITATION_CONFLICT",
      details: expect.objectContaining({ reason: "PENDING_INVITATION_EXISTS" }),
    });
  });

  it("materializes expired pending invitations before creating a replacement", async () => {
    const expiredPending = invitation({
      expiresAt: new Date("2026-08-09T12:00:00.000Z"),
      expiredAt: null,
    });
    const { service, providers, invitationEmail } = buildService({
      findPending: expiredPending,
      lockInvitation: expiredPending,
      lockProvider: provider({ version: 3 }),
    });
    await service.createInvitation({
      principal: principal(),
      providerId: "prov-1",
      email: "admin@example.com",
      expectedVersion: 3,
      requestId: "create-1",
    });
    expect(providers.updateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ status: "EXPIRED" }),
    );
    expect(providers.createInvitation).toHaveBeenCalled();
    expect(invitationEmail.deliverInvitationOnce).toHaveBeenCalled();
  });

  it("rechecks invitation authority inside the Provider transaction", async () => {
    const { service, providers, identityReader } = buildService({});
    identityReader.getEligibilityFacts
      .mockResolvedValueOnce({
        active: true,
        enrolledCategories: ["INDIVIDUAL"],
        verifiedCategories: ["INDIVIDUAL"],
        emailNormalized: "owner@example.com",
        emailVerified: true,
        phoneE164: "+201012345678",
        phoneVerified: true,
        verificationOnly: false,
        providerAdminEnabled: true,
      })
      .mockResolvedValueOnce({
        active: false,
        enrolledCategories: ["INDIVIDUAL"],
        verifiedCategories: ["INDIVIDUAL"],
        emailNormalized: "owner@example.com",
        emailVerified: true,
        phoneE164: "+201012345678",
        phoneVerified: true,
        verificationOnly: false,
        providerAdminEnabled: true,
      });

    await expect(
      service.createInvitation({
        principal: principal(),
        providerId: "prov-1",
        email: "admin@example.com",
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });
    expect(providers.createInvitation).not.toHaveBeenCalled();
  });

  it("resends invitations and rejects conflict/version/state errors", async () => {
    const { service, providers, invitationEmail } = buildService({
      lockInvitation: invitation({ status: "PENDING", version: 2 }),
      lockProvider: provider({ version: 3 }),
      updateInvitation: async () =>
        invitation({ status: "PENDING", version: 3, tokenVersion: 2 }),
    });
    await expect(
      service.resendInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 2,
        requestId: "resend-1",
      }),
    ).resolves.toMatchObject({ deliveryState: "DELIVERED" });
    expect(providers.updateInvitation).toHaveBeenCalled();
    expect(invitationEmail.deliverInvitationOnce).toHaveBeenCalled();

    await expect(
      buildService({
        lockInvitation: invitation({ status: "ACCEPTED" }),
      }).service.resendInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_CONFLICT" });

    await expect(
      buildService({
        lockProvider: provider({ applicationStatus: "DRAFT" }),
      }).service.resendInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_STATE_CONFLICT" });

    await expect(
      buildService({
        lockInvitation: invitation({ version: 9 }),
      }).service.resendInvitation({
        principal: principal(),
        providerId: "prov-1",
        invitationId: "inv-1",
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_VERSION_CONFLICT" });
  });

  it("rejects createInvitation when provider lock is missing, not approved, or version mismatches", async () => {
    await expect(
      buildService({
        lockProvider: null,
      }).service.createInvitation({
        principal: principal(),
        providerId: "prov-1",
        email: "admin@example.com",
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_NOT_FOUND" });

    await expect(
      buildService({
        lockProvider: provider({ applicationStatus: "DRAFT", version: 3 }),
      }).service.createInvitation({
        principal: principal(),
        providerId: "prov-1",
        email: "admin@example.com",
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_STATE_CONFLICT" });

    await expect(
      buildService({
        lockProvider: provider({ version: 9 }),
      }).service.createInvitation({
        principal: principal(),
        providerId: "prov-1",
        email: "admin@example.com",
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_VERSION_CONFLICT" });
  });

  it("lists members for owners and maps authoritative emails", async () => {
    const { service, identityReader } = buildService({
      listMembers: [
        member(),
        member({ id: "mem-2", userId: "admin-2", level: "ADMIN" }),
      ],
    });
    await expect(
      service.listMembers({
        principal: principal(),
        providerId: "prov-1",
      }),
    ).resolves.toHaveLength(2);
    expect(identityReader.getAuthoritativeEmail).toHaveBeenCalled();
  });

  it("handles disableAdminMember idempotent and forbidden cases", async () => {
    await expect(
      buildService({
        findTargetMember: member({
          userId: "admin-2",
          level: "ADMIN",
          status: "DISABLED",
        }),
      }).service.disableAdminMember({
        principal: principal(),
        providerId: "prov-1",
        targetUserId: "admin-2",
        expectedVersion: 3,
      }),
    ).resolves.toMatchObject({ status: "DISABLED" });

    await expect(
      buildService({
        findTargetMember: member({
          userId: "owner-1",
          level: "OWNER",
          status: "ACTIVE",
        }),
      }).service.disableAdminMember({
        principal: principal(),
        providerId: "prov-1",
        targetUserId: "owner-1",
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_ACCESS_DENIED" });
  });
});
