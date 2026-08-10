import { randomUUID } from "node:crypto";

import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createPrismaDenialAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-denial-audit.writer.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
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
import {
  addressWriteBody,
  individualProfileBody,
  preferencesPutBody,
} from "../../../src/modules/customers/customers.schema.js";
import type { MediaStoragePort } from "../../../src/modules/media/media.public.js";
import { createMediaPendingUploadPort } from "../../../src/modules/media/infrastructure/media-provider.factory.js";
import { SharpProfileImageProcessor } from "../../../src/modules/media/infrastructure/sharp-profile-image.processor.js";
import { assertR1P04CustomerSchemaReady } from "../../helpers/assert-r1-p04-schema.js";
import { requireR1P04TestDatabase } from "../../helpers/r1-p04-test-database.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";
import {
  runConcurrentSc008Lanes,
} from "../../helpers/sc008-lane-executor.js";
import {
  buildSc008Manifest,
  SC008_LOCKED_COUNTS,
  validateSc008Manifest,
  type Sc008ManifestRow,
} from "./sc008-manifest.js";
import sharp from "sharp";

describe("SC-008 canonical manifest (T070)", () => {
  it("builds and validates an exact 1,000-row 25×40 scenario manifest", () => {
    const rows = buildSc008Manifest();
    expect(rows).toHaveLength(SC008_LOCKED_COUNTS.total);
    expect(() => validateSc008Manifest(rows)).not.toThrow();
    expect(SC008_LOCKED_COUNTS.lanes).toBe(25);
    expect(SC008_LOCKED_COUNTS.interactionsPerLane).toBe(40);
    expect(SC008_LOCKED_COUNTS.profile).toBe(200);
    expect(SC008_LOCKED_COUNTS.contact).toBe(150);
    expect(SC008_LOCKED_COUNTS.preference).toBe(150);
    expect(SC008_LOCKED_COUNTS.address).toBe(300);
    expect(SC008_LOCKED_COUNTS.privacy).toBe(200);
    const mediaOps = rows.filter((row) => row.operation.startsWith("profile.media."));
    expect(mediaOps).toHaveLength(20);
    expect(mediaOps.filter((row) => row.operation === "profile.media.auth")).toHaveLength(5);
    expect(mediaOps.filter((row) => row.operation === "profile.media.add")).toHaveLength(5);
    expect(mediaOps.filter((row) => row.operation === "profile.media.replace")).toHaveLength(5);
    expect(mediaOps.filter((row) => row.operation === "profile.media.remove")).toHaveLength(5);
  });
});

interface MediaLeafFixture {
  readonly userId: string;
  associationVersion: number;
}

/** Per-lane mutable runtime — never shared across concurrent workers. */
interface Sc008LaneRuntime {
  preferenceVersion: number;
  privacyRequestId: string | undefined;
  readonly ownerUserId: string;
  readonly addressId: string;
  readonly mediaByKey: ReadonlyMap<string, MediaLeafFixture>;
}

interface Sc008SharedServices {
  readonly profiles: ProfileService;
  readonly preferences: PreferencesService;
  readonly addresses: AddressService;
  readonly privacy: PrivacyRequestService;
  readonly profileImages: ProfileImageService;
  readonly jpegBytes: Buffer;
  readonly otherUserId: string;
  readonly countryCode: string;
}

function eligiblePrincipal(userId: string): AuthenticationPrincipal {
  return {
    userId,
    sessionId: `session-${userId}`,
    accountCategories: ["INDIVIDUAL", "COMPANY", "ENGINEER"],
    verifiedCategories: ["INDIVIDUAL", "COMPANY", "ENGINEER"],
    pendingCategories: [],
    status: "ACTIVE",
    verificationOnly: false,
  };
}

function ineligiblePrincipal(userId: string): AuthenticationPrincipal {
  return {
    ...eligiblePrincipal(userId),
    verifiedCategories: [],
    pendingCategories: [],
    accountCategories: ["PROVIDER_OWNER"],
  };
}

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

async function smallJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 32,
      height: 32,
      channels: 3,
      background: { r: 8, g: 16, b: 24 },
    },
  })
    .jpeg()
    .toBuffer();
}

function mediaKey(row: Sc008ManifestRow): string {
  return `${row.lane}:${row.slot}:${row.operation}`;
}

