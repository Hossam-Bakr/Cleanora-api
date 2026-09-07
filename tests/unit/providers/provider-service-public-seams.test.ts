import { createHmac } from "node:crypto";

import {
  PrismaAuthenticationProofConsumption,
  PrismaAuthenticationProofUseAuthorizer,
  PrismaProviderServiceStaffAuthorizer,
  PrismaR1P06StaffPermissionAuthorizer,
} from "../../../src/modules/authentication/infrastructure/prisma-r1-p06-security.adapters.js";
import {
  createUnavailableProviderPublicReader,
  createProviderServiceSnapshotReader,
  createProviderServicesReadyFactsReader,
  projectContactFreeProviderPreview,
} from "../../../src/modules/providers/providers.public.js";
import {
  providerServiceError,
  providerServiceErrorToAppError,
  rethrowProviderServiceAsAppError,
  ProviderServiceError,
} from "../../../src/modules/providers/domain/provider-service.errors.js";
import {
  assertSafeProviderServiceOutput,
  managementDtoFromSafeResultJson,
  managementDtoToSafeResultJson,
  staffDecisionDtoFromSafeResultJson,
  staffDecisionDtoToSafeResultJson,
  toProviderServiceStatusHistoryItemDto,
  toStaffPendingPriceDossierDto,
  toStaffPendingPriceProposalDto,
  toStaffPriceDecisionResultDto,
} from "../../../src/modules/providers/provider-service.dto.js";
import {
  createProviderServiceBodySchema,
  proposeProviderServicePriceBodySchema,
  replaceProviderServiceConfigurationBodySchema,
  staffPendingPriceProposalsQuerySchema,
} from "../../../src/modules/providers/provider-service.schema.js";
import { ProviderProjectionService } from "../../../src/modules/providers/provider-projection.service.js";
import { R1_P09_IDS } from "../../helpers/r1-p09-provider-services-fixtures.js";
import {
  findPrivilegedActionReason,
  permissionCodesForRole,
} from "../../../src/modules/authentication/domain/authorization.catalog.js";

const NOW = new Date("2026-09-05T12:00:00.000Z");
const SECRET = "test-verifier-secret-that-is-longer-than-32-chars";

function signProof(claims: Record<string, string>): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

