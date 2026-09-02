import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import type { RequestHandler } from "express";
import pg from "pg";

import { seed, seedR1P08Catalog } from "../../prisma/seed.js";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { createCatalogRouter } from "../../src/modules/catalog/catalog.routes.js";
import { CatalogService } from "../../src/modules/catalog/catalog.service.js";
import type { Logger } from "../../src/shared/logger.js";
import { createTestApp } from "./create-test-app.js";
import { createTestEnvironment } from "./test-environment.js";
import { TestLogger } from "./test-logger.js";
import {
  assertR1P08DisposableDatabaseUrl,
} from "../../scripts/validate-clean-migration.js";
import { PrismaCatalogRepository } from "../../src/modules/catalog/catalog.repository.js";
import { createPrismaActiveCountryReader } from "../../src/modules/configuration/infrastructure/prisma-active-country.reader.js";
import {
  createTransactionalCatalogServiceImageAuthorizer,
  createTransactionalCatalogServiceMediaFactsReader,
} from "../../src/modules/media/infrastructure/media-provider.factory.js";

const executeFile = promisify(execFile);
const LIVE_CATALOG_POOL_MAX = 1;

/** Neon live proofs need longer interactive transaction windows than Prisma defaults. */
export const LIVE_CATALOG_TRANSACTION_OPTIONS = {
  maxWait: 120_000,
  timeout: 120_000,
} as const;

let migrateDeployPromise: Promise<void> | null = null;
let migrationAppliedCache: boolean | null = null;

function directMigrationConnectionString(connectionString: string): string {
  return connectionString.replace("-pooler", "");
}

async function isR1P08MigrationApplied(connectionString: string): Promise<boolean> {
  if (migrationAppliedCache === true) {
    return true;
  }
  const probe = createMigrationProofCatalogClient(
    directMigrationConnectionString(connectionString),
  );
  try {
    const rows = await probe.$queryRaw<Array<{ migration_name: string }>>`
      SELECT migration_name
      FROM "_prisma_migrations"
      WHERE migration_name = 'r1_p08_catalog_localization_service_requirements'
        AND finished_at IS NOT NULL
      LIMIT 1
    `;
    migrationAppliedCache = rows.length > 0;
    return migrationAppliedCache;
  } finally {
    await probe.$disconnect();
  }
}

/**
 * Database-backed R1-P08 suites fail closed unless the explicitly supplied
 * target matches the approved disposable naming contract.
 */
export function hasExplicitR1P08CatalogDatabase(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = env["CLEANORA_R1_P08_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    assertR1P08DisposableDatabaseUrl(value);
    return true;
  } catch {
    return false;
  }
}

export function requireR1P08CatalogDatabaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const value = env["CLEANORA_R1_P08_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("CLEANORA_R1_P08_DATABASE_URL is required for live Catalog proofs");
  }
  assertR1P08DisposableDatabaseUrl(value);
  return value;
}

/** Apply all chronological migrations to the approved disposable public schema once per process. */
export async function ensureR1P08CatalogDatabaseMigrated(
  connectionString: string,
): Promise<void> {
  if (migrateDeployPromise === null) {
    migrateDeployPromise = (async () => {
      if (await isR1P08MigrationApplied(connectionString)) {
        return;
      }
      const migrationUrl = directMigrationConnectionString(connectionString);
      const prismaCli = join(process.cwd(), "node_modules", "prisma", "build", "index.js");
      await executeFile(process.execPath, [prismaCli, "migrate", "deploy"], {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: migrationUrl },
      });
    })().catch((error: unknown) => {
      migrateDeployPromise = null;
      throw error;
    });
  }
  await migrateDeployPromise;
}

