import { randomUUID } from "node:crypto";

import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createPrismaDenialAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-denial-audit.writer.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import { ProfileImageService } from "../../../src/modules/customers/profile-image.service.js";
import { PrismaCustomersUnitOfWork } from "../../../src/modules/customers/infrastructure/prisma-customers.unit-of-work.js";
import { PrismaProfileRepository } from "../../../src/modules/customers/infrastructure/prisma-profile.repository.js";
import { createMediaPendingUploadPort } from "../../../src/modules/media/infrastructure/media-provider.factory.js";
import type { MediaStoragePort } from "../../../src/modules/media/media.public.js";
import { SharpProfileImageProcessor } from "../../../src/modules/media/infrastructure/sharp-profile-image.processor.js";
import { assertR1P04CustomerSchemaReady } from "../../helpers/assert-r1-p04-schema.js";
import { requireR1P04TestDatabase } from "../../helpers/r1-p04-test-database.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";
import sharp from "sharp";

const principal = (userId: string) => ({
  userId,
  sessionId: `session-${userId}`,
  accountCategories: ["INDIVIDUAL"] as const,
  verifiedCategories: ["INDIVIDUAL"] as const,
  pendingCategories: [],
  status: "ACTIVE" as const,
  verificationOnly: false,
});

function fakeCloudinary(): MediaStoragePort {
  return {
    storeProfileImage: async ({ storageKey }) => ({
      provider: "CLOUDINARY",
      storageKey,
      contentType: "image/webp",
      byteSize: 64,
      width: 32,
      height: 32,
      uploadResourceType: "image" as const,
      uploadType: "authenticated" as const,
    }),
    createAuthorizedDeliveryUrl: async (_reference, expiresAt) => ({
      url: `https://res.cloudinary.test/authenticated/${_reference.storageKey}`,
      urlExpiresAt: expiresAt.toISOString(),
    }),
      remove: async () => ({ destroyResult: "ok" as const }),
  };
}

function createProfileImageService(): ProfileImageService {
  return new ProfileImageService(
    new PrismaCustomersUnitOfWork(
      createPrismaGeneralTransactionalAuditWriter,
      createPrismaPrivilegedAuditWriter,
    ),
    fakeCloudinary(),
    new SharpProfileImageProcessor(),
    createMediaPendingUploadPort(),
    new PrismaProfileRepository(),
    createPrismaDenialAuditWriter(),
    "cleanora/customer-profile-images",
    900,
  );
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

describe("US1 profile image integration (DEC-033)", () => {
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
          emailNormalized: `profile-image-${randomUUID()}@example.test`,
          emailVerifiedAt: new Date(),
          accountCategories: ["INDIVIDUAL"],
          verifiedCategories: ["INDIVIDUAL"],
        },
      })
      .then((user) => user.id);
  });

  afterEach(async () => {
    const prisma = getPrismaClient();
    await prisma.customerProfile.deleteMany({ where: { userId } });
    await prisma.mediaFile.deleteMany({ where: { ownerUserId: userId } });
    await prisma.user.delete({ where: { id: userId } });
  });

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it("associates via CAS, returns signed URL JSON shape, and does not audit successful GET", { timeout: 120000 }, async () => {
    const service = createProfileImageService();

    expect(await service.get(principal(userId))).toBeNull();

    const beforePut = await getPrismaClient().auditLog.count({
      where: { actorId: userId },
    });
    const aggregate = await service.put({
      principal: principal(userId),
      bytes: await smallJpeg(),
      expectedAssociationVersion: 1,
    });
    expect(aggregate.profileImage).toMatchObject({
      url: expect.stringContaining("https://"),
      associationVersion: 2,
      contentType: "image/webp",
    });
    expect(JSON.stringify(aggregate.profileImage)).not.toMatch(/storageKey|public_id/iu);

    const beforeGet = await getPrismaClient().auditLog.count({
      where: { actorId: userId },
    });
    const delivery = await service.get(principal(userId));
    expect(delivery?.url).toContain("https://");
    expect(await getPrismaClient().auditLog.count({ where: { actorId: userId } })).toBe(
      beforeGet,
    );
    expect(beforeGet).toBeGreaterThan(beforePut);

    await expect(
      service.put({
        principal: principal(userId),
        bytes: await smallJpeg(),
        expectedAssociationVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_IMAGE_CONFLICT" });

    await expect(
      service.remove(principal(userId), 2),
    ).resolves.toMatchObject({ removed: true, associationVersion: 3 });
  });

  it("allows only one concurrent first association on empty profile", { timeout: 120000 }, async () => {
    const service = createProfileImageService();
    const bytes = await smallJpeg();
    const results = await Promise.allSettled([
      service.put({
        principal: principal(userId),
        bytes,
        expectedAssociationVersion: 1,
      }),
      service.put({
        principal: principal(userId),
        bytes,
        expectedAssociationVersion: 1,
      }),
    ]);

    const succeeded = results.filter((result) => result.status === "fulfilled");
    const failed = results.filter((result) => result.status === "rejected");
    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "CUSTOMER_PROFILE_IMAGE_CONFLICT",
    });

    const prisma = getPrismaClient();
    const profile = await prisma.customerProfile.findUniqueOrThrow({
      where: { userId },
      include: { profileImageMediaFile: true },
    });
    expect(profile.imageAssociationVersion).toBe(2);
    expect(profile.profileImageMediaFile?.status).toBe("READY");

    const media = await prisma.mediaFile.findMany({ where: { ownerUserId: userId } });
    const ready = media.filter((row) => row.status === "READY");
    const losers = media.filter(
      (row) => row.status === "PENDING_DELETE" || row.status === "DELETED",
    );
    expect(ready).toHaveLength(1);
    expect(ready[0]?.id).toBe(profile.profileImageMediaFileId);
    expect(losers.length).toBeGreaterThanOrEqual(1);
  });
});
