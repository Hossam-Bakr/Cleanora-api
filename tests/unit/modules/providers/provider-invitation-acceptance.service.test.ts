import type { AuthenticationPrincipal } from "../../../../src/modules/authentication/authentication.public.js";
import { hashInvitationToken } from "../../../../src/modules/providers/domain/provider-invitation.policy.js";
import type {
  ProviderAdminInvitationRecord,
  ProviderRecord,
} from "../../../../src/modules/providers/domain/providers.types.js";
import { ProviderInvitationAcceptanceService } from "../../../../src/modules/providers/provider-invitation-acceptance.service.js";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const SECRET = "accept-secret";
const RAW = "a".repeat(43);

function principal(
  overrides: Partial<AuthenticationPrincipal> = {},
): AuthenticationPrincipal {
  return {
    userId: "admin-1",
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
    version: 1,
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
    tokenVerifier: hashInvitationToken(SECRET, RAW),
    tokenVersion: 1,
    status: "PENDING",
    version: 1,
    invitedByUserId: "owner-1",
    acceptedByUserId: null,
    expiresAt: new Date("2026-08-13T12:00:00.000Z"),
    sentAt: NOW,
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

describe("ProviderInvitationAcceptanceService branch coverage (T156)", () => {
  function build(options: {
    readonly invitation?: ProviderAdminInvitationRecord | null;
    readonly provider?: ProviderRecord | null;
    readonly existingEmail?: {
      readonly userId: string;
      readonly emailNormalized: string;
      readonly emailVerified: boolean;
      readonly accountActive: boolean;
      readonly active: boolean;
    } | null;
    readonly identity?: {
      readonly accountActive?: boolean;
      readonly active?: boolean;
      readonly emailNormalized: string | null;
      readonly emailVerified: boolean;
    } | null;
    readonly transactionIdentity?: {
      readonly accountActive?: boolean;
      readonly active?: boolean;
      readonly emailNormalized: string | null;
      readonly emailVerified: boolean;
    } | null;
    readonly lockInvitation?: ProviderAdminInvitationRecord | null;
    readonly priorMember?: { level: "OWNER" | "ADMIN"; status: "ACTIVE" | "DISABLED" } | null;
  }) {
    const inv =
      options.invitation === undefined ? invitation() : options.invitation;
    const denialAudit = { append: vi.fn(async () => ({ id: "a", createdAt: NOW.toISOString() })) };
    const updateInvitation = vi.fn(async () =>
      invitation({
        status: "ACCEPTED",
        acceptedByUserId: "admin-1",
        acceptedAt: NOW,
      }),
    );
    const providers = {
      findById: vi.fn(async () =>
        options.provider === undefined ? provider() : options.provider,
      ),
      getProfile: vi.fn(async () => ({
        id: "prof-1",
        providerId: "prov-1",
        displayNameAr: "اسم",
        displayNameEn: "Name",
        descriptionAr: null,
        descriptionEn: null,
        countryId: null,
        logoMediaFileId: null,
        coverMediaFileId: null,
        createdAt: NOW,
        updatedAt: NOW,
      })),
      findInvitationByTokenVerifier: vi.fn(async () => inv),
      lockById: vi.fn(async () =>
        options.provider === undefined ? provider() : options.provider,
      ),
      lockInvitationById: vi.fn(async () =>
        options.lockInvitation === undefined ? inv : options.lockInvitation,
      ),
      updateInvitation,
      findMember: vi.fn(async () => options.priorMember ?? null),
      upsertMember: vi.fn(async () => ({})),
      countActiveAuthorityMemberships: vi.fn(async () => 1),
      lockAuthorityReconciliationForUser: vi.fn(async () => undefined),
    };
    const identityFacts = (
      value:
        | {
            readonly accountActive?: boolean;
            readonly active?: boolean;
            readonly emailNormalized: string | null;
            readonly emailVerified: boolean;
          }
        | null
        | undefined,
    ) =>
      value === null
        ? null
        : {
            accountActive: true,
            active: true,
            verificationOnly: false,
            enrolledCategories: ["INDIVIDUAL"],
            verifiedCategories: ["INDIVIDUAL"],
            emailNormalized: "admin@example.com",
            emailVerified: true,
            phoneE164: null,
            phoneVerified: false,
            providerAdminEnabled: false,
            ...(value ?? {}),
          };
    const identityReader = {
      findByEmailNormalized: vi.fn(async () =>
        options.existingEmail === undefined
          ? {
              userId: "admin-1",
              emailNormalized: "admin@example.com",
              emailVerified: true,
              accountActive: true,
              active: true,
            }
          : options.existingEmail,
      ),
      getEligibilityFacts: vi.fn(async () => identityFacts(options.identity)),
      getAuthoritativeEmail: vi.fn(async () => "admin@example.com"),
    };
    const transactionIdentityReader = {
      getEligibilityFacts: vi.fn(async () =>
        identityFacts(
          options.transactionIdentity === undefined
            ? options.identity
            : options.transactionIdentity,
        ),
      ),
    };
    const unitOfWork = {
      run: vi.fn(async (work: (ctx: unknown) => unknown) =>
        work({
          providers,
          identityReader: transactionIdentityReader,
          identityAuthority: {
            reconcileProviderAdminRole: vi.fn(async () => undefined),
          },
          generalAudit: { append: vi.fn(async () => ({ id: "g", createdAt: NOW.toISOString() })) },
        }),
      ),
    };
    return {
      service: new ProviderInvitationAcceptanceService({
        unitOfWork: unitOfWork as never,
        providers: providers as never,
        identityReader: identityReader as never,
        denialAudit: denialAudit as never,
        invitationTokenSecret: SECRET,
        now: () => NOW,
      }),
      denialAudit,
      providers,
      transactionIdentityReader,
    };
  }

  it("inspects tokens and rejects unapproved providers / short tokens", async () => {
    await expect(
      build({}).service.inspect({ token: RAW }),
    ).resolves.toMatchObject({
      providerId: "prov-1",
      nextAction: "ACCEPT_EXISTING",
    });

    await expect(
      build({ provider: provider({ applicationStatus: "DRAFT" }) }).service.inspect({
        token: RAW,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_INVALID" });

    await expect(
      build({}).service.resolveInvitationFromToken("short"),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_INVALID" });
  });

  it("accepts idempotently and denies email mismatches", async () => {
    const accepted = invitation({
      status: "ACCEPTED",
      acceptedByUserId: "admin-1",
      acceptedAt: NOW,
    });
    await expect(
      build({ invitation: accepted }).service.accept({
        principal: principal(),
        token: RAW,
      }),
    ).resolves.toMatchObject({ providerId: "prov-1", acceptedAt: NOW.toISOString() });

    const { service, denialAudit } = build({
      identity: { emailNormalized: "other@example.com", emailVerified: true },
    });
    await expect(
      service.accept({
        principal: principal(),
        token: RAW,
        requestId: "req-1",
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_EMAIL_MISMATCH" });
    expect(denialAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "EMAIL_MISMATCH", requestId: "req-1" }),
    );
  });

  it("locks per-user authority before activating membership", async () => {
    const { service, providers } = build({});
    await expect(
      service.accept({ principal: principal(), token: RAW }),
    ).resolves.toMatchObject({ providerId: "prov-1" });

    expect(providers.lockAuthorityReconciliationForUser).toHaveBeenCalledWith(
      "admin-1",
    );
    expect(
      providers.lockAuthorityReconciliationForUser.mock.invocationCallOrder[0]!,
    ).toBeLessThan(providers.upsertMember.mock.invocationCallOrder[0]!);
  });

  it("accepts an active invitation-onboarding identity without FULL capability", async () => {
    const { service, providers } = build({
      identity: {
        accountActive: true,
        active: false,
        emailNormalized: "admin@example.com",
        emailVerified: true,
      },
      transactionIdentity: {
        accountActive: true,
        active: false,
        emailNormalized: "admin@example.com",
        emailVerified: true,
      },
    });

    await expect(
      service.accept({
        principal: principal({
          accountCategories: [],
          verifiedCategories: [],
          verificationOnly: true,
          invitationOnboardingOnly: true,
        }),
        token: RAW,
      }),
    ).resolves.toMatchObject({ providerId: "prov-1" });
    expect(providers.upsertMember).toHaveBeenCalled();
  });

  it("rechecks current identity proof and token verifier inside the transaction", async () => {
    const changedIdentity = build({
      transactionIdentity: {
        accountActive: false,
        active: false,
        emailNormalized: "admin@example.com",
        emailVerified: true,
      },
    });
    await expect(
      changedIdentity.service.accept({
        principal: principal(),
        token: RAW,
        requestId: "tx-proof",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_INVITATION_EMAIL_MISMATCH",
    });
    expect(changedIdentity.providers.updateInvitation).not.toHaveBeenCalled();
    expect(changedIdentity.providers.upsertMember).not.toHaveBeenCalled();
    expect(changedIdentity.denialAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "CURRENT_IDENTITY_PROOF_INVALID",
        requestId: "tx-proof",
      }),
    );

    const verifierMismatch = build({
      lockInvitation: invitation({ tokenVerifier: "0".repeat(64) }),
    });
    await expect(
      verifierMismatch.service.accept({ principal: principal(), token: RAW }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_INVALID" });
    expect(verifierMismatch.providers.updateInvitation).not.toHaveBeenCalled();
    expect(verifierMismatch.providers.upsertMember).not.toHaveBeenCalled();
  });

  it("rejects owner self-accept and expired materialization during accept", async () => {
    await expect(
      build({
        priorMember: { level: "OWNER", status: "ACTIVE" },
      }).service.accept({
        principal: principal(),
        token: RAW,
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_INVITATION_CONFLICT",
      details: expect.objectContaining({ reason: "OWNER_CANNOT_ACCEPT_ADMIN" }),
    });

    await expect(
      build({
        invitation: invitation({
          expiresAt: new Date("2026-08-01T00:00:00.000Z"),
          expiredAt: null,
        }),
        lockInvitation: invitation({
          expiresAt: new Date("2026-08-01T00:00:00.000Z"),
          expiredAt: null,
        }),
      }).service.accept({
        principal: principal(),
        token: RAW,
      }),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_INVALID" });
  });

  it("materializes expired invitations during token resolve", async () => {
    const { service, providers } = build({
      invitation: invitation({
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        expiredAt: null,
      }),
    });
    await expect(
      service.resolveInvitationFromToken(RAW),
    ).rejects.toMatchObject({ code: "PROVIDER_INVITATION_INVALID" });
    expect(providers.updateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({ status: "EXPIRED" }),
    );
  });
});
