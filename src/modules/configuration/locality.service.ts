/**
 * Staff-facing Configuration locality (City/District/time-zone) business
 * service. Reads use `configuration.localities.read`; writes use the
 * privileged `configuration.localities.write` operation with the approved
 * `configuration_locality_change` reason (DEC-053, DEC-056).
 */

import { createHash } from "node:crypto";

import type {
  AuthenticationPrincipal,
  ProtectedOperationAuthorizer,
} from "#modules/authentication/authentication.public";
import { findPrivilegedActionReason } from "#modules/authentication/authentication.public";
import type {
  GeneralTransactionalAuditWriter,
  SafeJsonValue,
} from "#modules/admin/audit.public";

import type { LocalityRepository } from "./infrastructure/prisma-locality.repository.js";
import type {
  CreateCityBody,
  CreateDistrictBody,
  PatchCityBody,
  PatchDistrictBody,
  PutCountryTimeZoneBody,
} from "./locality.schema.js";
import {
  LocalityError,
  toCityManagementDto,
  toDistrictManagementDto,
  type CityManagementDto,
  type CountryTimeZoneDto,
  type DistrictManagementDto,
} from "./locality.types.js";
import { isRecognizedIanaTimeZone } from "./time-zone.js";

export interface LocalityCommandMeta {
  readonly principal: AuthenticationPrincipal;
  readonly requestId?: string;
}

export interface LocalityServiceDependencies {
  readonly authorization: ProtectedOperationAuthorizer;
  readonly repository: LocalityRepository;
  readonly runInTransaction: <T>(
    work: (
      repository: LocalityRepository,
      audit: GeneralTransactionalAuditWriter,
    ) => Promise<T>,
  ) => Promise<T>;
}

const REASON_OPERATION = "CONFIGURATION_LOCALITY_WRITE";
const REASON_CODE = "configuration_locality_change";

/**
 * @desc Fingerprint every semantically relevant Staff locality/time-zone
 * command input, binding the caller-supplied UUID idempotency key to an
 * exact payload (repair item 5).
 */
