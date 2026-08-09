import { randomUUID } from "node:crypto";

import type { Express } from "express";
import sharp from "sharp";

import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createPrismaDenialAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-denial-audit.writer.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import { AddressService } from "../../../src/modules/customers/address.service.js";
import { CustomerOverviewService } from "../../../src/modules/customers/customer-overview.service.js";
import { createCustomersRouter } from "../../../src/modules/customers/customers.routes.js";
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
import { SharpProfileImageProcessor } from "../../../src/modules/media/infrastructure/sharp-profile-image.processor.js";
import type { MediaStoragePort } from "../../../src/modules/media/media.public.js";
import { assertR1P04CustomerSchemaReady } from "../../helpers/assert-r1-p04-schema.js";
import { createTestApp } from "../../helpers/create-test-app.js";
import { requireR1P04TestDatabase } from "../../helpers/r1-p04-test-database.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";
import { createTestEnvironment } from "../../helpers/test-environment.js";
import { TestLogger } from "../../helpers/test-logger.js";

const request = require("supertest") as typeof import("supertest");

function activeMultiCategoryPrincipal(userId: string): AuthenticationPrincipal {
  return {
    userId,
    sessionId: `session-${userId}`,
    accountCategories: ["INDIVIDUAL", "COMPANY", "ENGINEER"],
    verifiedCategories: ["INDIVIDUAL", "ENGINEER"],
    pendingCategories: ["COMPANY"],
    status: "ACTIVE",
    verificationOnly: false,
  };
}

function fakeCloudinary(): MediaStoragePort {
  return {
    storeProfileImage: async ({ storageKey }) => ({
      provider: "CLOUDINARY",
      storageKey,
      contentType: "image/webp",
      byteSize: 64,
      width: 48,
      height: 48,
      uploadResourceType: "image" as const,
      uploadType: "authenticated" as const,
    }),
    createAuthorizedDeliveryUrl: async (reference, expiresAt) => ({
      url: `https://res.cloudinary.test/authenticated/${reference.storageKey}`,
      urlExpiresAt: expiresAt.toISOString(),
    }),
    remove: async () => ({ destroyResult: "ok" as const }),
  };
}

async function smallJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 48,
      height: 48,
      channels: 3,
      background: { r: 12, g: 34, b: 56 },
    },
  })
    .jpeg()
    .toBuffer();
}

