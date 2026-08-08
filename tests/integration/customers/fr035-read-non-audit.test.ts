import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createPrismaDenialAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-denial-audit.writer.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import { AddressService } from "../../../src/modules/customers/address.service.js";
import { IdentityContactRead } from "../../../src/modules/customers/infrastructure/identity-contact.read.js";
import { PrismaAddressRepository } from "../../../src/modules/customers/infrastructure/prisma-address.repository.js";
import { PrismaCustomersUnitOfWork } from "../../../src/modules/customers/infrastructure/prisma-customers.unit-of-work.js";
import { PrismaPreferencesRepository } from "../../../src/modules/customers/infrastructure/prisma-preferences.repository.js";
import { PrismaPrivacyRequestRepository } from "../../../src/modules/customers/infrastructure/prisma-privacy-request.repository.js";
import { PrismaProfileRepository } from "../../../src/modules/customers/infrastructure/prisma-profile.repository.js";
import { PreferencesService } from "../../../src/modules/customers/preferences.service.js";
import { PrivacyRequestService } from "../../../src/modules/customers/privacy-request.service.js";
import { ProfileImageService } from "../../../src/modules/customers/profile-image.service.js";
import { ProfileService } from "../../../src/modules/customers/profile.service.js";
import { createMediaPendingUploadPort } from "../../../src/modules/media/infrastructure/media-provider.factory.js";
import type { MediaStoragePort } from "../../../src/modules/media/media.public.js";
import { SharpProfileImageProcessor } from "../../../src/modules/media/infrastructure/sharp-profile-image.processor.js";
import { assertR1P04CustomerSchemaReady } from "../../helpers/assert-r1-p04-schema.js";
import { requireR1P04TestDatabase } from "../../helpers/r1-p04-test-database.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";

/**
 * Cross-story FR-035: successful self-reads must not create personal-content
 * business audit records (profile GET, protected image GET, address GET/list,
 * contact-state GET, preferences GET, privacy request GET/list).
 */
const surfaces = [
  "profile GET",
  "protected image GET",
  "address GET",
  "address list",
  "contact-state GET",
  "preferences GET",
  "privacy request GET",
  "privacy request list",
] as const;

const PERSONAL_CONTENT_READ_ACTIONS = [
  "customers.profile.read",
  "customers.profile_image.read",
  "customers.address.read",
  "customers.address.list",
  "customers.contact-state.read",
  "customers.preferences.read",
  "customers.privacy.requests.read",
  "customers.privacy.requests.list",
] as const;

describe("FR-035 successful self-read non-audit (T074)", () => {
  it("enumerates every approved FR-035 self-read surface", () => {
    expect(surfaces).toHaveLength(8);
    expect(PERSONAL_CONTENT_READ_ACTIONS).toHaveLength(8);
  });
});

