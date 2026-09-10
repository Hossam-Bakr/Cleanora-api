import { LocalityService } from "../../../src/modules/configuration/locality.service.js";
import type {
  LocalityCommandReceipt,
  LocalityRepository,
} from "../../../src/modules/configuration/infrastructure/prisma-locality.repository.js";
import { LocalityError } from "../../../src/modules/configuration/locality.types.js";
import type { CitySnapshot, DistrictSnapshot } from "../../../src/modules/configuration/locality.types.js";
import type {
  AuthenticationPrincipal,
  ProtectedOperationAuthorizer,
} from "../../../src/modules/authentication/authentication.public.js";
import type { GeneralTransactionalAuditWriter } from "../../../src/modules/admin/audit.public.js";

const principal: AuthenticationPrincipal = {
  userId: "user-1",
} as unknown as AuthenticationPrincipal;

const otherPrincipal: AuthenticationPrincipal = {
  userId: "user-2",
} as unknown as AuthenticationPrincipal;

function allowAuthorizer(allowed = true): ProtectedOperationAuthorizer {
  return {
    async authorizeProtectedOperation() {
      return allowed
        ? { allowed: true }
        : { allowed: false, denialCode: "PERMISSION_DENIED" as never };
    },
  };
}

function fakeAudit(): GeneralTransactionalAuditWriter & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    calls,
    async append(input) {
      calls.push(input);
      return { id: "audit-1", createdAt: new Date().toISOString() };
    },
  };
}

