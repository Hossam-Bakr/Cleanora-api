import type {
  ProviderGalleryItemRecord,
  ProviderRecord,
} from "../../../../src/modules/providers/domain/providers.types.js";
import { ProviderProjectionService } from "../../../../src/modules/providers/provider-projection.service.js";

const NOW = new Date("2026-08-11T00:00:00.000Z");

function provider(): ProviderRecord {
  return {
    id: "provider-1",
    applicationOwnerUserId: "owner-1",
    ownerUserId: null,
    kind: "INDIVIDUAL_TEAM",
    applicationStatus: "DRAFT",
    operationalStatus: "INACTIVE",
    reviewCycle: 0,
    version: 1,
    firstSubmittedAt: null,
    lastSubmittedAt: null,
    applicationChangedAt: NOW,
    operationalChangedAt: NOW,
    approvedAt: null,
    rejectedAt: null,
    suspendedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function galleryItem(index: number): ProviderGalleryItemRecord {
  return {
    id: `gallery-${index}`,
    providerId: "provider-1",
    mediaFileId: `gallery-media-${index}`,
    kind: "IMAGE",
    position: index,
    createdByUserId: "owner-1",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("ProviderProjectionService authoritative facts", () => {
  it("invalidates completion when identity or configured country becomes inactive", async () => {
    let identityActive = true;
    let countryActive = true;
    const repositories = {
      getProfile: vi.fn(async () => ({
        id: "profile-1",
        providerId: "provider-1",
        displayNameAr: "اسم مقدم الخدمة",
        displayNameEn: null,
        descriptionAr: "وصف عربي مكتمل",
        descriptionEn: null,
        countryId: "country-1",
        logoMediaFileId: "logo-1",
        coverMediaFileId: "cover-1",
        createdAt: NOW,
        updatedAt: NOW,
      })),
      getContact: vi.fn(async () => ({
        id: "contact-1",
        providerId: "provider-1",
        operationalEmailNormalized: "ops@example.test",
        operationalPhoneE164: "+201012345678",
        channels: [],
        createdAt: NOW,
        updatedAt: NOW,
      })),
      listGalleryItems: vi.fn(async () => [0, 1, 2].map(galleryItem)),
    };
    const service = new ProviderProjectionService({
      providers: repositories as never,
      identityReader: {
        getEligibilityFacts: vi.fn(async () => ({
          active: identityActive,
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
        getById: vi.fn(async () =>
          countryActive ? { id: "country-1", code: "EG" } : null,
        ),
      },
      denialAudit: {
        append: vi.fn(async () => ({
          id: "audit-1",
          createdAt: NOW.toISOString(),
        })),
      },
    });

    const complete = await service.computeProjections(provider());
    expect(complete.completion.percentage).toBe(100);

    countryActive = false;
    const countryDeactivated = await service.computeProjections(provider());
    expect(countryDeactivated.completion.percentage).toBe(90);
    expect(countryDeactivated.completion.missingRequirementCodes).toContain(
      "ACTIVE_COUNTRY",
    );

    identityActive = false;
    const ownerDeactivated = await service.computeProjections(provider());
    expect(ownerDeactivated.completion.percentage).toBe(80);
    expect(ownerDeactivated.completion.missingRequirementCodes).toEqual(
      expect.arrayContaining(["ACTIVE_COUNTRY", "ELIGIBLE_CATEGORY_VERIFIED"]),
    );
  });
});