export function createMigrationProofCatalogClient(
  connectionString: string,
): PrismaClient {
  const pool = new pg.Pool({
    connectionString,
    max: LIVE_CATALOG_POOL_MAX,
    allowExitOnIdle: true,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({
    adapter: new PrismaPg(pool, { disposeExternalPool: true }),
  });
}

/** Create and warm one bounded live-proof client before any transaction begins. */
export async function createConnectedMigrationProofCatalogClient(
  connectionString: string,
): Promise<PrismaClient> {
  const prisma = createMigrationProofCatalogClient(connectionString);
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    return prisma;
  } catch (error) {
    await prisma.$disconnect().catch(() => undefined);
    throw error;
  }
}

/** Ensure currency/country/auth reference rows exist before Catalog seeding. */
export async function ensureR1P08ReferenceData(
  prisma: PrismaClient,
): Promise<{ readonly id: string; readonly code: string }> {
  let country = await prisma.country.findUnique({
    where: { code: "EG" },
    select: { id: true, code: true },
  });
  if (country === null) {
    await seed(prisma, { skipCatalogSeed: true });
    country = await prisma.country.findUnique({
      where: { code: "EG" },
      select: { id: true, code: true },
    });
  }
  if (country === null) {
    throw new Error("Catalog live proof requires authoritative country EG");
  }
  return country;
}

/** Seed only the R1-P08 Catalog graph once reference data exists. */
export async function ensureR1P08CatalogSeeded(
  prisma: PrismaClient,
): Promise<void> {
  const country = await ensureR1P08ReferenceData(prisma);
  await seedR1P08Catalog(prisma, country);
}

export function createLiveCatalogRepository(
  prisma: PrismaClient,
): PrismaCatalogRepository {
  return new PrismaCatalogRepository(
    prisma as never,
    (transaction) => createPrismaActiveCountryReader(transaction),
    () => ({ append: async () => undefined }) as never,
    createTransactionalCatalogServiceImageAuthorizer,
    createTransactionalCatalogServiceMediaFactsReader,
  );
}

const noopLogger: Logger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
  child() {
    return this;
  },
};

/** Supertest harness with real CatalogService + repository against a live disposable DB. */
export function createLiveCatalogHttpApp(
  prisma: PrismaClient,
  actorUserId: string,
): ReturnType<typeof createTestApp> {
  const repository = createLiveCatalogRepository(prisma);
  const catalogService = new CatalogService({
    repository,
    logger: noopLogger,
    authorization: {
      authorizeProtectedOperation: async () => ({ allowed: true }),
    },
  });
  const authenticateAccess: RequestHandler = (_request, response, next) => {
    response.locals["authenticationPrincipal"] = {
      userId: actorUserId,
      sessionId: "live-session",
      status: "ACTIVE",
      accountCategories: ["INDIVIDUAL"],
      verifiedCategories: ["INDIVIDUAL"],
      pendingCategories: [],
      verificationOnly: false,
    };
    next();
  };
  const router = createCatalogRouter({ authenticateAccess, catalogService });
  return createTestApp({
    environment: createTestEnvironment(),
    logger: new TestLogger(),
    mountTestRoutes(application) {
      application.use("/api/v1/staff/catalog", router);
    },
  });
}

export async function cleanupCatalogTestRows(
  prisma: PrismaClient,
  scope: {
    readonly actorUserIdPrefix: string;
    readonly recordIdPrefix: string;
    readonly categoryCodePrefix: string;
    readonly serviceCodePrefix: string;
  },
): Promise<void> {
  await prisma.catalogCommandRequest.deleteMany({
    where: {
      OR: [
        { actorUserId: { startsWith: scope.actorUserIdPrefix } },
        { scopeKey: { contains: scope.recordIdPrefix } },
        { targetId: { startsWith: scope.recordIdPrefix } },
      ],
    },
  });

  const services = await prisma.service.findMany({
    where: {
      OR: [
        { id: { startsWith: scope.recordIdPrefix } },
        { code: { startsWith: scope.serviceCodePrefix } },
      ],
    },
    select: { id: true },
  });
  const serviceIds = services.map((service) => service.id);
  if (serviceIds.length > 0) {
    await prisma.serviceMediaAssociation.deleteMany({
      where: { serviceId: { in: serviceIds } },
    });
    await prisma.serviceCountryAvailability.deleteMany({
      where: { serviceId: { in: serviceIds } },
    });
    await prisma.serviceFieldOption.deleteMany({
      where: { serviceField: { serviceId: { in: serviceIds } } },
    });
    await prisma.serviceField.deleteMany({
      where: { serviceId: { in: serviceIds } },
    });
    await prisma.servicePriceUnit.deleteMany({
      where: { serviceId: { in: serviceIds } },
    });
    await prisma.serviceTranslation.deleteMany({
      where: { serviceId: { in: serviceIds } },
    });
    await prisma.service.deleteMany({
      where: { id: { in: serviceIds } },
    });
  }

  await prisma.serviceCategory.deleteMany({
    where: {
      OR: [
        { id: { startsWith: scope.recordIdPrefix } },
        { code: { startsWith: scope.categoryCodePrefix } },
      ],
    },
  });
}