function baseCity(overrides: Partial<CitySnapshot> = {}): CitySnapshot {
  return {
    id: "city-1",
    countryId: "country-1",
    code: "CAI",
    nameAr: "القاهرة",
    nameEn: "Cairo",
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function baseDistrict(overrides: Partial<DistrictSnapshot> = {}): DistrictSnapshot {
  return {
    id: "district-1",
    cityId: "city-1",
    code: "MAADI",
    nameAr: "المعادي",
    nameEn: "Maadi",
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * @desc In-memory command-receipt store mirroring the Configuration-owned
 * durable receipt semantics (repair item 5): fingerprint mismatch on a
 * reused key is a stable conflict; an incomplete row never replays.
 */
function fakeRepository(overrides: Partial<LocalityRepository> = {}): LocalityRepository {
  const store = new Map<
    string,
    {
      status: "IN_PROGRESS" | "ACCEPTED";
      fingerprint: string;
      actorUserId: string;
      safeResultJson: unknown;
    }
  >();
  return {
    async reserveOrReplayCommand(input) {
      const key = `${input.scopeKey}:${input.idempotencyKey}`;
      const existing = store.get(key);
      if (existing !== undefined) {
        // Repair item 4: a different actor presenting the same
        // resource-scoped key is a stable conflict, never a replay of
        // another actor's safe result.
        if (
          existing.fingerprint !== input.requestFingerprint ||
          existing.actorUserId !== input.actorUserId
        ) {
          throw new LocalityError("LOCALITY_IDEMPOTENCY_CONFLICT");
        }
        if (existing.status !== "ACCEPTED") {
          throw new LocalityError("LOCALITY_COMMAND_IN_PROGRESS");
        }
        return { status: "REPLAYED", safeResultJson: existing.safeResultJson };
      }
      store.set(key, {
        status: "IN_PROGRESS",
        fingerprint: input.requestFingerprint,
        actorUserId: input.actorUserId,
        safeResultJson: null,
      });
      return { status: "PROCEED" };
    },
    async completeCommand(input) {
      const key = `${input.scopeKey}:${input.idempotencyKey}`;
      const existing = store.get(key);
      store.set(key, {
        status: "ACCEPTED",
        fingerprint: existing?.fingerprint ?? "",
        actorUserId: existing?.actorUserId ?? "",
        safeResultJson: input.safeResultJson,
      });
    },
    async findCountryById() {
      return { id: "country-1", code: "EG", isActive: true };
    },
    async findCountryByCode(code: string) {
      return code.toUpperCase() === "EG"
        ? { id: "country-1", code: "EG", isActive: true }
        : null;
    },
    async findCityById() {
      return null;
    },
    async findCityByCode() {
      return null;
    },
    async listCitiesByCountry() {
      return [];
    },
    async insertCity(input) {
      return baseCity({ ...input });
    },
    async updateCity() {
      return "NOT_FOUND";
    },
    async findDistrictById() {
      return null;
    },
    async findDistrictByCode() {
      return null;
    },
    async listDistrictsByCity() {
      return [];
    },
    async insertDistrict(input) {
      return baseDistrict({ ...input });
    },
    async updateDistrict() {
      return "NOT_FOUND";
    },
    async findCountryTimeZone() {
      return null;
    },
    async upsertCountryTimeZone(_countryId, timeZone, expectedVersion) {
      return { countryId: "country-1", timeZone, version: expectedVersion + 1 };
    },
    ...overrides,
  };
}

function buildService(
  repository: LocalityRepository,
  authorization: ProtectedOperationAuthorizer = allowAuthorizer(),
): { service: LocalityService; audit: ReturnType<typeof fakeAudit> } {
  const audit = fakeAudit();
  const service = new LocalityService({
    authorization,
    repository,
    runInTransaction: (work) => work(repository, audit),
  });
  return { service, audit };
}

describe("LocalityService (R1-P10 Batch A)", () => {
  it("denies reads without configuration.localities.read", async () => {
    const { service } = buildService(fakeRepository(), allowAuthorizer(false));
    await expect(
      service.listCities({ principal }, "country-1"),
    ).rejects.toMatchObject({ code: "LOCALITY_FORBIDDEN" });
  });

  it("denies writes without an approved privileged reason", async () => {
    const { service } = buildService(fakeRepository());
    await expect(
      service.createCity(
        { principal },
        "country-1",
        {
          code: "CAI",
          nameAr: "القاهرة",
          nameEn: "Cairo",
          idempotencyKey: "11111111-1111-1111-1111-111111111111",
          reasonCode: "not_a_real_reason",
        },
      ),
    ).rejects.toMatchObject({ code: "LOCALITY_REASON_INVALID" });
  });

  it("creates a city and audits the write", async () => {
    const repository = fakeRepository();
    const { service, audit } = buildService(repository);
    const result = await service.createCity(
      { principal },
      "country-1",
      {
        code: "cai",
        nameAr: "القاهرة",
        nameEn: "Cairo",
        idempotencyKey: "11111111-1111-1111-1111-111111111111",
        reasonCode: "configuration_locality_change",
      },
    );
    expect(result.replayed).toBe(false);
    expect(result.city.code).toBe("CAI");
    expect(audit.calls).toHaveLength(1);
  });

  it("rejects create-city when the code exists with different content", async () => {
    const repository = fakeRepository({
      async findCityByCode() {
        return baseCity({ nameEn: "Alexandria" });
      },
    });
    const { service } = buildService(repository);
    await expect(
      service.createCity(
        { principal },
        "country-1",
        {
          code: "cai",
          nameAr: "القاهرة",
          nameEn: "Cairo",
          idempotencyKey: "22222222-2222-2222-2222-222222222222",
          reasonCode: "configuration_locality_change",
        },
      ),
    ).rejects.toMatchObject({ code: "LOCALITY_ALREADY_EXISTS" });
  });

  it("returns LOCALITY_VERSION_CONFLICT when patch expectedVersion is stale", async () => {
    const repository = fakeRepository({
      async findCityById() {
        return baseCity();
      },
      async updateCity() {
        return "VERSION_CONFLICT";
      },
    });
    const { service } = buildService(repository);
    await expect(
      service.patchCity({ principal }, "city-1", {
        isActive: false,
        expectedVersion: 5,
        idempotencyKey: "33333333-3333-3333-3333-333333333333",
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_VERSION_CONFLICT" });
  });

  it("lists active districts under a city", async () => {
    const repository = fakeRepository({
      async findCityById() {
        return baseCity();
      },
      async listDistrictsByCity() {
        return [baseDistrict()];
      },
    });
    const { service } = buildService(repository);
    const result = await service.listDistricts({ principal }, "city-1");
    expect(result).toHaveLength(1);
    expect(result[0]?.code).toBe("MAADI");
  });

  it("reports LOCALITY_TIME_ZONE_NOT_SET when no country time zone exists", async () => {
    const { service } = buildService(fakeRepository());
    await expect(
      service.getCountryTimeZone({ principal }, "country-1"),
    ).rejects.toMatchObject({ code: "LOCALITY_TIME_ZONE_NOT_SET" });
  });

  it("sets the country time zone for the first time at expectedVersion 0", async () => {
    const { service, audit } = buildService(fakeRepository());
    const result = await service.putCountryTimeZone(
      { principal },
      "country-1",
      {
        timeZone: "Africa/Cairo",
        expectedVersion: 0,
        idempotencyKey: "44444444-4444-4444-4444-444444444444",
        reasonCode: "configuration_locality_change",
      },
    );
    expect(result.replayed).toBe(false);
    expect(result.timeZone.timeZone).toBe("Africa/Cairo");
    expect(result.timeZone.version).toBe(1);
    expect(audit.calls).toHaveLength(1);
  });

  it("rejects an unrecognized IANA time zone before persistence", async () => {
    const upsertCountryTimeZone = vi.fn();
    const { service } = buildService(
      fakeRepository({ upsertCountryTimeZone }),
    );

    await expect(
      service.putCountryTimeZone({ principal }, "country-1", {
        timeZone: "Mars/Olympus",
        expectedVersion: 0,
        idempotencyKey: "45454545-4545-4545-8545-454545454545",
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_TIME_ZONE_INVALID" });
    expect(upsertCountryTimeZone).not.toHaveBeenCalled();
  });
});

describe("LocalityService UUID idempotency (repair item 5)", () => {
  it("replays same-key/same-payload create-city without a second audit entry", async () => {
    const repository = fakeRepository();
    const { service, audit } = buildService(repository);
    const idempotencyKey = "55555555-5555-5555-5555-555555555555";
    const body = {
      code: "cai",
      nameAr: "القاهرة",
      nameEn: "Cairo",
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    } as const;

    const first = await service.createCity({ principal }, "country-1", body);
    expect(first.replayed).toBe(false);

    const second = await service.createCity({ principal }, "country-1", body);
    expect(second.replayed).toBe(true);
    expect(second.city).toEqual(first.city);
    expect(audit.calls).toHaveLength(1);
  });

  it("raises a stable conflict for same-key/different-payload create-city", async () => {
    const repository = fakeRepository();
    const { service } = buildService(repository);
    const idempotencyKey = "66666666-6666-6666-6666-666666666666";

    await service.createCity({ principal }, "country-1", {
      code: "cai",
      nameAr: "القاهرة",
      nameEn: "Cairo",
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    });

    await expect(
      service.createCity({ principal }, "country-1", {
        code: "alx",
        nameAr: "الإسكندرية",
        nameEn: "Alexandria",
        idempotencyKey,
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_IDEMPOTENCY_CONFLICT" });
  });

  it("does not treat an in-progress (unaccepted) receipt as a successful replay", async () => {
    const repository = fakeRepository({
      async reserveOrReplayCommand(): Promise<LocalityCommandReceipt> {
        throw new LocalityError("LOCALITY_COMMAND_IN_PROGRESS");
      },
    });
    const { service } = buildService(repository);
    await expect(
      service.createCity({ principal }, "country-1", {
        code: "cai",
        nameAr: "القاهرة",
        nameEn: "Cairo",
        idempotencyKey: "77777777-7777-7777-7777-777777777777",
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_COMMAND_IN_PROGRESS" });
  });

  it("treats unrelated matching content under a different key as normal uniqueness, not replay", async () => {
    const repository = fakeRepository({
      async findCityByCode() {
        return baseCity({ nameEn: "Cairo" });
      },
    });
    const { service } = buildService(repository);
    await expect(
      service.createCity({ principal }, "country-1", {
        code: "cai",
        nameAr: "القاهرة",
        nameEn: "Cairo",
        idempotencyKey: "88888888-8888-8888-8888-888888888888",
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_ALREADY_EXISTS" });
  });

  it("replays same-key/same-payload patch-city without a second audit entry", async () => {
    const repository = fakeRepository({
      async findCityById() {
        return baseCity();
      },
      async updateCity(_id, _expectedVersion, changes) {
        return baseCity({ ...changes, version: 2 });
      },
    });
    const { service, audit } = buildService(repository);
    const idempotencyKey = "99999999-9999-9999-9999-999999999999";
    const body = {
      isActive: false,
      expectedVersion: 1,
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    } as const;

    const first = await service.patchCity({ principal }, "city-1", body);
    expect(first.replayed).toBe(false);
    const second = await service.patchCity({ principal }, "city-1", body);
    expect(second.replayed).toBe(true);
    expect(audit.calls).toHaveLength(1);
  });

  it("raises a stable conflict for same-key/different-payload patch-city", async () => {
    const repository = fakeRepository({
      async findCityById() {
        return baseCity();
      },
      async updateCity(_id, _expectedVersion, changes) {
        return baseCity({ ...changes, version: 2 });
      },
    });
    const { service } = buildService(repository);
    const idempotencyKey = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

    await service.patchCity({ principal }, "city-1", {
      isActive: false,
      expectedVersion: 1,
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    });

    await expect(
      service.patchCity({ principal }, "city-1", {
        isActive: true,
        expectedVersion: 1,
        idempotencyKey,
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_IDEMPOTENCY_CONFLICT" });
  });

  it("replays same-key/same-payload create-district without a second audit entry", async () => {
    const repository = fakeRepository({
      async findCityById() {
        return baseCity();
      },
    });
    const { service, audit } = buildService(repository);
    const idempotencyKey = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
    const body = {
      code: "maadi",
      nameAr: "المعادي",
      nameEn: "Maadi",
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    } as const;

    const first = await service.createDistrict({ principal }, "city-1", body);
    expect(first.replayed).toBe(false);
    const second = await service.createDistrict({ principal }, "city-1", body);
    expect(second.replayed).toBe(true);
    expect(audit.calls).toHaveLength(1);
  });

  it("raises a stable conflict for same-key/different-payload create-district", async () => {
    const repository = fakeRepository({
      async findCityById() {
        return baseCity();
      },
    });
    const { service } = buildService(repository);
    const idempotencyKey = "cccccccc-cccc-cccc-cccc-cccccccccccc";

    await service.createDistrict({ principal }, "city-1", {
      code: "maadi",
      nameAr: "المعادي",
      nameEn: "Maadi",
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    });

    await expect(
      service.createDistrict({ principal }, "city-1", {
        code: "nasr",
        nameAr: "مدينة نصر",
        nameEn: "Nasr City",
        idempotencyKey,
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_IDEMPOTENCY_CONFLICT" });
  });

  it("replays same-key/same-payload patch-district without a second audit entry", async () => {
    const repository = fakeRepository({
      async findDistrictById() {
        return baseDistrict();
      },
      async updateDistrict(_id, _expectedVersion, changes) {
        return baseDistrict({ ...changes, version: 2 });
      },
    });
    const { service, audit } = buildService(repository);
    const idempotencyKey = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const body = {
      isActive: false,
      expectedVersion: 1,
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    } as const;

    const first = await service.patchDistrict({ principal }, "district-1", body);
    expect(first.replayed).toBe(false);
    const second = await service.patchDistrict({ principal }, "district-1", body);
    expect(second.replayed).toBe(true);
    expect(audit.calls).toHaveLength(1);
  });

  it("raises a stable conflict for same-key/different-payload patch-district", async () => {
    const repository = fakeRepository({
      async findDistrictById() {
        return baseDistrict();
      },
      async updateDistrict(_id, _expectedVersion, changes) {
        return baseDistrict({ ...changes, version: 2 });
      },
    });
    const { service } = buildService(repository);
    const idempotencyKey = "13131313-1313-1313-1313-131313131313";

    await service.patchDistrict({ principal }, "district-1", {
      isActive: false,
      expectedVersion: 1,
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    });

    await expect(
      service.patchDistrict({ principal }, "district-1", {
        isActive: true,
        expectedVersion: 1,
        idempotencyKey,
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_IDEMPOTENCY_CONFLICT" });
  });

  it("replays same-key/same-payload country time-zone PUT without a second audit entry", async () => {
    const repository = fakeRepository();
    const { service, audit } = buildService(repository);
    const idempotencyKey = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const body = {
      timeZone: "Africa/Cairo",
      expectedVersion: 0,
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    } as const;

    const first = await service.putCountryTimeZone({ principal }, "country-1", body);
    expect(first.replayed).toBe(false);
    const second = await service.putCountryTimeZone({ principal }, "country-1", body);
    expect(second.replayed).toBe(true);
    expect(audit.calls).toHaveLength(1);
  });

  it("raises a stable conflict for same-key/different-payload country time-zone PUT", async () => {
    const repository = fakeRepository();
    const { service } = buildService(repository);
    const idempotencyKey = "ffffffff-ffff-ffff-ffff-ffffffffffff";

    await service.putCountryTimeZone({ principal }, "country-1", {
      timeZone: "Africa/Cairo",
      expectedVersion: 0,
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    });

    await expect(
      service.putCountryTimeZone({ principal }, "country-1", {
        timeZone: "Europe/London",
        expectedVersion: 0,
        idempotencyKey,
        reasonCode: "configuration_locality_change",
      }),
    ).rejects.toMatchObject({ code: "LOCALITY_IDEMPOTENCY_CONFLICT" });
  });

  it("raises a stable conflict when a different actor reuses the same resource-scoped key (repair item 4)", async () => {
    const repository = fakeRepository();
    const { service } = buildService(repository);
    const idempotencyKey = "12121212-1212-1212-1212-121212121212";
    const body = {
      code: "cai",
      nameAr: "القاهرة",
      nameEn: "Cairo",
      idempotencyKey,
      reasonCode: "configuration_locality_change",
    } as const;

    await service.createCity({ principal }, "country-1", body);

    await expect(
      service.createCity({ principal: otherPrincipal }, "country-1", body),
    ).rejects.toMatchObject({ code: "LOCALITY_IDEMPOTENCY_CONFLICT" });
  });
});
