/**
 * Prisma-backed persistence for Configuration-owned localities (City/District)
 * and the country-scoped `platform.default_timezone` value. Internal to
 * Configuration; other modules consume only `configuration.public.ts`.
 */

import { getPrismaClient } from "#database/prisma";
import { Prisma } from "#generated/prisma/client";

import { LocalityError } from "../locality.types.js";
import type { CitySnapshot, DistrictSnapshot } from "../locality.types.js";
import {
  isLocalitySerializationFailure,
  localitySerializationConflictError,
  mapPrismaLocalityPersistenceError,
} from "./locality-serialization-errors.js";

type LocalityDatabase = Pick<
  Prisma.TransactionClient,
  | "city"
  | "district"
  | "country"
  | "countryConfig"
  | "configurationLocalityCommand"
>;

export const SERIALIZABLE_WRITE_MAX_ATTEMPTS = 3;

type LocalityTransactionClient = Pick<
  ReturnType<typeof getPrismaClient>,
  "$transaction"
>;

export interface CountryTimeZoneRecord {
  readonly countryId: string;
  readonly timeZone: string;
  readonly version: number;
}

export interface LocalityCommandReceipt {
  readonly status: "PROCEED" | "REPLAYED";
  readonly safeResultJson?: unknown;
}

export interface LocalityRepository {
  /**
   * Reserve or replay one UUID-idempotent Staff locality/time-zone command
   * bound to `configuration_locality_commands` (`scopeKey`+`idempotencyKey`
   * unique). A fingerprint mismatch is a stable conflict; an incomplete row
   * is never a successful replay (repair item 5).
   */
  reserveOrReplayCommand(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<LocalityCommandReceipt>;

  completeCommand(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly safeResultCode: string;
    readonly safeResultJson: unknown;
  }): Promise<void>;

  findCountryById(
    countryId: string,
  ): Promise<{ readonly id: string; readonly code: string; readonly isActive: boolean } | null>;

  findCityById(cityId: string): Promise<CitySnapshot | null>;
  findCityByCode(countryId: string, code: string): Promise<CitySnapshot | null>;
  listCitiesByCountry(countryId: string): Promise<readonly CitySnapshot[]>;
  insertCity(input: {
    readonly countryId: string;
    readonly code: string;
    readonly nameAr: string;
    readonly nameEn: string;
  }): Promise<CitySnapshot>;
  updateCity(
    cityId: string,
    expectedVersion: number,
    changes: {
      readonly nameAr?: string;
      readonly nameEn?: string;
      readonly isActive?: boolean;
    },
  ): Promise<CitySnapshot | "VERSION_CONFLICT" | "NOT_FOUND">;

  findDistrictById(districtId: string): Promise<DistrictSnapshot | null>;
  findDistrictByCode(
    cityId: string,
    code: string,
  ): Promise<DistrictSnapshot | null>;
  listDistrictsByCity(cityId: string): Promise<readonly DistrictSnapshot[]>;
  insertDistrict(input: {
    readonly cityId: string;
    readonly code: string;
    readonly nameAr: string;
    readonly nameEn: string;
  }): Promise<DistrictSnapshot>;
  updateDistrict(
    districtId: string,
    expectedVersion: number,
    changes: {
      readonly nameAr?: string;
      readonly nameEn?: string;
      readonly isActive?: boolean;
    },
  ): Promise<DistrictSnapshot | "VERSION_CONFLICT" | "NOT_FOUND">;

  findCountryTimeZone(
    countryId: string,
  ): Promise<CountryTimeZoneRecord | null>;
  /**
   * Create or update the country's `platform.default_timezone` value.
   * `expectedVersion` must be `0` when no row exists yet, or the current
   * row's `version` when replacing it. Any mismatch is a version conflict.
   */
  upsertCountryTimeZone(
    countryId: string,
    timeZone: string,
    expectedVersion: number,
  ): Promise<CountryTimeZoneRecord | "VERSION_CONFLICT">;
}

