/**
 * Deterministic Provider fixtures for isolated proof-database suites.
 *
 * Use only against the approved test database URL. Fixtures never call real
 * SMTP or Cloudinary and never reuse production-looking credentials.
 */

export interface ProviderIdentityFixture {
  readonly userId: string;
  readonly emailNormalized: string;
  readonly phoneE164: string;
  readonly accountCategories: readonly string[];
  readonly verifiedCategories: readonly string[];
}

export interface ProviderStaffFixture {
  readonly userId: string;
  readonly emailNormalized: string;
  readonly roleCode: "staff_admin";
}

export interface ProviderMediaFixtureMeta {
  readonly mediaId: string;
  readonly contentType: string;
  readonly byteSize: number;
  readonly width: number;
  readonly height: number;
  readonly status: "PENDING_UPLOAD" | "PROCESSING" | "READY" | "FAILED";
}

let sequence = 0;

function nextSuffix(): string {
  sequence += 1;
  return `${Date.now().toString(36)}${sequence.toString(36)}`;
}

/** Build a unique Individual applicant identity for Provider creation tests. */
export function buildIndividualApplicantFixture(
  overrides: Partial<ProviderIdentityFixture> = {},
): ProviderIdentityFixture {
  const suffix = nextSuffix();
  return {
    userId: `user-individual-${suffix}`,
    emailNormalized: `individual.${suffix}@example.com`,
    phoneE164: `+2010${String(sequence).padStart(8, "0")}`.slice(0, 16),
    accountCategories: ["INDIVIDUAL"],
    verifiedCategories: ["INDIVIDUAL"],
    ...overrides,
  };
}

/** Build a unique Company applicant identity for Provider creation tests. */
export function buildCompanyApplicantFixture(
  overrides: Partial<ProviderIdentityFixture> = {},
): ProviderIdentityFixture {
  const suffix = nextSuffix();
  return {
    userId: `user-company-${suffix}`,
    emailNormalized: `company.${suffix}@example.com`,
    phoneE164: `+2011${String(sequence).padStart(8, "0")}`.slice(0, 16),
    accountCategories: ["COMPANY"],
    verifiedCategories: ["COMPANY"],
    ...overrides,
  };
}

/** Build a Staff Admin actor for review/lifecycle suites. */
export function buildStaffAdminFixture(
  overrides: Partial<ProviderStaffFixture> = {},
): ProviderStaffFixture {
  const suffix = nextSuffix();
  return {
    userId: `user-staff-${suffix}`,
    emailNormalized: `staff.${suffix}@example.com`,
    roleCode: "staff_admin",
    ...overrides,
  };
}

/** Build a categoryless invitation invitee identity. */
export function buildCategorylessInviteeFixture(
  overrides: Partial<ProviderIdentityFixture> = {},
): ProviderIdentityFixture {
  const suffix = nextSuffix();
  return {
    userId: `user-invitee-${suffix}`,
    emailNormalized: `invitee.${suffix}@example.com`,
    phoneE164: `+2012${String(sequence).padStart(8, "0")}`.slice(0, 16),
    accountCategories: [],
    verifiedCategories: [],
    ...overrides,
  };
}

/** Build opaque READY media metadata without storage identifiers. */
export function buildReadyMediaFixture(
  overrides: Partial<ProviderMediaFixtureMeta> = {},
): ProviderMediaFixtureMeta {
  const suffix = nextSuffix();
  return {
    mediaId: `media-${suffix}`,
    contentType: "image/webp",
    byteSize: 12_000,
    width: 600,
    height: 600,
    status: "READY",
    ...overrides,
  };
}

import type { Prisma, PrismaClient } from "../../src/generated/prisma/client.js";

type ProviderSeedPrisma = PrismaClient;

export async function ensureActiveTestCountry(
  prisma: ProviderSeedPrisma,
): Promise<{ id: string; code: string }> {
  return resolveActiveCountryForSeed(prisma);
}

async function resolveActiveCountryForSeed(
  prisma: ProviderSeedPrisma,
): Promise<{ id: string; code: string }> {
  const existing = await prisma.country.findFirst({
    where: { isActive: true },
    select: { id: true, code: true },
  });
  if (existing !== null) {
    return existing;
  }

  let currency = await prisma.currency.findFirst({ select: { id: true } });
  if (currency === null) {
    currency = await prisma.currency.create({
      data: {
        code: "EGP",
        nameEn: "Egyptian Pound",
        nameAr: "جنيه مصري",
        decimalPlaces: 2,
      },
    });
  }

  return prisma.country.create({
    data: {
      code: "EG",
      nameEn: "Egypt",
      nameAr: "مصر",
      defaultCurrencyId: currency.id,
      defaultLocale: "ar",
      supportedLocales: ["ar", "en"] as Prisma.InputJsonValue,
      isActive: true,
    },
  });
}

/**
 * Seed a complete R1-P05-v1 application payload via Prisma for submit suites.
 * Does not call real SMTP/Cloudinary.
 */
export async function seedCompleteProviderApplicationContent(
  prisma: ProviderSeedPrisma,
  input: {
    readonly providerId: string;
    readonly ownerUserId: string;
    readonly emailNormalized?: string;
    readonly phoneE164?: string;
  },
): Promise<void> {
  const country = await resolveActiveCountryForSeed(prisma);
  const suffix = nextSuffix();

  const logo = await prisma.mediaFile.create({
    data: {
      ownerUserId: input.ownerUserId,
      ownerType: "PROVIDER_LOGO",
      storageProvider: "CLOUDINARY",
      storageKey: `test/provider/${input.providerId}/logo-${suffix}`,
      contentType: "image/webp",
      byteSize: 8_000,
      width: 512,
      height: 512,
      status: "READY",
    },
  });
  const cover = await prisma.mediaFile.create({
    data: {
      ownerUserId: input.ownerUserId,
      ownerType: "PROVIDER_COVER",
      storageProvider: "CLOUDINARY",
      storageKey: `test/provider/${input.providerId}/cover-${suffix}`,
      contentType: "image/webp",
      byteSize: 20_000,
      width: 1600,
      height: 900,
      status: "READY",
    },
  });

  const galleryIds: string[] = [];
  for (let index = 0; index < 3; index += 1) {
    const gallery = await prisma.mediaFile.create({
      data: {
        ownerUserId: input.ownerUserId,
        ownerType: "PROVIDER_GALLERY_IMAGE",
        storageProvider: "CLOUDINARY",
        storageKey: `test/provider/${input.providerId}/gallery-${index}-${suffix}`,
        contentType: "image/webp",
        byteSize: 10_000,
        width: 1200,
        height: 800,
        status: "READY",
      },
    });
    galleryIds.push(gallery.id);
  }

  await prisma.providerProfile.update({
    where: { providerId: input.providerId },
    data: {
      displayNameAr: "مزود نظافة",
      descriptionAr: "وصف عربي مكتمل لملف المزود",
      countryId: country.id,
      logoMediaFileId: logo.id,
      coverMediaFileId: cover.id,
    },
  });

  await prisma.providerContact.update({
    where: { providerId: input.providerId },
    data: {
      operationalEmailNormalized:
        input.emailNormalized ?? `ops.${suffix}@example.com`,
      operationalPhoneE164: input.phoneE164 ?? "+201012345678",
      channels: [],
    },
  });

  for (let index = 0; index < galleryIds.length; index += 1) {
    await prisma.providerGalleryItem.create({
      data: {
        providerId: input.providerId,
        mediaFileId: galleryIds[index]!,
        kind: "IMAGE",
        position: index,
        createdByUserId: input.ownerUserId,
      },
    });
  }
}