describe("provider-service public seams and adapters", () => {
  it("covers Authentication proof adapters and staff authorizers", async () => {
    const claims = {
      proofId: "proof-1",
      actorUserId: "actor-1",
      sessionId: "session-1",
      purpose: "PROVIDER_PAYOUT_SUBMIT",
      providerId: "provider-1",
      destinationVersionId: "dest-1",
      requestId: "req-1",
      authenticatedAt: NOW.toISOString(),
    };
    const opaqueProof = signProof(claims);

    const db = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work({
          userSession: {
            findFirst: vi.fn(async () => ({ id: "session-1" })),
          },
          sensitiveActionProofUse: {
            create: vi.fn(async () => ({ id: "use-1" })),
          },
        }),
      ),
      userRole: {
        findFirst: vi.fn(async () => ({ id: "grant-1" })),
      },
      sensitiveActionProofUse: {
        findFirst: vi.fn(async () => ({ id: "use-1" })),
      },
    };

    const consumer = new PrismaAuthenticationProofConsumption(SECRET, db as never);
    await expect(
      consumer.consume({
        opaqueProof,
        actorUserId: claims.actorUserId,
        sessionId: claims.sessionId,
        purpose: claims.purpose as never,
        providerId: claims.providerId,
        destinationVersionId: claims.destinationVersionId,
        requestId: claims.requestId,
      }),
    ).resolves.toMatchObject({ proofId: "proof-1" });

    await expect(
      consumer.consume({
        opaqueProof: "bad",
        actorUserId: claims.actorUserId,
        sessionId: claims.sessionId,
        purpose: claims.purpose as never,
        providerId: claims.providerId,
        destinationVersionId: claims.destinationVersionId,
        requestId: claims.requestId,
      }),
    ).resolves.toBeNull();

    const authorizer = new PrismaR1P06StaffPermissionAuthorizer(db as never);
    await expect(
      authorizer.authorize("staff", "providers.services.prices.approve"),
    ).resolves.toBe(true);

    const providerAuthorizer = new PrismaProviderServiceStaffAuthorizer(db as never);
    await expect(
      providerAuthorizer.authorize("staff", "providers.services.prices.approve"),
    ).resolves.toBe(true);

    const proofUse = new PrismaAuthenticationProofUseAuthorizer(db as never);
    await expect(
      proofUse.assertConsumed({
        proofId: "proof-1",
        actorUserId: "actor-1",
        purpose: "PROVIDER_PAYOUT_SUBMIT",
        providerId: "provider-1",
        destinationVersionId: "dest-1",
        requestId: "req-1",
        maximumAgeSeconds: 600,
        now: NOW,
      }),
    ).resolves.toBe(true);

    expect(findPrivilegedActionReason("catalog_management_change")).toBeDefined();
    expect(findPrivilegedActionReason("missing-reason")).toBeUndefined();
    expect(permissionCodesForRole("staff_admin")).toContain(
      "providers.services.prices.approve",
    );
    expect(permissionCodesForRole("unknown_role")).toEqual([]);
  });

  it("covers providers.public factories and projection servicesReady wiring", async () => {
    const readyReader = createProviderServicesReadyFactsReader({
      getServicesReady: async (providerId) => ({
        providerId,
        servicesReady: true,
        qualifyingOfferingCount: 1,
        blockerCodes: [],
      }),
    });
    await expect(readyReader.getServicesReady("p1")).resolves.toMatchObject({
      servicesReady: true,
    });

    const snapshotReader = createProviderServiceSnapshotReader({
      getSnapshotReadyFacts: async () => ({ status: "UNAVAILABLE" }),
    });
    await expect(
      snapshotReader.getSnapshotReadyFacts({
        providerId: "p1",
        catalogServiceCode: "CODE",
        countryCode: "EG",
        locale: "EN",
      }),
    ).resolves.toEqual({ status: "UNAVAILABLE" });

    const unavailable = createUnavailableProviderPublicReader();
    expect(await unavailable.getProviderIdentity("p")).toBeNull();
    expect(await unavailable.getMembershipScope({ userId: "u", providerId: "p" })).toBeNull();
    expect(await unavailable.getMarketplaceReadiness("p")).toBeNull();
    expect(await unavailable.getContactFreePreview?.("p")).toBeNull();

    expect(
      projectContactFreeProviderPreview({
        provider: { id: "p1", kind: "INDIVIDUAL_TEAM" },
        profile: {
          displayNameAr: "اسم",
          displayNameEn: "Name",
          descriptionAr: "وصف",
          descriptionEn: "Desc",
        },
        countryCode: "EG",
      }).providerId,
    ).toBe("p1");

    const projection = new ProviderProjectionService({
      providers: {
        getProfile: vi.fn(async () => ({
          id: "profile-1",
          providerId: R1_P09_IDS.providerId,
          displayNameAr: "اسم مقدم الخدمة",
          displayNameEn: null,
          descriptionAr: "وصف عربي مكتمل",
          descriptionEn: null,
          countryId: R1_P09_IDS.countryId,
          logoMediaFileId: "logo-1",
          coverMediaFileId: "cover-1",
          createdAt: NOW,
          updatedAt: NOW,
        })),
        getContact: vi.fn(async () => ({
          id: "contact-1",
          providerId: R1_P09_IDS.providerId,
          operationalEmailNormalized: "ops@example.test",
          operationalPhoneE164: "+201012345678",
          channels: [],
          createdAt: NOW,
          updatedAt: NOW,
        })),
        listGalleryItems: vi.fn(async () =>
          [0, 1, 2].map((index) => ({
            id: `gallery-${index}`,
            providerId: R1_P09_IDS.providerId,
            mediaFileId: `gallery-media-${index}`,
            kind: "IMAGE" as const,
            position: index,
            createdByUserId: R1_P09_IDS.ownerUserId,
            createdAt: NOW,
            updatedAt: NOW,
          })),
        ),
      } as never,
      identityReader: {
        getEligibilityFacts: vi.fn(async () => ({
          active: true,
          verificationOnly: false,
          enrolledCategories: ["INDIVIDUAL"],
          verifiedCategories: ["INDIVIDUAL"],
          emailNormalized: "owner@example.test",
          emailVerified: true,
          phoneE164: "+201012345678",
          phoneVerified: true,
          providerAdminEnabled: false,
        })),
      } as never,
      applicantProfiles: {
        getMatchingApplicantContext: vi.fn(async () => ({
          category: "INDIVIDUAL" as const,
          profileComplete: true,
          individualFullName: "Owner",
          companyName: null,
          representativeFullName: null,
        })),
      },
      mediaReader: {
        getMediaStatus: vi.fn(async (mediaId: string) => ({
          mediaId,
          status: "READY" as const,
          contentType: "image/webp",
          byteSize: 100,
          width: 600,
          height: 600,
          hasReadyThumbnail: false,
        })),
      },
      activeCountries: {
        resolveActiveCountry: vi.fn(async () => null),
        getById: vi.fn(async () => ({ id: R1_P09_IDS.countryId, code: "EG" })),
      },
      denialAudit: {
        append: vi.fn(async () => ({ id: "audit-1", createdAt: NOW.toISOString() })),
      },
      servicesReadyFacts: {
        read: vi.fn(async () => ({
          satisfied: true,
          blockerCodes: [],
        })),
      },
    });

    const result = await projection.computeProjections({
      id: R1_P09_IDS.providerId,
      applicationOwnerUserId: R1_P09_IDS.ownerUserId,
      ownerUserId: null,
      kind: "INDIVIDUAL_TEAM",
      applicationStatus: "APPROVED",
      operationalStatus: "INACTIVE",
      reviewCycle: 0,
      version: 1,
      firstSubmittedAt: null,
      lastSubmittedAt: null,
      applicationChangedAt: NOW,
      operationalChangedAt: NOW,
      approvedAt: NOW,
      rejectedAt: null,
      suspendedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(result.completion.percentage).toBeGreaterThan(0);
    expect(
      result.readiness.gates.some((gate) => gate.key === "servicesReady"),
    ).toBe(true);
  });

  it("covers schema money rejection, dto edges, and error helpers", () => {
    expect(
      createProviderServiceBodySchema.safeParse({
        catalogServiceCode: "X",
        catalogPriceUnitId: "u",
        price: "10.00",
        minimumCharge: "10.00",
        estimatedDurationMinutes: 30,
        expectedVersion: 0,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        currency: "EGP",
      }).success,
    ).toBe(false);

    expect(
      createProviderServiceBodySchema.safeParse({
        catalogServiceCode: "X",
        catalogPriceUnitId: "u",
        price: "10.00",
        minimumCharge: "10.00",
        estimatedDurationMinutes: 30,
        expectedVersion: 0,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        noteAr: "فقط",
      }).success,
    ).toBe(false);

    expect(
      replaceProviderServiceConfigurationBodySchema.safeParse({
        estimatedDurationMinutes: 30,
        noteAr: "a",
        noteEn: null,
        expectedVersion: 1,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
      }).success,
    ).toBe(false);

    expect(
      proposeProviderServicePriceBodySchema.safeParse({
        catalogPriceUnitId: "u",
        price: "10.00",
        minimumCharge: "10.00",
        reason: "reason",
        expectedVersion: 1,
        idempotencyKey: R1_P09_IDS.idempotencyKey,
        total: "99.00",
      }).success,
    ).toBe(false);

    expect(
      staffPendingPriceProposalsQuerySchema.parse({
        countryCode: "eg",
      }).countryCode,
    ).toBe("EG");

    const pending = {
      id: R1_P09_IDS.providerServicePriceId,
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      catalogServiceId: R1_P09_IDS.catalogServiceId,
      catalogPriceUnitId: R1_P09_IDS.catalogPriceUnitId,
      priceUnitCodeAtProposal: R1_P09_IDS.catalogPriceUnitCode,
      countryIdAtProposal: R1_P09_IDS.countryId,
      countryCodeAtProposal: R1_P09_IDS.countryCode,
      currencyId: R1_P09_IDS.currencyId,
      currencyCode: R1_P09_IDS.currencyCode,
      currencyDecimalPlaces: 2,
      providerPriceMinorUnits: "12000",
      minimumChargeMinorUnits: "15000",
      maximumPriceMinorUnitsAtProposal: "999999",
      approvalRequiredAtProposal: true,
      status: "PENDING" as const,
      proposedByUserId: R1_P09_IDS.ownerUserId,
      effectiveAt: null,
      rejectedAt: null,
      supersededAt: null,
      createdAt: NOW,
    };

    expect(
      toStaffPendingPriceProposalDto({
        price: pending,
        offeringVersion: 1,
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        providerDisplayNameAr: null,
        providerDisplayNameEn: "Provider",
      }).providerDisplay.nameEn,
    ).toBe("Provider");

    expect(
      toStaffPendingPriceDossierDto({
        offering: {
          id: R1_P09_IDS.providerServiceId,
          providerId: R1_P09_IDS.providerId,
          catalogServiceId: R1_P09_IDS.catalogServiceId,
          enabled: false,
          estimatedDurationMinutes: 90,
          noteAr: null,
          noteEn: null,
          version: 1,
          createdAt: NOW,
          updatedAt: NOW,
        },
        pendingPrice: pending,
        effectivePrice: null,
        catalogServiceCode: R1_P09_IDS.catalogServiceCode,
        catalogServiceVersion: 1,
        providerDisplayNameAr: null,
        providerDisplayNameEn: null,
      }).effectivePrice,
    ).toBeNull();

    const decision = toStaffPriceDecisionResultDto({
      decision: "APPROVE",
      providerId: R1_P09_IDS.providerId,
      providerServiceId: R1_P09_IDS.providerServiceId,
      providerServicePriceId: R1_P09_IDS.providerServicePriceId,
      priceStatus: "EFFECTIVE",
      version: 2,
      effectivePriceId: R1_P09_IDS.providerServicePriceId,
    });
    const decisionJson = staffDecisionDtoToSafeResultJson(decision);
    expect(staffDecisionDtoFromSafeResultJson(decisionJson).decision).toBe("APPROVE");
    expect(() =>
      staffDecisionDtoFromSafeResultJson({ decision: "NOPE" }),
    ).toThrow(ProviderServiceError);

    expect(() =>
      toProviderServiceStatusHistoryItemDto({
        id: "sh-1",
        providerId: R1_P09_IDS.providerId,
        providerServiceId: R1_P09_IDS.providerServiceId,
        event: "OFFERING_CREATED",
        fromEnabled: null,
        toEnabled: false,
        actorUserId: R1_P09_IDS.ownerUserId,
        reasonCode: "X",
        reasonText: null,
        safeBefore: null,
        safeAfter: { enabled: false },
        requestId: R1_P09_IDS.requestId,
        aggregateVersion: 1,
        operationKey: "op",
        receipt: {
          scopeKey: "s",
          idempotencyKey: R1_P09_IDS.idempotencyKey,
          requestFingerprint: "fp",
          safeResultCode: "OK",
          safeResultJson: { id: "x" },
        },
        createdAt: NOW,
      } as never),
    ).toThrow(ProviderServiceError);

    const management = {
      id: R1_P09_IDS.providerServiceId,
      providerId: R1_P09_IDS.providerId,
      catalogService: {
        id: R1_P09_IDS.catalogServiceId,
        code: R1_P09_IDS.catalogServiceCode,
        version: 1,
        selectableForProviderCountry: true,
      },
      enabled: false,
      estimatedDurationMinutes: 90,
      notes: { ar: null, en: null },
      version: 1,
      effectivePrice: null,
      pendingPrice: null,
      usability: { usable: false, blockerCodes: [] },
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    };
    const stored = managementDtoToSafeResultJson(management as never);
    expect(managementDtoFromSafeResultJson(stored).id).toBe(management.id);
    expect(() => managementDtoFromSafeResultJson({ nope: true })).toThrow(
      ProviderServiceError,
    );

    expect(() =>
      assertSafeProviderServiceOutput({ email: "leak@example.test" }),
    ).toThrow(ProviderServiceError);

    const appError = providerServiceError("PROVIDER_SERVICE_FORBIDDEN", {
      reason: "NOPE",
    });
    expect(appError.statusCode).toBe(403);
    expect(
      providerServiceErrorToAppError(
        new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND", "custom", {
          details: { x: 1 },
        }),
      ).message,
    ).toBe("custom");
    expect(() =>
      rethrowProviderServiceAsAppError(
        new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND"),
      ),
    ).toThrow();
    expect(() => rethrowProviderServiceAsAppError(new Error("raw"))).toThrow("raw");
  });
});