describe("GET /api/v1/customers/me/overview integration", () => {
  let database: PrismaLifecycle;
  let app: Express;
  let userId: string;
  let currentPrincipal: AuthenticationPrincipal;
  let profiles: ProfileService;
  let profileImages: ProfileImageService;
  let addresses: AddressService;
  let preferences: PreferencesService;
  let logger: TestLogger;

  beforeAll(() => {
    requireR1P04TestDatabase();
  });

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await assertR1P04CustomerSchemaReady();

    const unitOfWork = new PrismaCustomersUnitOfWork(
      createPrismaGeneralTransactionalAuditWriter,
      createPrismaPrivilegedAuditWriter,
    );
    const denialAudit = createPrismaDenialAuditWriter();
    const profileRepository = new PrismaProfileRepository();

    profiles = new ProfileService(unitOfWork, profileRepository, denialAudit);
    profileImages = new ProfileImageService(
      unitOfWork,
      fakeCloudinary(),
      new SharpProfileImageProcessor(),
      createMediaPendingUploadPort(),
      profileRepository,
      denialAudit,
      "cleanora/customer-profile-images",
      900,
    );
    addresses = new AddressService(
      unitOfWork,
      new PrismaAddressRepository(),
      {
        resolveActiveCountry: async (countryCode) => {
          const country = await getPrismaClient().country.findFirstOrThrow({
            where: { code: countryCode, isActive: true },
            select: { id: true },
          });
          return country;
        },
      },
      denialAudit,
    );
    preferences = new PreferencesService(
      unitOfWork,
      new PrismaPreferencesRepository(),
      new IdentityContactRead({
        readContactFacts: async (id) =>
          getPrismaClient().user.findUniqueOrThrow({
            where: { id },
            select: {
              phoneE164: true,
              emailNormalized: true,
              phoneVerifiedAt: true,
              emailVerifiedAt: true,
            },
          }),
      }),
      denialAudit,
    );
    const privacyRequests = new PrivacyRequestService(
      unitOfWork,
      new PrismaPrivacyRequestRepository(),
      30,
      denialAudit,
    );
    const overview = new CustomerOverviewService(
      profiles,
      profileImages,
      addresses,
      preferences,
      denialAudit,
    );
    const router = createCustomersRouter({
      authenticateAccess: (_request, response, next) => {
        response.locals["authenticationPrincipal"] = currentPrincipal;
        next();
      },
      profiles,
      profileImages,
      addresses,
      preferences,
      privacyRequests,
      overview,
    });

    logger = new TestLogger();
    app = createTestApp({
      environment: createTestEnvironment(),
      logger,
      mountTestRoutes(expressApp) {
        expressApp.use("/api/v1/customers", router);
      },
    });
  });

  beforeEach(async () => {
    const identity = randomUUID();
    userId = await getPrismaClient()
      .user.create({
        data: {
          phoneE164: `+201${identity.replace(/\D/gu, "").slice(0, 10).padEnd(10, "0")}`,
          emailNormalized: `overview-${identity}@example.test`,
          emailVerifiedAt: new Date(),
          accountCategories: ["INDIVIDUAL", "COMPANY", "ENGINEER"],
          verifiedCategories: ["INDIVIDUAL", "ENGINEER"],
        },
      })
      .then((user) => user.id);
    currentPrincipal = activeMultiCategoryPrincipal(userId);
  });

  afterEach(async () => {
    const prisma = getPrismaClient();
    await prisma.privacyRequest.deleteMany({ where: { userId } });
    await prisma.userAddress.deleteMany({ where: { userId } });
    await prisma.userPreferences.deleteMany({ where: { userId } });
    await prisma.individualProfile.deleteMany({ where: { userId } });
    await prisma.companyProfile.deleteMany({ where: { userId } });
    await prisma.engineerProfile.deleteMany({ where: { userId } });
    await prisma.customerProfile.deleteMany({ where: { userId } });
    await prisma.mediaFile.deleteMany({ where: { ownerUserId: userId } });
    await prisma.auditLog.deleteMany({ where: { actorId: userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "returns not-created profiles first, then the complete multi-category frontend projection",
    { timeout: 120_000 },
    async () => {
      const initial = await request(app).get("/api/v1/customers/me/overview");

      expect(
        initial.status,
        JSON.stringify({ body: initial.body, log: logger.lastError }),
      ).toBe(200);
      expect(initial.body.data).toMatchObject({
        identity: {
          userId,
          status: "ACTIVE",
          accountCategories: ["INDIVIDUAL", "COMPANY", "ENGINEER"],
          verifiedCategories: ["INDIVIDUAL", "ENGINEER"],
          pendingCategories: ["COMPANY"],
        },
        profiles: [
          { category: "INDIVIDUAL", created: false },
          { category: "ENGINEER", created: false },
        ],
        profileImage: null,
        preferences: {
          version: 1,
          language: null,
          reminders: { sms: false, push: false },
          promotional: { sms: false, push: false },
        },
        addresses: [],
      });
      expect(initial.body.data.contactState).toEqual({
        phone: { value: expect.stringMatching(/^\+201/u), verified: false },
        email: {
          value: expect.stringMatching(/^overview-/u),
          verified: true,
        },
      });

      await profiles.upsert({
        principal: currentPrincipal,
        input: { category: "INDIVIDUAL", fullName: "Aly Oser" },
      });
      await profiles.upsert({
        principal: currentPrincipal,
        input: {
          category: "ENGINEER",
          fullName: "Aly Engineer",
          professionalTitle: "Cleaning Engineer",
        },
      });
      const country = await getPrismaClient().country.findFirstOrThrow({
        where: { isActive: true },
        select: { code: true },
      });
      const address = await addresses.create({
        principal: currentPrincipal,
        input: {
          countryCode: country.code,
          city: "Cairo",
          district: "Nasr City",
          addressText: "Overview Street",
          building: "10",
          floor: "2",
          notes: null,
        },
      });
      await preferences.replace(currentPrincipal, {
        version: 1,
        language: "AR",
        reminders: { sms: true, push: true },
        promotional: { sms: false, push: true },
        mandatory: {
          security: { sms: true, push: true },
          activeService: { sms: true, push: true },
        },
      });
      await profileImages.put({
        principal: currentPrincipal,
        bytes: await smallJpeg(),
        expectedAssociationVersion: 1,
      });

      const auditsBeforeRead = await getPrismaClient().auditLog.count({
        where: { actorId: userId },
      });
      const completed = await request(app).get("/api/v1/customers/me/overview");

      expect(
        completed.status,
        JSON.stringify({ body: completed.body, log: logger.lastError }),
      ).toBe(200);
      expect(completed.body.data.profiles).toEqual([
        {
          category: "INDIVIDUAL",
          created: true,
          fullName: "Aly Oser",
        },
        {
          category: "ENGINEER",
          created: true,
          fullName: "Aly Engineer",
          professionalTitle: "Cleaning Engineer",
        },
      ]);
      expect(completed.body.data.profileImage).toMatchObject({
        mediaId: expect.any(String),
        url: expect.stringContaining("https://res.cloudinary.test/authenticated/"),
        associationVersion: 2,
        contentType: "image/webp",
        width: 48,
        height: 48,
      });
      expect(completed.body.data.preferences).toMatchObject({
        version: 1,
        language: "AR",
        reminders: { sms: true, push: true },
        promotional: { sms: false, push: true },
      });
      expect(completed.body.data.addresses).toEqual([
        expect.objectContaining({
          id: address.id,
          countryCode: country.code,
          city: "Cairo",
          district: "Nasr City",
          addressText: "Overview Street",
          version: 1,
        }),
      ]);
      expect(
        await getPrismaClient().auditLog.count({ where: { actorId: userId } }),
      ).toBe(auditsBeforeRead);
    },
  );

  it.each([
    {
      label: "pending-only identity",
      principal: (id: string): AuthenticationPrincipal => ({
        userId: id,
        sessionId: `session-${id}`,
        accountCategories: ["COMPANY"],
        verifiedCategories: [],
        pendingCategories: ["COMPANY"],
        status: "ACTIVE",
        verificationOnly: true,
      }),
      outcome: "CATEGORY_NOT_VERIFIED",
    },
    {
      label: "inactive identity",
      principal: (id: string): AuthenticationPrincipal => ({
        ...activeMultiCategoryPrincipal(id),
        status: "SUSPENDED",
      }),
      outcome: "IDENTITY_NOT_ACTIVE",
    },
  ])(
    "denies a $label and appends one redacted overview audit",
    async ({ principal, outcome }) => {
      currentPrincipal = principal(userId);

      const response = await request(app).get(
        "/api/v1/customers/me/overview",
      );

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CUSTOMER_PROFILE_FORBIDDEN");
      const audit = await getPrismaClient().auditLog.findFirstOrThrow({
        where: { actorId: userId, action: "customers.overview.read" },
        orderBy: { createdAt: "desc" },
      });
      expect(audit.targetType).toBe("customer_self_service");
      expect(audit.targetId).toBe(userId);
      expect(audit.context).toEqual({ outcome });
    },
  );
});
