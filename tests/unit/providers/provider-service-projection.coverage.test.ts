
import { ProviderProjectionService } from "../../../src/modules/providers/provider-projection.service.js";
import { calculateMarketplaceReadiness } from "../../../src/modules/providers/domain/provider-readiness.policy.js";
import { toProviderServicePriceSafeFacts } from "../../../src/modules/providers/provider-service.dto.js";
import { toServiceManagementDto } from "../../../src/modules/catalog/catalog.public.js";
import {
  R1_P09_IDS,
  R1_P09_SENTINELS,
} from "../../helpers/r1-p09-provider-services-fixtures.js";

const NOW = new Date("2026-09-05T12:00:00.000Z");

function principal() {
  return {
    userId: R1_P09_IDS.ownerUserId,
    sessionId: "session-1",
    sessionCapability: "FULL" as const,
    accountCategories: ["INDIVIDUAL" as const],
  };
}

function providerRecord(kind: "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY" = "INDIVIDUAL_TEAM") {
  return {
    id: R1_P09_IDS.providerId,
    applicationOwnerUserId: R1_P09_IDS.ownerUserId,
    ownerUserId: R1_P09_IDS.ownerUserId,
    kind,
    applicationStatus: "APPROVED" as const,
    operationalStatus: "INACTIVE" as const,
    reviewCycle: 1,
    version: 2,
    firstSubmittedAt: NOW,
    lastSubmittedAt: NOW,
    applicationChangedAt: NOW,
    operationalChangedAt: NOW,
    approvedAt: NOW,
    rejectedAt: null,
    suspendedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function buildProjectionService() {
  const providers = {
    findById: vi.fn(async () => providerRecord()),
    findMember: vi.fn(async () => ({
      level: "OWNER" as const,
      status: "ACTIVE" as const,
    })),
    getProfile: vi.fn(async () => ({
      id: "profile-1",
      providerId: R1_P09_IDS.providerId,
      displayNameAr: "اسم مقدم الخدمة",
      displayNameEn: "Provider",
      descriptionAr: "وصف عربي مكتمل",
      descriptionEn: "Complete description",
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
    listGalleryItems: vi.fn(async () => [
      {
        id: "gallery-0",
        providerId: R1_P09_IDS.providerId,
        mediaFileId: "gallery-media-0",
        kind: "IMAGE" as const,
        position: 0,
        createdByUserId: R1_P09_IDS.ownerUserId,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "gallery-1",
        providerId: R1_P09_IDS.providerId,
        mediaFileId: "gallery-media-1",
        kind: "IMAGE" as const,
        position: 1,
        createdByUserId: R1_P09_IDS.ownerUserId,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "gallery-2",
        providerId: R1_P09_IDS.providerId,
        mediaFileId: "gallery-media-2",
        kind: "VIDEO" as const,
        position: 2,
        createdByUserId: R1_P09_IDS.ownerUserId,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]),
    listMembers: vi.fn(async () => [
      {
        id: "m1",
        providerId: R1_P09_IDS.providerId,
        userId: R1_P09_IDS.adminUserId,
        level: "ADMIN" as const,
        status: "ACTIVE" as const,
      },
    ]),
    countPendingInvitations: vi.fn(async () => 2),
    listStatusHistory: vi.fn(async () => [
      {
        id: "hist-1",
        providerId: R1_P09_IDS.providerId,
        domain: "APPLICATION" as const,
        fromApplicationStatus: "PENDING_REVIEW" as const,
        toApplicationStatus: "APPROVED" as const,
        fromOperationalStatus: null,
        toOperationalStatus: null,
        reviewCycle: 1,
        reason: "approved",
        createdAt: NOW,
      },
      {
        id: "hist-2",
        providerId: R1_P09_IDS.providerId,
        domain: "OPERATIONAL" as const,
        fromApplicationStatus: null,
        toApplicationStatus: null,
        fromOperationalStatus: "INACTIVE" as const,
        toOperationalStatus: "INACTIVE" as const,
        reviewCycle: null,
        reason: null,
        createdAt: new Date("2026-09-04T12:00:00.000Z"),
      },
    ]),
  };

  return new ProviderProjectionService({
    providers: providers as never,
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
        providerAdminEnabled: true,
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
        contentType: mediaId.includes("video") ? "video/mp4" : "image/webp",
        byteSize: 100,
        width: 600,
        height: 600,
        hasReadyThumbnail: false,
      })),
    },
    activeCountries: {
      resolveActiveCountry: vi.fn(async () => ({
        id: R1_P09_IDS.countryId,
        code: "EG",
      })),
      getById: vi.fn(async () => ({ id: R1_P09_IDS.countryId, code: "EG" })),
    },
    denialAudit: {
      append: vi.fn(async () => ({ id: "audit-1", createdAt: NOW.toISOString() })),
    },
    verificationFacts: {
      read: vi.fn(async () => ({
        documentsVerified: {
          applicable: true,
          status: "SATISFIED" as const,
          satisfied: true,
          blockerCodes: [],
        },
        payoutDestinationReady: true,
      })),
    },
    servicesReadyFacts: {
      read: vi.fn(async () => ({
        satisfied: false,
        blockerCodes: ["NO_USABLE_PROVIDER_SERVICE"],
      })),
    },
  });
}

describe("provider-service projection coverage", () => {
  it("covers completion, readiness, history, dashboard, and settings reads", async () => {
    const service = buildProjectionService();
    const actor = principal();

    await expect(
      service.getCompletion({
        principal: actor as never,
        providerId: R1_P09_IDS.providerId,
        requestId: R1_P09_IDS.requestId,
      }),
    ).resolves.toMatchObject({ percentage: expect.any(Number) });

    const readiness = await service.getReadiness({
      principal: actor as never,
      providerId: R1_P09_IDS.providerId,
    });
    expect(
      readiness.gates.find((gate) => gate.key === "servicesReady")?.satisfied,
    ).toBe(false);

    const history = await service.listHistory({
      principal: actor as never,
      providerId: R1_P09_IDS.providerId,
      limit: 1,
    });
    expect(history.items).toHaveLength(1);
    expect(history.nextCursor).toBeTypeOf("string");

    const paged = await service.listHistory({
      principal: actor as never,
      providerId: R1_P09_IDS.providerId,
      cursor: history.nextCursor!,
      limit: 20,
    });
    expect(paged.items.length).toBeGreaterThanOrEqual(0);

    const dashboard = await service.getDashboard({
      principal: actor as never,
      providerId: R1_P09_IDS.providerId,
    });
    expect(dashboard.activeAdminCount).toBe(1);
    expect(dashboard.pendingInvitationCount).toBe(2);
    expect(dashboard.latestStaffDecision?.toApplicationStatus).toBe("APPROVED");

    const settings = await service.getSettings({
      principal: actor as never,
      providerId: R1_P09_IDS.providerId,
    });
    expect(settings.members.activeAdminCount).toBe(1);
    expect(settings.profile.href).toContain(R1_P09_IDS.providerId);
  });

  it("covers company documents gate and price/catalog mapper edges", () => {
    const company = calculateMarketplaceReadiness({
      kind: "REGISTERED_COMPANY",
      applicationStatus: "APPROVED",
      operationalStatus: "INACTIVE",
      profileCompletionPercentage: 100,
      servicesReady: { satisfied: true, blockerCodes: [] },
    });
    expect(
      company.gates.find((gate) => gate.key === "documentsVerified")?.status,
    ).toBe("BLOCKED");

    const withDocs = calculateMarketplaceReadiness({
      kind: "REGISTERED_COMPANY",
      applicationStatus: "APPROVED",
      operationalStatus: "INACTIVE",
      profileCompletionPercentage: 100,
      documentsVerified: {
        applicable: true,
        status: "SATISFIED",
        satisfied: true,
        blockerCodes: [],
      },
      payoutDestinationReady: false,
      servicesReady: { satisfied: true, blockerCodes: [] },
    });
    expect(
      withDocs.gates.find((gate) => gate.key === "documentsVerified")?.satisfied,
    ).toBe(true);

    expect(
      toProviderServicePriceSafeFacts({
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
        approvalRequiredAtProposal: false,
        status: "EFFECTIVE",
        proposedByUserId: R1_P09_IDS.ownerUserId,
        effectiveAt: NOW,
        rejectedAt: null,
        supersededAt: null,
        createdAt: NOW,
      }).providerPrice,
    ).toBe(R1_P09_SENTINELS.providerPrice);

    expect(
      toServiceManagementDto({
        id: "svc-1",
        categoryId: "cat-1",
        code: "DEEP_CLEAN",
        displayOrder: 1,
        isActive: true,
        version: 1,
        createdAt: NOW,
        updatedAt: NOW,
        translations: [],
        priceUnits: [
          {
            id: "pu-1",
            code: "PER_VISIT",
            labelAr: null,
            labelEn: "Per visit",
            displayOrder: 1,
            isActive: true,
          },
        ],
        fields: [
          {
            id: "field-1",
            code: "ROOMS",
            kind: "NUMBER",
            labelAr: null,
            labelEn: "Rooms",
            helpTextAr: null,
            helpTextEn: null,
            isRequired: true,
            isActive: true,
            minLength: null,
            maxLength: null,
            numberMode: "INTEGER",
            minValue: "1",
            maxValue: "10",
            minSelections: null,
            maxSelections: null,
            displayOrder: 1,
            options: [
              {
                id: "opt-1",
                value: "A",
                labelAr: null,
                labelEn: "A",
                displayOrder: 1,
                isActive: true,
              },
            ],
          },
        ],
      }).fields[0]?.options,
    ).toHaveLength(1);
  });
});