function fingerprintLocalityCommand(
  input: Readonly<Record<string, unknown>>,
): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export class LocalityService {
  public constructor(private readonly deps: LocalityServiceDependencies) {}

  private async assertRead(principal: AuthenticationPrincipal): Promise<void> {
    const decision = await this.deps.authorization.authorizeProtectedOperation({
      principal,
      operationId: "configuration.localities.read",
    });
    if (!decision.allowed) {
      throw new LocalityError(
        "LOCALITY_FORBIDDEN",
        "Configuration locality read denied",
        { details: { denialCode: decision.denialCode } },
      );
    }
  }

  private async assertWrite(
    principal: AuthenticationPrincipal,
    reasonCode: string,
  ): Promise<void> {
    const decision = await this.deps.authorization.authorizeProtectedOperation({
      principal,
      operationId: "configuration.localities.write",
    });
    if (!decision.allowed) {
      throw new LocalityError(
        "LOCALITY_FORBIDDEN",
        "Configuration locality write denied",
        { details: { denialCode: decision.denialCode } },
      );
    }

    const reason = findPrivilegedActionReason(reasonCode);
    if (
      reason === undefined ||
      !reason.isActive ||
      reason.operation !== REASON_OPERATION ||
      reason.code !== REASON_CODE
    ) {
      throw new LocalityError(
        "LOCALITY_REASON_INVALID",
        "Configuration locality write requires an approved privileged reason",
      );
    }
  }

  private async requireActiveCountry(
    repository: LocalityRepository,
    countryId: string,
  ): Promise<void> {
    const country = await repository.findCountryById(countryId);
    if (country === null || !country.isActive) {
      throw new LocalityError(
        "LOCALITY_COUNTRY_UNAVAILABLE",
        "Country is unavailable",
      );
    }
  }

  private async auditWrite(
    audit: GeneralTransactionalAuditWriter,
    meta: LocalityCommandMeta,
    input: {
      readonly action: string;
      readonly targetType: string;
      readonly targetId: string;
      readonly reasonCode: string;
      readonly before: Readonly<Record<string, SafeJsonValue>>;
      readonly after: Readonly<Record<string, SafeJsonValue>>;
    },
  ): Promise<void> {
    await audit.append({
      actorType: "USER",
      actorId: meta.principal.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reasonCode,
      context: { before: input.before, after: input.after },
      ...(meta.requestId === undefined ? {} : { requestId: meta.requestId }),
    });
  }

  public async listCities(
    meta: LocalityCommandMeta,
    countryId: string,
  ): Promise<readonly CityManagementDto[]> {
    await this.assertRead(meta.principal);
    await this.requireActiveCountry(this.deps.repository, countryId);
    const cities = await this.deps.repository.listCitiesByCountry(countryId);
    return cities.map(toCityManagementDto);
  }

  public async createCity(
    meta: LocalityCommandMeta,
    countryId: string,
    body: CreateCityBody,
  ): Promise<{ readonly city: CityManagementDto; readonly replayed: boolean }> {
    await this.assertWrite(meta.principal, body.reasonCode);

    const code = body.code.toUpperCase();
    const scopeKey = `configuration:locality:city.create:${countryId}`;
    const fingerprint = fingerprintLocalityCommand({
      operation: "city.create",
      countryId,
      code,
      nameAr: body.nameAr,
      nameEn: body.nameEn,
    });

    return this.deps.runInTransaction(async (repository, audit) => {
      const receipt = await repository.reserveOrReplayCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.principal.userId,
      });
      if (receipt.status === "REPLAYED") {
        return {
          city: receipt.safeResultJson as unknown as CityManagementDto,
          replayed: true,
        };
      }

      await this.requireActiveCountry(repository, countryId);
      const existing = await repository.findCityByCode(countryId, code);
      if (existing !== null) {
        throw new LocalityError(
          "LOCALITY_ALREADY_EXISTS",
          "City code already exists with different content",
        );
      }

      const created = await repository.insertCity({
        countryId,
        code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
      });

      await this.auditWrite(audit, meta, {
        action: "configuration.city.create",
        targetType: "city",
        targetId: created.id,
        reasonCode: body.reasonCode,
        before: { exists: false },
        after: { code: created.code, isActive: created.isActive },
      });

      const dto = toCityManagementDto(created);
      await repository.completeCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        safeResultCode: "CITY_CREATED",
        safeResultJson: dto,
      });

      return { city: dto, replayed: false };
    });
  }

  public async patchCity(
    meta: LocalityCommandMeta,
    cityId: string,
    body: PatchCityBody,
  ): Promise<{ readonly city: CityManagementDto; readonly replayed: boolean }> {
    await this.assertWrite(meta.principal, body.reasonCode);

    const scopeKey = `configuration:locality:city.update:${cityId}`;
    const fingerprint = fingerprintLocalityCommand({
      operation: "city.update",
      cityId,
      nameAr: body.nameAr ?? null,
      nameEn: body.nameEn ?? null,
      isActive: body.isActive ?? null,
      expectedVersion: body.expectedVersion,
    });

    return this.deps.runInTransaction(async (repository, audit) => {
      const receipt = await repository.reserveOrReplayCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.principal.userId,
      });
      if (receipt.status === "REPLAYED") {
        return {
          city: receipt.safeResultJson as unknown as CityManagementDto,
          replayed: true,
        };
      }

      const before = await repository.findCityById(cityId);
      if (before === null) {
        throw new LocalityError("LOCALITY_CITY_NOT_FOUND", "City is not available");
      }

      const changes: {
        nameAr?: string;
        nameEn?: string;
        isActive?: boolean;
      } = {};
      if (body.nameAr !== undefined) changes.nameAr = body.nameAr;
      if (body.nameEn !== undefined) changes.nameEn = body.nameEn;
      if (body.isActive !== undefined) changes.isActive = body.isActive;

      const result = await repository.updateCity(
        cityId,
        body.expectedVersion,
        changes,
      );
      if (result === "NOT_FOUND") {
        throw new LocalityError("LOCALITY_CITY_NOT_FOUND", "City is not available");
      }
      if (result === "VERSION_CONFLICT") {
        throw new LocalityError(
          "LOCALITY_VERSION_CONFLICT",
          "City changed concurrently",
        );
      }

      await this.auditWrite(audit, meta, {
        action: "configuration.city.update",
        targetType: "city",
        targetId: result.id,
        reasonCode: body.reasonCode,
        before: {
          nameAr: before.nameAr,
          nameEn: before.nameEn,
          isActive: before.isActive,
        },
        after: {
          nameAr: result.nameAr,
          nameEn: result.nameEn,
          isActive: result.isActive,
        },
      });

      const dto = toCityManagementDto(result);
      await repository.completeCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        safeResultCode: "CITY_UPDATED",
        safeResultJson: dto,
      });

      return { city: dto, replayed: false };
    });
  }

  public async listDistricts(
    meta: LocalityCommandMeta,
    cityId: string,
  ): Promise<readonly DistrictManagementDto[]> {
    await this.assertRead(meta.principal);
    const city = await this.deps.repository.findCityById(cityId);
    if (city === null) {
      throw new LocalityError("LOCALITY_CITY_NOT_FOUND", "City is not available");
    }
    const districts = await this.deps.repository.listDistrictsByCity(cityId);
    return districts.map(toDistrictManagementDto);
  }

  public async createDistrict(
    meta: LocalityCommandMeta,
    cityId: string,
    body: CreateDistrictBody,
  ): Promise<{
    readonly district: DistrictManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertWrite(meta.principal, body.reasonCode);

    const code = body.code.toUpperCase();
    const scopeKey = `configuration:locality:district.create:${cityId}`;
    const fingerprint = fingerprintLocalityCommand({
      operation: "district.create",
      cityId,
      code,
      nameAr: body.nameAr,
      nameEn: body.nameEn,
    });

    return this.deps.runInTransaction(async (repository, audit) => {
      const receipt = await repository.reserveOrReplayCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.principal.userId,
      });
      if (receipt.status === "REPLAYED") {
        return {
          district: receipt.safeResultJson as unknown as DistrictManagementDto,
          replayed: true,
        };
      }

      const city = await repository.findCityById(cityId);
      if (city === null) {
        throw new LocalityError(
          "LOCALITY_CITY_NOT_FOUND",
          "City is not available",
        );
      }

      const existing = await repository.findDistrictByCode(cityId, code);
      if (existing !== null) {
        throw new LocalityError(
          "LOCALITY_ALREADY_EXISTS",
          "District code already exists with different content",
        );
      }

      const created = await repository.insertDistrict({
        cityId,
        code,
        nameAr: body.nameAr,
        nameEn: body.nameEn,
      });

      await this.auditWrite(audit, meta, {
        action: "configuration.district.create",
        targetType: "district",
        targetId: created.id,
        reasonCode: body.reasonCode,
        before: { exists: false },
        after: { code: created.code, isActive: created.isActive },
      });

      const dto = toDistrictManagementDto(created);
      await repository.completeCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        safeResultCode: "DISTRICT_CREATED",
        safeResultJson: dto,
      });

      return { district: dto, replayed: false };
    });
  }

  public async patchDistrict(
    meta: LocalityCommandMeta,
    districtId: string,
    body: PatchDistrictBody,
  ): Promise<{
    readonly district: DistrictManagementDto;
    readonly replayed: boolean;
  }> {
    await this.assertWrite(meta.principal, body.reasonCode);

    const scopeKey = `configuration:locality:district.update:${districtId}`;
    const fingerprint = fingerprintLocalityCommand({
      operation: "district.update",
      districtId,
      nameAr: body.nameAr ?? null,
      nameEn: body.nameEn ?? null,
      isActive: body.isActive ?? null,
      expectedVersion: body.expectedVersion,
    });

    return this.deps.runInTransaction(async (repository, audit) => {
      const receipt = await repository.reserveOrReplayCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.principal.userId,
      });
      if (receipt.status === "REPLAYED") {
        return {
          district: receipt.safeResultJson as unknown as DistrictManagementDto,
          replayed: true,
        };
      }

      const before = await repository.findDistrictById(districtId);
      if (before === null) {
        throw new LocalityError(
          "LOCALITY_DISTRICT_NOT_FOUND",
          "District is not available",
        );
      }

      const changes: {
        nameAr?: string;
        nameEn?: string;
        isActive?: boolean;
      } = {};
      if (body.nameAr !== undefined) changes.nameAr = body.nameAr;
      if (body.nameEn !== undefined) changes.nameEn = body.nameEn;
      if (body.isActive !== undefined) changes.isActive = body.isActive;

      const result = await repository.updateDistrict(
        districtId,
        body.expectedVersion,
        changes,
      );
      if (result === "NOT_FOUND") {
        throw new LocalityError(
          "LOCALITY_DISTRICT_NOT_FOUND",
          "District is not available",
        );
      }
      if (result === "VERSION_CONFLICT") {
        throw new LocalityError(
          "LOCALITY_VERSION_CONFLICT",
          "District changed concurrently",
        );
      }

      await this.auditWrite(audit, meta, {
        action: "configuration.district.update",
        targetType: "district",
        targetId: result.id,
        reasonCode: body.reasonCode,
        before: {
          nameAr: before.nameAr,
          nameEn: before.nameEn,
          isActive: before.isActive,
        },
        after: {
          nameAr: result.nameAr,
          nameEn: result.nameEn,
          isActive: result.isActive,
        },
      });

      const dto = toDistrictManagementDto(result);
      await repository.completeCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        safeResultCode: "DISTRICT_UPDATED",
        safeResultJson: dto,
      });

      return { district: dto, replayed: false };
    });
  }

  public async getCountryTimeZone(
    meta: LocalityCommandMeta,
    countryId: string,
  ): Promise<CountryTimeZoneDto> {
    await this.assertRead(meta.principal);
    const country = await this.deps.repository.findCountryById(countryId);
    if (country === null || !country.isActive) {
      throw new LocalityError(
        "LOCALITY_COUNTRY_UNAVAILABLE",
        "Country is unavailable",
      );
    }
    const record = await this.deps.repository.findCountryTimeZone(countryId);
    if (record === null) {
      throw new LocalityError(
        "LOCALITY_TIME_ZONE_NOT_SET",
        "Country time zone is not configured",
      );
    }
    if (!isRecognizedIanaTimeZone(record.timeZone)) {
      throw new LocalityError(
        "LOCALITY_TIME_ZONE_INVALID",
        "Country time zone is not a recognized IANA identifier",
      );
    }
    return {
      countryId,
      countryCode: country.code,
      timeZone: record.timeZone,
      version: record.version,
    };
  }

  public async putCountryTimeZone(
    meta: LocalityCommandMeta,
    countryId: string,
    body: PutCountryTimeZoneBody,
  ): Promise<{ readonly timeZone: CountryTimeZoneDto; readonly replayed: boolean }> {
    await this.assertWrite(meta.principal, body.reasonCode);
    if (!isRecognizedIanaTimeZone(body.timeZone)) {
      throw new LocalityError(
        "LOCALITY_TIME_ZONE_INVALID",
        "Time zone identifier is not recognized by the runtime IANA database",
      );
    }

    const scopeKey = `configuration:locality:country_time_zone.put:${countryId}`;
    const fingerprint = fingerprintLocalityCommand({
      operation: "country_time_zone.put",
      countryId,
      timeZone: body.timeZone,
      expectedVersion: body.expectedVersion,
    });

    return this.deps.runInTransaction(async (repository, audit) => {
      const receipt = await repository.reserveOrReplayCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        requestFingerprint: fingerprint,
        actorUserId: meta.principal.userId,
      });
      if (receipt.status === "REPLAYED") {
        return {
          timeZone: receipt.safeResultJson as unknown as CountryTimeZoneDto,
          replayed: true,
        };
      }

      const country = await repository.findCountryById(countryId);
      if (country === null || !country.isActive) {
        throw new LocalityError(
          "LOCALITY_COUNTRY_UNAVAILABLE",
          "Country is unavailable",
        );
      }

      const before = await repository.findCountryTimeZone(countryId);

      const result = await repository.upsertCountryTimeZone(
        countryId,
        body.timeZone,
        body.expectedVersion,
      );
      if (result === "VERSION_CONFLICT") {
        throw new LocalityError(
          "LOCALITY_VERSION_CONFLICT",
          "Country time zone changed concurrently",
        );
      }

      await this.auditWrite(audit, meta, {
        action: "configuration.country_time_zone.update",
        targetType: "country_config",
        targetId: countryId,
        reasonCode: body.reasonCode,
        before: { timeZone: before?.timeZone ?? "" },
        after: { timeZone: result.timeZone },
      });

      const dto: CountryTimeZoneDto = {
        countryId,
        countryCode: country.code,
        timeZone: result.timeZone,
        version: result.version,
      };
      await repository.completeCommand({
        scopeKey,
        idempotencyKey: body.idempotencyKey,
        safeResultCode: "COUNTRY_TIME_ZONE_UPDATED",
        safeResultJson: dto,
      });

      return { timeZone: dto, replayed: false };
    });
  }
}