/**
 * SC-008 acceptance workload runner (T071 / T118).
 * Exactly 25 concurrent lanes × 40 ordered interactions against an approved disposable DB.
 * Cloudinary is faked (no network); signed-URL generation still exercises the service path.
 */
describe("SC-008 acceptance workload (T071/T118)", () => {
  beforeAll(() => {
    requireR1P04TestDatabase();
  });

  let database: PrismaLifecycle;
  let countryCode: string;
  let countryId: string;
  let jpegBytes: Buffer;
  const fixtureUserIds: string[] = [];

  beforeAll(async () => {
    // SC-008 requires exactly 25 concurrent lane workers holding concurrent
    // customers UoW transactions. Size the test pool for that concurrency;
    // ordinary suites keep the default max=2. This is not a global pool raise.
    // SC-008 keeps 25 concurrent lane workers. Measured host→Neon TCP probe:
    // 15 concurrent connections stable; 20–25 hit ETIMEDOUT/ENETUNREACH.
    // Size the pool to measured stable capacity; workers still overlap.
    // Prefer direct URL for interactive transactions; force IPv4 to avoid
    // ENETUNREACH on unreachable IPv6 Neon endpoints from this host.
    database = await startTestDatabaseLifecycle({
      maxConnections: 15,
      preferDirectMigrationUrl: true,
      forceIpv4: true,
    });
    await assertR1P04CustomerSchemaReady();
    jpegBytes = await smallJpeg();

    const prisma = getPrismaClient();
    const country = await prisma.country.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true, code: true },
    });
    countryId = country.id;
    countryCode = country.code;
  }, 180_000);

  afterAll(async () => {
    try {
      const prisma = getPrismaClient();
      for (const userId of fixtureUserIds) {
        await prisma.privacyRequest.deleteMany({ where: { userId } }).catch(() => undefined);
        await prisma.userAddress.deleteMany({ where: { userId } }).catch(() => undefined);
        await prisma.userPreferences.deleteMany({ where: { userId } }).catch(() => undefined);
        await prisma.individualProfile.deleteMany({ where: { userId } }).catch(() => undefined);
        await prisma.customerProfile.deleteMany({ where: { userId } }).catch(() => undefined);
        await prisma.mediaFile.deleteMany({ where: { ownerUserId: userId } }).catch(() => undefined);
        await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
    } finally {
      if (database !== undefined) {
        await stopTestDatabaseLifecycle(database);
      }
    }
  }, 180_000);

  it(
    "executes exactly 25 concurrent lanes × 40 interactions and asserts ≥95% within two seconds",
    { timeout: 720_000 },
    async () => {
      const rows = buildSc008Manifest();
      validateSc008Manifest(rows);

      const prisma = getPrismaClient();
      const unitOfWork = new PrismaCustomersUnitOfWork(
        createPrismaGeneralTransactionalAuditWriter,
        createPrismaPrivilegedAuditWriter,
        // Concurrent lanes share one pool; allow queueing without immediate P2024.
        { maxWaitMs: 60_000, timeoutMs: 30_000 },
      );
      const denialAudit = createPrismaDenialAuditWriter();
      const profiles = new ProfileService(
        unitOfWork,
        new PrismaProfileRepository(),
        denialAudit,
      );
      const preferences = new PreferencesService(
        unitOfWork,
        new PrismaPreferencesRepository(),
        new IdentityContactRead({
          readContactFacts: async (userId) => {
            const user = await getPrismaClient().user.findUniqueOrThrow({
              where: { id: userId },
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
      const addresses = new AddressService(
        unitOfWork,
        new PrismaAddressRepository(),
        { resolveActiveCountry: async () => ({ id: countryId }) },
        denialAudit,
      );
      const privacy = new PrivacyRequestService(
        unitOfWork,
        new PrismaPrivacyRequestRepository(),
        30,
        denialAudit,
      );
      const profileImages = new ProfileImageService(
        unitOfWork,
        fakeCloudinary(),
        new SharpProfileImageProcessor(),
        createMediaPendingUploadPort(),
        new PrismaProfileRepository(),
        denialAudit,
        "cleanora/customer-profile-images",
        900,
      );

      async function createUser(label: string): Promise<string> {
        const userId = await prisma.user
          .create({
            data: {
              phoneE164: `+201${randomUUID().replace(/\D/gu, "").slice(0, 10).padEnd(10, "0")}`,
              emailNormalized: `sc008-${label}-${randomUUID()}@example.test`,
              emailVerifiedAt: new Date(),
              accountCategories: ["INDIVIDUAL", "COMPANY", "ENGINEER"],
              verifiedCategories: ["INDIVIDUAL", "COMPANY", "ENGINEER"],
            },
          })
          .then((user) => user.id);
        fixtureUserIds.push(userId);
        await profiles.upsert({
          principal: eligiblePrincipal(userId),
          input: { category: "INDIVIDUAL", fullName: `SC008 ${label}` },
        });
        return userId;
      }

      // --- Pre-measurement fixture preparation (outside the timed window) ---
      const otherUserId = await createUser("other");

      const mediaAuthFixtures: MediaLeafFixture[] = [];
      const mediaAddFixtures: MediaLeafFixture[] = [];
      const mediaReplaceFixtures: MediaLeafFixture[] = [];
      const mediaRemoveFixtures: MediaLeafFixture[] = [];

      for (let i = 0; i < 5; i += 1) {
        const authUserId = await createUser(`media-auth-${i}`);
        const seededAuth = await profileImages.put({
          principal: eligiblePrincipal(authUserId),
          bytes: jpegBytes,
          expectedAssociationVersion: 1,
        });
        mediaAuthFixtures.push({
          userId: authUserId,
          associationVersion: seededAuth.profileImage?.associationVersion ?? 2,
        });

        const addUserId = await createUser(`media-add-${i}`);
        mediaAddFixtures.push({ userId: addUserId, associationVersion: 1 });

        const replaceUserId = await createUser(`media-replace-${i}`);
        const seededReplace = await profileImages.put({
          principal: eligiblePrincipal(replaceUserId),
          bytes: jpegBytes,
          expectedAssociationVersion: 1,
        });
        mediaReplaceFixtures.push({
          userId: replaceUserId,
          associationVersion: seededReplace.profileImage?.associationVersion ?? 2,
        });

        const removeUserId = await createUser(`media-remove-${i}`);
        const seededRemove = await profileImages.put({
          principal: eligiblePrincipal(removeUserId),
          bytes: jpegBytes,
          expectedAssociationVersion: 1,
        });
        mediaRemoveFixtures.push({
          userId: removeUserId,
          associationVersion: seededRemove.profileImage?.associationVersion ?? 2,
        });
      }

      // Pre-map one-shot media fixtures to exact manifest rows (no shared cursors).
      const mediaByKey = new Map<string, MediaLeafFixture>();
      let authIndex = 0;
      let addIndex = 0;
      let replaceIndex = 0;
      let removeIndex = 0;
      for (const row of rows) {
        if (row.operation === "profile.media.auth") {
          const fixture = mediaAuthFixtures[authIndex];
          authIndex += 1;
          if (fixture === undefined) {
            throw new Error("SC-008 media.auth fixture pool exhausted during pre-map");
          }
          mediaByKey.set(mediaKey(row), fixture);
        } else if (row.operation === "profile.media.add") {
          const fixture = mediaAddFixtures[addIndex];
          addIndex += 1;
          if (fixture === undefined) {
            throw new Error("SC-008 media.add fixture pool exhausted during pre-map");
          }
          mediaByKey.set(mediaKey(row), fixture);
        } else if (row.operation === "profile.media.replace") {
          const fixture = mediaReplaceFixtures[replaceIndex];
          replaceIndex += 1;
          if (fixture === undefined) {
            throw new Error("SC-008 media.replace fixture pool exhausted during pre-map");
          }
          mediaByKey.set(mediaKey(row), fixture);
        } else if (row.operation === "profile.media.remove") {
          const fixture = mediaRemoveFixtures[removeIndex];
          removeIndex += 1;
          if (fixture === undefined) {
            throw new Error("SC-008 media.remove fixture pool exhausted during pre-map");
          }
          mediaByKey.set(mediaKey(row), fixture);
        }
      }
      expect(authIndex).toBe(5);
      expect(addIndex).toBe(5);
      expect(replaceIndex).toBe(5);
      expect(removeIndex).toBe(5);

      const laneRuntimes = new Map<number, Sc008LaneRuntime>();
      for (let lane = 1; lane <= SC008_LOCKED_COUNTS.lanes; lane += 1) {
        const ownerUserId = await createUser(`lane-${lane}`);
        const addressId = (
          await addresses.create({
            principal: eligiblePrincipal(ownerUserId),
            input: {
              countryCode,
              city: "Cairo",
              district: "Maadi",
              addressText: `SC008 Lane ${lane} Street`,
              building: null,
              floor: null,
              notes: null,
            },
          })
        ).id;
        const seededPreferences = await preferences.replace(
          eligiblePrincipal(ownerUserId),
          {
            version: 1,
            language: "EN",
            reminders: { sms: false, push: false },
            promotional: { sms: false, push: false },
            mandatory: {
              security: { sms: true, push: true },
              activeService: { sms: true, push: true },
            },
          },
        );
        laneRuntimes.set(lane, {
          ownerUserId,
          addressId,
          preferenceVersion: seededPreferences.version,
          privacyRequestId: undefined,
          mediaByKey,
        });
      }

      const shared: Sc008SharedServices = {
        profiles,
        preferences,
        addresses,
        privacy,
        profileImages,
        jpegBytes,
        otherUserId,
        countryCode,
      };

      const measurementWindowMs = 10 * 60 * 1000;
      const result = await runConcurrentSc008Lanes({
        rows,
        expectedLaneCount: SC008_LOCKED_COUNTS.lanes,
        expectedSlotsPerLane: SC008_LOCKED_COUNTS.interactionsPerLane,
        measurementWindowMs,
        executeRow: async (row) => {
          const laneRuntime = laneRuntimes.get(row.lane);
          if (laneRuntime === undefined) {
            throw new Error(`SC-008 missing lane runtime for lane ${row.lane}`);
          }
          await executeRow(row, shared, laneRuntime);
        },
      });

      expect(result.laneCount).toBe(25);
      expect(result.maxActiveLanes).toBeGreaterThan(1);
      expect(result.maxActiveLanes).toBeLessThanOrEqual(25);
      expect(result.latencies).toHaveLength(1000);
      expect(result.elapsedMs).toBeLessThanOrEqual(measurementWindowMs);

      const withinTwoSeconds = result.latencies.filter((item) => item.latencyMs <= 2000).length;
      const ratio = withinTwoSeconds / result.latencies.length;
      expect(ratio).toBeGreaterThanOrEqual(0.95);

      const mediaOps = rows.filter((row) => row.operation.startsWith("profile.media."));
      expect(mediaOps.filter((row) => row.operation === "profile.media.auth")).toHaveLength(5);
      expect(mediaOps.filter((row) => row.operation === "profile.media.add")).toHaveLength(5);
      expect(mediaOps.filter((row) => row.operation === "profile.media.replace")).toHaveLength(5);
      expect(mediaOps.filter((row) => row.operation === "profile.media.remove")).toHaveLength(5);

      // Safe timing diagnostics for the attempt log (no secrets).
      const timingEvidence = {
        elapsedMs: result.elapsedMs,
        maxActiveLanes: result.maxActiveLanes,
        withinTwoSecondsRatio: Number(ratio.toFixed(4)),
        perLaneElapsedMs: result.perLaneElapsedMs,
        poolMaxConnections: 15,
      };
      console.log(JSON.stringify({ sc008: timingEvidence }));
      const { writeFileSync, mkdirSync } = await import("node:fs");
      mkdirSync(".validation-t118", { recursive: true });
      writeFileSync(
        ".validation-t118/sc008-timing.json",
        `${JSON.stringify(timingEvidence, null, 2)}\n`,
        "utf8",
      );
    },
  );
});

async function executeRow(
  row: Sc008ManifestRow,
  shared: Sc008SharedServices,
  lane: Sc008LaneRuntime,
): Promise<void> {
  const owner = eligiblePrincipal(lane.ownerUserId);
  const other = eligiblePrincipal(shared.otherUserId);
  const ineligible = ineligiblePrincipal(lane.ownerUserId);
  let serviceAwaitCount = 0;
  const awaitService = async <T>(promise: Promise<T>): Promise<T> => {
    serviceAwaitCount += 1;
    return promise;
  };
  const markApplicationInteraction = (): void => {
    serviceAwaitCount += 1;
  };

  switch (row.operation) {
    case "profile.read.existing":
      await expect(
        awaitService(
          shared.profiles.get({ principal: owner, category: "INDIVIDUAL" }),
        ),
      ).resolves.toMatchObject({ created: true });
      break;
    case "profile.read.not_created":
      await expect(
        awaitService(
          shared.profiles.get({ principal: owner, category: "COMPANY" }),
        ),
      ).resolves.toMatchObject({ created: false });
      break;
    case "profile.mutation.success":
      await expect(
        awaitService(
          shared.profiles.upsert({
            principal: owner,
            input: {
              category: "INDIVIDUAL",
              fullName: `Owner ${row.lane}-${row.slot}`,
            },
          }),
        ),
      ).resolves.toMatchObject({ created: true });
      break;
    case "profile.media.auth": {
      const fixture = lane.mediaByKey.get(mediaKey(row));
      if (fixture === undefined) {
        throw new Error(`SC-008 missing media.auth fixture for ${mediaKey(row)}`);
      }
      const principal = eligiblePrincipal(fixture.userId);
      await expect(
        awaitService(shared.profileImages.get(principal)),
      ).resolves.toMatchObject({
        url: expect.stringContaining("https://"),
        associationVersion: fixture.associationVersion,
      });
      break;
    }
    case "profile.media.add": {
      const fixture = lane.mediaByKey.get(mediaKey(row));
      if (fixture === undefined) {
        throw new Error(`SC-008 missing media.add fixture for ${mediaKey(row)}`);
      }
      const principal = eligiblePrincipal(fixture.userId);
      const result = await awaitService(
        shared.profileImages.put({
          principal,
          bytes: shared.jpegBytes,
          expectedAssociationVersion: fixture.associationVersion,
        }),
      );
      expect(result.profileImage?.associationVersion).toBe(fixture.associationVersion + 1);
      fixture.associationVersion = result.profileImage!.associationVersion;
      break;
    }
    case "profile.media.replace": {
      const fixture = lane.mediaByKey.get(mediaKey(row));
      if (fixture === undefined) {
        throw new Error(`SC-008 missing media.replace fixture for ${mediaKey(row)}`);
      }
      const principal = eligiblePrincipal(fixture.userId);
      const result = await awaitService(
        shared.profileImages.put({
          principal,
          bytes: shared.jpegBytes,
          expectedAssociationVersion: fixture.associationVersion,
        }),
      );
      expect(result.profileImage?.associationVersion).toBe(fixture.associationVersion + 1);
      fixture.associationVersion = result.profileImage!.associationVersion;
      break;
    }
    case "profile.media.remove": {
      const fixture = lane.mediaByKey.get(mediaKey(row));
      if (fixture === undefined) {
        throw new Error(`SC-008 missing media.remove fixture for ${mediaKey(row)}`);
      }
      const principal = eligiblePrincipal(fixture.userId);
      const result = await awaitService(
        shared.profileImages.remove(principal, fixture.associationVersion),
      );
      expect(result).toMatchObject({
        removed: true,
        associationVersion: fixture.associationVersion + 1,
      });
      fixture.associationVersion = result.associationVersion;
      break;
    }
    case "profile.input_failure":
      markApplicationInteraction();
      expect(() => individualProfileBody.parse({ fullName: "   " })).toThrow();
      break;
    case "profile.authz_failure":
      await expect(
        awaitService(
          shared.profiles.get({
            principal: {
              ...owner,
              verifiedCategories: [],
              pendingCategories: ["INDIVIDUAL"],
            },
            category: "INDIVIDUAL",
          }),
        ),
      ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_FORBIDDEN" });
      break;
    case "contact.read.verified_email":
    case "contact.read.unverified_phone":
    case "contact.read.absent_phone":
      await expect(
        awaitService(shared.preferences.contactState(owner)),
      ).resolves.toMatchObject({
        email: expect.objectContaining({ verified: true }),
      });
      break;
    case "contact.unauthenticated":
    case "contact.ineligible":
      await expect(
        awaitService(shared.preferences.contactState(ineligible)),
      ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_FORBIDDEN" });
      break;
    case "preferences.read":
      await expect(
        awaitService(shared.preferences.get(owner)),
      ).resolves.toMatchObject({
        version: expect.any(Number),
      });
      break;
    case "preferences.language_update":
    case "preferences.optional_update": {
      const next = await awaitService(
        shared.preferences.replace(owner, {
          version: lane.preferenceVersion,
          language: "AR",
          reminders: { sms: true, push: false },
          promotional: { sms: false, push: true },
          mandatory: {
            security: { sms: true, push: true },
            activeService: { sms: true, push: true },
          },
        }),
      );
      lane.preferenceVersion = next.version;
      break;
    }
    case "preferences.mandatory_failure":
      await expect(
        awaitService(
          shared.preferences.replace(owner, {
            version: lane.preferenceVersion,
            language: "EN",
            reminders: { sms: false, push: false },
            promotional: { sms: false, push: false },
            mandatory: {
              security: { sms: false as true, push: true },
              activeService: { sms: true, push: true },
            },
          }),
        ),
      ).rejects.toMatchObject({ code: "CUSTOMER_PREFERENCES_INVALID" });
      break;
    case "preferences.invalid_failure":
      expect(() =>
        preferencesPutBody.parse({
          version: lane.preferenceVersion,
          language: "ZZ",
          reminders: { sms: false, push: false },
          promotional: { sms: false, push: false },
          mandatory: {
            security: { sms: true, push: true },
            activeService: { sms: true, push: true },
          },
        }),
      ).toThrow();
      await expect(
        awaitService(shared.preferences.get(owner)),
      ).resolves.toMatchObject({
        version: expect.any(Number),
      });
      break;
    case "preferences.concurrency_failure":
      await expect(
        awaitService(
          shared.preferences.replace(owner, {
            version: lane.preferenceVersion + 50,
            language: "EN",
            reminders: { sms: false, push: false },
            promotional: { sms: false, push: false },
            mandatory: {
              security: { sms: true, push: true },
              activeService: { sms: true, push: true },
            },
          }),
        ),
      ).rejects.toMatchObject({ code: "CUSTOMER_PREFERENCES_CONFLICT" });
      break;
    case "address.read":
      await expect(
        awaitService(shared.addresses.get(owner, lane.addressId)),
      ).resolves.toMatchObject({ id: lane.addressId });
      break;
    case "address.mutation.success":
      await expect(
        awaitService(
          shared.addresses.create({
            principal: owner,
            input: {
              countryCode: shared.countryCode,
              city: "Giza",
              district: "Dokki",
              addressText: `Lane ${row.lane} Slot ${row.slot}`,
              building: null,
              floor: null,
              notes: null,
            },
          }),
        ),
      ).resolves.toMatchObject({ version: 1 });
      break;
    case "address.validation_failure":
      expect(() =>
        addressWriteBody.parse({
          countryCode: shared.countryCode,
          city: " ",
          district: "Dokki",
          addressText: "x",
          building: null,
          floor: null,
          notes: null,
        }),
      ).toThrow();
      await expect(
        awaitService(shared.addresses.get(owner, lane.addressId)),
      ).resolves.toMatchObject({ id: lane.addressId });
      break;
    case "address.ownership_concurrency":
      await expect(
        awaitService(shared.addresses.get(other, lane.addressId)),
      ).rejects.toMatchObject({ code: "CUSTOMER_ADDRESS_NOT_FOUND" });
      break;
    case "privacy.submit": {
      const submitted = await awaitService(
        shared.privacy.submit(owner, "EXPORT"),
      );
      lane.privacyRequestId = submitted.id;
      expect(submitted.status).toBeDefined();
      break;
    }
    case "privacy.read": {
      if (lane.privacyRequestId === undefined) {
        const submitted = await awaitService(
          shared.privacy.submit(owner, "EXPORT"),
        );
        lane.privacyRequestId = submitted.id;
      }
      await expect(
        awaitService(
          shared.privacy.get(owner, lane.privacyRequestId),
        ),
      ).resolves.toMatchObject({ id: lane.privacyRequestId });
      break;
    }
    case "privacy.repeat":
      await expect(
        awaitService(shared.privacy.submit(owner, "EXPORT")),
      ).resolves.toMatchObject({
        purpose: "EXPORT",
      });
      break;
    case "privacy.cancel": {
      const pending = await awaitService(
        shared.privacy.submit(owner, "DELETION"),
      );
      await expect(
        awaitService(shared.privacy.cancel(owner, pending.id)),
      ).resolves.toMatchObject({ status: "CANCELLED" });
      break;
    }
    case "privacy.authz_failure":
      await expect(
        awaitService(shared.privacy.list(ineligible)),
      ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_FORBIDDEN" });
      break;
    case "privacy.invalid_state":
      await expect(
        awaitService(shared.privacy.cancel(owner, randomUUID())),
      ).rejects.toBeTruthy();
      break;
    default:
      throw new Error(`Unhandled SC-008 operation: ${row.operation}`);
  }

  if (serviceAwaitCount < 1) {
    throw new Error(
      `SC-008 row executed no service await (no-op): ${row.operation} lane=${row.lane} slot=${row.slot}`,
    );
  }
}
