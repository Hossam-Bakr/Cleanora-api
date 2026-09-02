import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";
import { buildCatalogCommandScopeKey } from "../../../src/modules/catalog/catalog.policy.js";
import {
  createConnectedMigrationProofCatalogClient,
  createLiveCatalogRepository,
  ensureR1P08CatalogDatabaseMigrated,
  hasExplicitR1P08CatalogDatabase,
  LIVE_CATALOG_TRANSACTION_OPTIONS,
  requireR1P08CatalogDatabaseUrl,
} from "../../helpers/r1-p08-catalog-live.js";

vi.setConfig({ testTimeout: 180_000 });

const databaseUrl = hasExplicitR1P08CatalogDatabase()
  ? requireR1P08CatalogDatabaseUrl()
  : undefined;
const databaseDescribe = databaseUrl === undefined ? describe.skip : describe.sequential;

databaseDescribe("catalog actor-scoped idempotency (live disposable)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    if (databaseUrl === undefined) {
      throw new Error("CLEANORA_R1_P08_DATABASE_URL is required");
    }
    await ensureR1P08CatalogDatabaseMigrated(databaseUrl);
    prisma = await createConnectedMigrationProofCatalogClient(databaseUrl);
  });

  beforeEach(async () => {
    await prisma.catalogCommandRequest.deleteMany({
      where: {
        OR: [
          { scopeKey: { startsWith: "catalog:actor-idem.probe:" } },
          { actorUserId: { startsWith: "actor-idem" } },
        ],
      },
    });
  });

  afterAll(async () => {
    if (prisma !== undefined) {
      try {
        await prisma.catalogCommandRequest.deleteMany({
          where: {
            OR: [
              { scopeKey: { startsWith: "catalog:actor-idem" } },
              { actorUserId: { startsWith: "actor-idem" } },
            ],
          },
        });
      } finally {
        await prisma.$disconnect();
      }
    }
  });

  const scopeKey = buildCatalogCommandScopeKey({
    operation: "actor-idem.probe",
    targetType: "CATEGORY",
    targetId: null,
  });
  const idempotencyKey = "00000000-0000-4000-8000-00000000B01";
  const requestHash = "c".repeat(64);

  it("replays same actor + scope/key + fingerprint deterministically", async () => {
    const repo = createLiveCatalogRepository(prisma);
    const actorUserId = "actor-idem-a";

    await prisma.$transaction(async (tx) => {
      const first = await repo.reserveOrReplayCommand(tx as never, {
        scopeKey,
        idempotencyKey,
        requestHash,
        actorUserId,
        targetType: "CATEGORY",
        pending: true,
        reservedMediaFileId: "media-reserved-a",
      });
      expect(first).toMatchObject({
        status: "PENDING",
        replayed: false,
        reservedMediaFileId: "media-reserved-a",
      });

      const replay = await repo.reserveOrReplayCommand(tx as never, {
        scopeKey,
        idempotencyKey,
        requestHash,
        actorUserId,
        targetType: "CATEGORY",
        pending: true,
        reservedMediaFileId: "media-reserved-a",
      });
      expect(replay).toMatchObject({
        status: "PENDING",
        replayed: true,
        reservedMediaFileId: "media-reserved-a",
      });
    }, LIVE_CATALOG_TRANSACTION_OPTIONS);
  });

  it("rejects same actor + scope/key + different fingerprint", async () => {
    const repo = createLiveCatalogRepository(prisma);
    const actorUserId = "actor-idem-conflict";

    await prisma.$transaction(async (tx) => {
      await repo.reserveOrReplayCommand(tx as never, {
        scopeKey,
        idempotencyKey: "00000000-0000-4000-8000-00000000B02",
        requestHash,
        actorUserId,
        targetType: "CATEGORY",
        pending: true,
        reservedMediaFileId: "media-reserved-b",
      });
      await expect(
        repo.reserveOrReplayCommand(tx as never, {
          scopeKey,
          idempotencyKey: "00000000-0000-4000-8000-00000000B02",
          requestHash: "d".repeat(64),
          actorUserId,
          targetType: "CATEGORY",
          pending: true,
          reservedMediaFileId: "media-reserved-b",
        }),
      ).rejects.toMatchObject({ code: "CATALOG_IDEMPOTENCY_CONFLICT" });
    }, LIVE_CATALOG_TRANSACTION_OPTIONS);
  });

  it("allows different actors with the same scope/key to proceed independently", async () => {
    const repo = createLiveCatalogRepository(prisma);

    await prisma.$transaction(async (tx) => {
      const actorA = await repo.reserveOrReplayCommand(tx as never, {
        scopeKey,
        idempotencyKey: "00000000-0000-4000-8000-00000000B03",
        requestHash,
        actorUserId: "actor-idem-a2",
        targetType: "CATEGORY",
        pending: true,
        reservedMediaFileId: "media-a2",
      });
      const actorB = await repo.reserveOrReplayCommand(tx as never, {
        scopeKey,
        idempotencyKey: "00000000-0000-4000-8000-00000000B03",
        requestHash,
        actorUserId: "actor-idem-b2",
        targetType: "CATEGORY",
        pending: true,
        reservedMediaFileId: "media-b2",
      });
      expect(actorA).toMatchObject({ replayed: false, reservedMediaFileId: "media-a2" });
      expect(actorB).toMatchObject({ replayed: false, reservedMediaFileId: "media-b2" });
      if (actorA === "proceed" || actorB === "proceed") {
        throw new Error("Expected command receipts");
      }
      expect(actorA.id).not.toBe(actorB.id);
    }, LIVE_CATALOG_TRANSACTION_OPTIONS);
  });

  it("rejects PENDING without reserved media identity at the repository boundary", async () => {
    const repo = createLiveCatalogRepository(prisma);
    await expect(
      prisma.$transaction(
        (tx) =>
          repo.reserveOrReplayCommand(tx as never, {
            scopeKey,
            idempotencyKey: "00000000-0000-4000-8000-00000000B04",
            requestHash,
            actorUserId: "actor-idem-pending",
            targetType: "SERVICE_MEDIA",
            pending: true,
            reservedMediaFileId: "",
          } as never),
        LIVE_CATALOG_TRANSACTION_OPTIONS,
      ),
    ).rejects.toBeInstanceOf(CatalogError);
  });
});