const TIME_ZONE_KEY = "platform.default_timezone";

function rethrowMapped(error: unknown): never {
  const mapped = mapPrismaLocalityPersistenceError(error);
  if (mapped !== null) throw mapped;
  throw error;
}

function toCitySnapshot(row: {
  readonly id: string;
  readonly countryId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): CitySnapshot {
  return { ...row };
}

function toDistrictSnapshot(row: {
  readonly id: string;
  readonly cityId: string;
  readonly code: string;
  readonly nameAr: string;
  readonly nameEn: string;
  readonly isActive: boolean;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}): DistrictSnapshot {
  return { ...row };
}

type ExistingLocalityCommandRow = {
  readonly status: "IN_PROGRESS" | "ACCEPTED";
  readonly requestFingerprint: string;
  readonly actorUserId: string;
  readonly safeResultJson: unknown;
};

class PrismaLocalityRepository implements LocalityRepository {
  public constructor(private readonly database: LocalityDatabase) {}

  private commandLookupWhere(scopeKey: string, idempotencyKey: string) {
    return { scopeKey_idempotencyKey: { scopeKey, idempotencyKey } };
  }

  /**
   * @desc Decide the receipt for an existing command row: a different actor
   * or a fingerprint mismatch is a stable conflict (repair item 4); an
   * incomplete row is never a successful replay; only a matching, ACCEPTED
   * row with a safe result replays.
   */
  private receiptFromExistingCommand(
    existing: ExistingLocalityCommandRow,
    requestFingerprint: string,
    actorUserId: string,
  ): LocalityCommandReceipt {
    if (
      existing.requestFingerprint !== requestFingerprint ||
      existing.actorUserId !== actorUserId
    ) {
      throw new LocalityError("LOCALITY_IDEMPOTENCY_CONFLICT");
    }
    if (
      existing.status !== "ACCEPTED" ||
      existing.safeResultJson === null ||
      existing.safeResultJson === undefined
    ) {
      throw new LocalityError("LOCALITY_COMMAND_IN_PROGRESS");
    }
    return { status: "REPLAYED", safeResultJson: existing.safeResultJson };
  }

  public async reserveOrReplayCommand(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string;
  }): Promise<LocalityCommandReceipt> {
    const lookupWhere = this.commandLookupWhere(
      input.scopeKey,
      input.idempotencyKey,
    );
    const existing = await this.database.configurationLocalityCommand.findUnique(
      { where: lookupWhere },
    );
    if (existing !== null) {
      return this.receiptFromExistingCommand(
        existing,
        input.requestFingerprint,
        input.actorUserId,
      );
    }

    // Repair item 3: a plain `create` after a `findUnique` miss is not a
    // safe reservation on PostgreSQL — a concurrent unique violation aborts
    // the whole interactive transaction, so a follow-up query in the same
    // transaction cannot recover. `createMany({ skipDuplicates: true })`
    // performs a single conflict-tolerant statement (`INSERT ... ON
    // CONFLICT DO NOTHING` under the hood) that never aborts the
    // transaction; when it reserves zero rows, the winner already exists
    // and is read back and resolved exactly like a pre-existing row.
    const reserved = await this.database.configurationLocalityCommand.createMany({
      data: [
        {
          actorUserId: input.actorUserId,
          scopeKey: input.scopeKey,
          idempotencyKey: input.idempotencyKey,
          requestFingerprint: input.requestFingerprint,
          status: "IN_PROGRESS",
        },
      ],
      skipDuplicates: true,
    });
    if (reserved.count === 1) {
      return { status: "PROCEED" };
    }

    const raced = await this.database.configurationLocalityCommand.findUnique({
      where: lookupWhere,
    });
    if (raced === null) {
      // Should be unreachable: skipDuplicates reported a duplicate but the
      // row cannot be found. Fail closed rather than silently proceeding.
      throw new LocalityError("LOCALITY_COMMAND_IN_PROGRESS");
    }
    return this.receiptFromExistingCommand(
      raced,
      input.requestFingerprint,
      input.actorUserId,
    );
  }

  public async completeCommand(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly safeResultCode: string;
    readonly safeResultJson: unknown;
  }): Promise<void> {
    await this.database.configurationLocalityCommand.update({
      where: this.commandLookupWhere(input.scopeKey, input.idempotencyKey),
      data: {
        status: "ACCEPTED",
        safeResultCode: input.safeResultCode,
        safeResultJson: input.safeResultJson as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
  }

  public async findCountryById(
    countryId: string,
  ): Promise<{ readonly id: string; readonly code: string; readonly isActive: boolean } | null> {
    return this.database.country.findUnique({
      where: { id: countryId },
      select: { id: true, code: true, isActive: true },
    });
  }

  public async findCityById(cityId: string): Promise<CitySnapshot | null> {
    const row = await this.database.city.findUnique({ where: { id: cityId } });
    return row === null ? null : toCitySnapshot(row);
  }

  public async findCityByCode(
    countryId: string,
    code: string,
  ): Promise<CitySnapshot | null> {
    const row = await this.database.city.findUnique({
      where: { countryId_code: { countryId, code } },
    });
    return row === null ? null : toCitySnapshot(row);
  }

  public async listCitiesByCountry(
    countryId: string,
  ): Promise<readonly CitySnapshot[]> {
    const rows = await this.database.city.findMany({
      where: { countryId },
      orderBy: { code: "asc" },
    });
    return rows.map(toCitySnapshot);
  }

  public async insertCity(input: {
    readonly countryId: string;
    readonly code: string;
    readonly nameAr: string;
    readonly nameEn: string;
  }): Promise<CitySnapshot> {
    try {
      const row = await this.database.city.create({ data: { ...input } });
      return toCitySnapshot(row);
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async updateCity(
    cityId: string,
    expectedVersion: number,
    changes: {
      readonly nameAr?: string;
      readonly nameEn?: string;
      readonly isActive?: boolean;
    },
  ): Promise<CitySnapshot | "VERSION_CONFLICT" | "NOT_FOUND"> {
    try {
      const existing = await this.database.city.findUnique({
        where: { id: cityId },
      });
      if (existing === null) {
        return "NOT_FOUND";
      }
      const result = await this.database.city.updateMany({
        where: { id: cityId, version: expectedVersion },
        data: { ...changes, version: { increment: 1 } },
      });
      if (result.count === 0) {
        return "VERSION_CONFLICT";
      }
      const updated = await this.database.city.findUnique({
        where: { id: cityId },
      });
      return updated === null ? "NOT_FOUND" : toCitySnapshot(updated);
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async findDistrictById(
    districtId: string,
  ): Promise<DistrictSnapshot | null> {
    const row = await this.database.district.findUnique({
      where: { id: districtId },
    });
    return row === null ? null : toDistrictSnapshot(row);
  }

  public async findDistrictByCode(
    cityId: string,
    code: string,
  ): Promise<DistrictSnapshot | null> {
    const row = await this.database.district.findUnique({
      where: { cityId_code: { cityId, code } },
    });
    return row === null ? null : toDistrictSnapshot(row);
  }

  public async listDistrictsByCity(
    cityId: string,
  ): Promise<readonly DistrictSnapshot[]> {
    const rows = await this.database.district.findMany({
      where: { cityId },
      orderBy: { code: "asc" },
    });
    return rows.map(toDistrictSnapshot);
  }

  public async insertDistrict(input: {
    readonly cityId: string;
    readonly code: string;
    readonly nameAr: string;
    readonly nameEn: string;
  }): Promise<DistrictSnapshot> {
    try {
      const row = await this.database.district.create({ data: { ...input } });
      return toDistrictSnapshot(row);
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async updateDistrict(
    districtId: string,
    expectedVersion: number,
    changes: {
      readonly nameAr?: string;
      readonly nameEn?: string;
      readonly isActive?: boolean;
    },
  ): Promise<DistrictSnapshot | "VERSION_CONFLICT" | "NOT_FOUND"> {
    try {
      const existing = await this.database.district.findUnique({
        where: { id: districtId },
      });
      if (existing === null) {
        return "NOT_FOUND";
      }
      const result = await this.database.district.updateMany({
        where: { id: districtId, version: expectedVersion },
        data: { ...changes, version: { increment: 1 } },
      });
      if (result.count === 0) {
        return "VERSION_CONFLICT";
      }
      const updated = await this.database.district.findUnique({
        where: { id: districtId },
      });
      return updated === null ? "NOT_FOUND" : toDistrictSnapshot(updated);
    } catch (error) {
      rethrowMapped(error);
    }
  }

  public async findCountryTimeZone(
    countryId: string,
  ): Promise<CountryTimeZoneRecord | null> {
    const row = await this.database.countryConfig.findUnique({
      where: { countryId_key: { countryId, key: TIME_ZONE_KEY } },
      select: { value: true, version: true },
    });
    if (row === null || typeof row.value !== "string") {
      return null;
    }
    return { countryId, timeZone: row.value, version: row.version };
  }

  public async upsertCountryTimeZone(
    countryId: string,
    timeZone: string,
    expectedVersion: number,
  ): Promise<CountryTimeZoneRecord | "VERSION_CONFLICT"> {
    try {
      const existing = await this.database.countryConfig.findUnique({
        where: { countryId_key: { countryId, key: TIME_ZONE_KEY } },
        select: { version: true },
      });

      if (existing === null) {
        if (expectedVersion !== 0) {
          return "VERSION_CONFLICT";
        }
        await this.database.countryConfig.create({
          data: {
            countryId,
            key: TIME_ZONE_KEY,
            value: timeZone,
            valueKind: "STRING",
            version: 1,
          },
        });
        return { countryId, timeZone, version: 1 };
      }

      if (existing.version !== expectedVersion) {
        return "VERSION_CONFLICT";
      }

      const result = await this.database.countryConfig.updateMany({
        where: { countryId, key: TIME_ZONE_KEY, version: expectedVersion },
        data: {
          value: timeZone,
          valueKind: "STRING",
          version: { increment: 1 },
        },
      });
      if (result.count === 0) {
        return "VERSION_CONFLICT";
      }
      return { countryId, timeZone, version: expectedVersion + 1 };
    } catch (error) {
      rethrowMapped(error);
    }
  }
}

export function createPrismaLocalityRepository(): LocalityRepository;
export function createPrismaLocalityRepository(
  transactionContext: unknown,
): LocalityRepository;
export function createPrismaLocalityRepository(
  transactionContext?: unknown,
): LocalityRepository {
  const database =
    transactionContext === undefined
      ? getPrismaClient()
      : (transactionContext as LocalityDatabase);
  return new PrismaLocalityRepository(database);
}

export function withLocalityTransaction<T>(
  work: (
    tx: Prisma.TransactionClient,
    repository: LocalityRepository,
  ) => Promise<T>,
): Promise<T> {
  const client = getPrismaClient();
  return runLocalityTransactionWithClient(client, work);
}

export async function runLocalityTransactionWithClient<T>(
  client: LocalityTransactionClient,
  work: (
    tx: Prisma.TransactionClient,
    repository: LocalityRepository,
  ) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= SERIALIZABLE_WRITE_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(
        async (tx) => work(tx, createPrismaLocalityRepository(tx)),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 30_000,
          timeout: 60_000,
        },
      );
    } catch (error) {
      if (!isLocalitySerializationFailure(error)) {
        throw error;
      }
      if (attempt === SERIALIZABLE_WRITE_MAX_ATTEMPTS) {
        throw localitySerializationConflictError();
      }
    }
  }
  throw localitySerializationConflictError();
}
