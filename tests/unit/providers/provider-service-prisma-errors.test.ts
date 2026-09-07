
import { ProviderServiceError, providerServiceErrorToAppError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import {
  isProviderServiceSerializationFailure,
  mapPrismaProviderServiceError,
  providerServiceStaleVersionError,
} from "../../../src/modules/providers/infrastructure/provider-service-prisma-errors.js";

describe("provider-service prisma error mapping", () => {
  it("detects serialization failures from Prisma codes, SQL states, and mapped errors", () => {
    expect(isProviderServiceSerializationFailure({ code: "P2034" })).toBe(true);
    expect(isProviderServiceSerializationFailure({ code: "P2028" })).toBe(true);
    expect(
      isProviderServiceSerializationFailure({
        cause: { originalCode: "40001" },
      }),
    ).toBe(true);
    expect(
      isProviderServiceSerializationFailure({
        cause: { code: "40P01" },
      }),
    ).toBe(true);
    expect(
      isProviderServiceSerializationFailure(
        new ProviderServiceError("PROVIDER_SERVICE_SNAPSHOT_CONFLICT", undefined, {
          details: { reason: "SERIALIZATION_FAILURE" },
        }),
      ),
    ).toBe(true);
    expect(isProviderServiceSerializationFailure("nope")).toBe(false);
    expect(isProviderServiceSerializationFailure({ code: "P2002" })).toBe(false);
  });

  it("maps unique races by target hints and defaults unknown unique conflicts", () => {
    expect(
      mapPrismaProviderServiceError({
        code: "P2002",
        meta: { target: ["provider_id", "catalog_service_id"] },
      })?.code,
    ).toBe("PROVIDER_SERVICE_ALREADY_EXISTS");

    expect(
      mapPrismaProviderServiceError({
        code: "P2002",
        meta: { constraint: "provider_service_prices_one_pending" },
      })?.details,
    ).toMatchObject({ reason: "PARTIAL_UNIQUE_PRICE_RACE" });

    expect(
      mapPrismaProviderServiceError({
        code: "P2002",
        meta: { target: "provider_service_prices_one_effective" },
      })?.code,
    ).toBe("PROVIDER_SERVICE_VERSION_CONFLICT");

    expect(
      mapPrismaProviderServiceError({
        code: "P2002",
        meta: { target: ["scope_key", "idempotency_key"] },
      })?.details,
    ).toMatchObject({ reason: "RECEIPT_UNIQUE_RACE" });

    expect(
      mapPrismaProviderServiceError({
        code: "P2002",
        meta: { field_name: "operation_key" },
      })?.details,
    ).toMatchObject({ reason: "OPERATION_KEY_UNIQUE_RACE" });

    expect(
      mapPrismaProviderServiceError({
        code: "P2002",
        message: "unique on something else",
      })?.details,
    ).toMatchObject({ reason: "UNIQUE_CONSTRAINT_CONFLICT" });

    expect(
      mapPrismaProviderServiceError({
        meta: {
          code: "23505",
          driverAdapterError: {
            cause: { originalCode: "23505" },
          },
        },
        message: "provider_services_provider_id_catalog_service_id_key",
      })?.code,
    ).toBe("PROVIDER_SERVICE_ALREADY_EXISTS");
  });

  it("maps FK, check, not-found, and serialization Prisma failures", () => {
    expect(mapPrismaProviderServiceError({ code: "P2003" })?.code).toBe(
      "PROVIDER_SERVICE_DEPENDENCY_FAILED",
    );
    expect(mapPrismaProviderServiceError({ cause: { originalCode: "23503" } })?.code).toBe(
      "PROVIDER_SERVICE_DEPENDENCY_FAILED",
    );
    expect(mapPrismaProviderServiceError({ code: "P2004" })?.code).toBe(
      "PROVIDER_SERVICE_PRICE_INVALID",
    );
    expect(mapPrismaProviderServiceError({ cause: { code: "23514" } })?.code).toBe(
      "PROVIDER_SERVICE_PRICE_INVALID",
    );
    expect(mapPrismaProviderServiceError({ code: "P2025" })?.code).toBe(
      "PROVIDER_SERVICE_NOT_FOUND",
    );
    expect(mapPrismaProviderServiceError({ code: "P2034" })?.details).toMatchObject({
      reason: "SERIALIZATION_FAILURE",
      retryable: true,
    });
  });

  it("returns null for unknowns and preserves ProviderServiceError instances", () => {
    const existing = new ProviderServiceError("PROVIDER_SERVICE_FORBIDDEN");
    expect(mapPrismaProviderServiceError(existing)).toBe(existing);
    expect(mapPrismaProviderServiceError(null)).toBeNull();
    expect(mapPrismaProviderServiceError({ code: "P9999" })).toBeNull();
    expect(mapPrismaProviderServiceError(42)).toBeNull();
  });

  it("builds stale-version conflicts", () => {
    const error = providerServiceStaleVersionError({ hint: true });
    expect(error).toBeInstanceOf(ProviderServiceError);
    expect(error.code).toBe("PROVIDER_SERVICE_VERSION_CONFLICT");
    expect(error.details).toMatchObject({ reason: "STALE_VERSION" });
  });

  it("reads SQL state from nested meta.driverAdapterError.cause", () => {
    expect(
      isProviderServiceSerializationFailure({
        meta: {
          driverAdapterError: {
            cause: { originalCode: "40001" },
          },
        },
      }),
    ).toBe(true);
  });
});

it("maps an internal snapshot race to the documented HTTP version conflict", () => {
  const error = providerServiceErrorToAppError(new ProviderServiceError("PROVIDER_SERVICE_SNAPSHOT_CONFLICT"));
  expect(error.code).toBe("PROVIDER_SERVICE_VERSION_CONFLICT");
  expect(error.statusCode).toBe(409);
});