describe("FR-035 live non-audit assertions", () => {
  let database: PrismaLifecycle;
  let userId: string;

  beforeAll(() => {
    requireR1P04TestDatabase();
  });

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await assertR1P04CustomerSchemaReady();
  });

  beforeEach(async () => {
    userId = await getPrismaClient()
      .user.create({
        data: {
          phoneE164: `+201${randomUUID().replace(/\D/gu, "").slice(0, 10).padEnd(10, "0")}`,
          emailNormalized: `fr035-${randomUUID()}@example.test`,
          emailVerifiedAt: new Date(),
          accountCategories: ["INDIVIDUAL"],
          verifiedCategories: ["INDIVIDUAL"],
        },
      })
      .then((user) => user.id);
  });

  afterEach(async () => {
    const prisma = getPrismaClient();
    await prisma.privacyRequest.deleteMany({ where: { userId } });
    await prisma.userAddress.deleteMany({ where: { userId } });
    await prisma.userPreferences.deleteMany({ where: { userId } });
    await prisma.individualProfile.deleteMany({ where: { userId } });
    await prisma.customerProfile.deleteMany({ where: { userId } });
    await prisma.mediaFile.deleteMany({ where: { ownerUserId: userId } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it("creates no personal-content business audit for successful self-reads", { timeout: 120000 }, async () => {
    const unitOfWork = new PrismaCustomersUnitOfWork(
      createPrismaGeneralTransactionalAuditWriter,
      createPrismaPrivilegedAuditWriter,
    );
    const denialAudit = createPrismaDenialAuditWriter();
    const principal = {
      userId,
      sessionId: `session-${userId}`,
      accountCategories: ["INDIVIDUAL"] as const,
      verifiedCategories: ["INDIVIDUAL"] as const,
      pendingCategories: [],
      status: "ACTIVE" as const,
      verificationOnly: false,
    };

    const profiles = new ProfileService(
      unitOfWork,
      new PrismaProfileRepository(),
      denialAudit,
    );
    await profiles.upsert({
      principal,
      input: { category: "INDIVIDUAL", fullName: "FR035 Reader" },
    });

    const country = await getPrismaClient().country.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true, code: true },
    });
    const addresses = new AddressService(
      unitOfWork,
      new PrismaAddressRepository(),
      { resolveActiveCountry: async () => ({ id: country.id }) },
      denialAudit,
    );
    const address = await addresses.create({
      principal,
      input: {
        countryCode: country.code,
        city: "Cairo",
        district: "Maadi",
        addressText: "FR035 Street",
        building: null,
        floor: null,
        notes: null,
      },
    });

    const preferences = new PreferencesService(
      unitOfWork,
      new PrismaPreferencesRepository(),
      new IdentityContactRead({
        readContactFacts: async (id) => {
          const user = await getPrismaClient().user.findUniqueOrThrow({
            where: { id },
            select: {
              phoneE164: true,
              emailNormalized: true,
              phoneVerifiedAt: true,
              emailVerifiedAt: true,
            },
          });
          return user;
        },
      }),
      denialAudit,
    );
    await preferences.replace(principal, {
      version: 1,
      language: "EN",
      reminders: { sms: false, push: false },
      promotional: { sms: false, push: false },
      mandatory: {
        security: { sms: true, push: true },
        activeService: { sms: true, push: true },
      },
    });

    const privacy = new PrivacyRequestService(
      unitOfWork,
      new PrismaPrivacyRequestRepository(),
      30,
      denialAudit,
    );
    const privacyRequest = await privacy.submit(principal, "EXPORT");

    const media: MediaStoragePort = {
      storeProfileImage: async ({ storageKey }) => ({
        provider: "CLOUDINARY",
        storageKey,
        contentType: "image/webp",
        byteSize: 32,
        width: 24,
        height: 24,
        uploadResourceType: "image" as const,
        uploadType: "authenticated" as const,
      }),
      createAuthorizedDeliveryUrl: async (_ref, expiresAt) => ({
        url: "https://res.cloudinary.test/authenticated/fr035",
        urlExpiresAt: expiresAt.toISOString(),
      }),
      remove: async () => ({ destroyResult: "ok" as const }),
    };
    const images = new ProfileImageService(
      unitOfWork,
      media,
      new SharpProfileImageProcessor(),
      createMediaPendingUploadPort(),
      new PrismaProfileRepository(),
      denialAudit,
      "cleanora/customer-profile-images",
      900,
    );
    const jpeg = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .jpeg()
      .toBuffer();
    await images.put({
      principal,
      bytes: jpeg,
      expectedAssociationVersion: 1,
    });

    const beforeReads = await getPrismaClient().auditLog.count({
      where: {
        actorId: userId,
        action: { in: [...PERSONAL_CONTENT_READ_ACTIONS] },
      },
    });

    await profiles.get({ principal, category: "INDIVIDUAL" });
    await images.get(principal);
    await addresses.get(principal, address.id);
    await addresses.list(principal);
    await preferences.contactState(principal);
    await preferences.get(principal);
    await privacy.get(principal, privacyRequest.id);
    await privacy.list(principal);

    const afterReads = await getPrismaClient().auditLog.count({
      where: {
        actorId: userId,
        action: { in: [...PERSONAL_CONTENT_READ_ACTIONS] },
      },
    });
    expect(afterReads).toBe(beforeReads);
    expect(surfaces).toHaveLength(8);
  });
});
