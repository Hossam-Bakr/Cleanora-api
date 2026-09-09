import {
  isProviderAvailabilitySerializationFailure,
  mapPrismaProviderAvailabilityError,
  providerAvailabilitySerializationConflictError,
} from "../../../src/modules/providers/infrastructure/provider-availability-prisma-errors.js";
import { ProviderAvailabilityError } from "../../../src/modules/providers/domain/provider-availability.errors.js";

describe("provider-availability-prisma-errors mapping", () => {
  it("passes through ProviderAvailabilityError instances", () => {
    const original = new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_VALIDATION_FAILED",
    );
    expect(mapPrismaProviderAvailabilityError(original)).toBe(original);
  });

  it("returns null for non-object failures", () => {
    expect(mapPrismaProviderAvailabilityError("boom")).toBeNull();
    expect(mapPrismaProviderAvailabilityError(null)).toBeNull();
  });

  it("maps serialization Prisma codes and SQLSTATEs", () => {
    expect(
      mapPrismaProviderAvailabilityError({ code: "P2034" })?.code,
    ).toBe("PROVIDER_AVAILABILITY_VERSION_CONFLICT");
    expect(
      mapPrismaProviderAvailabilityError({
        meta: { code: "40001" },
      })?.details,
    ).toEqual({ reason: "SERIALIZATION_FAILURE", retryable: true });
    expect(
      mapPrismaProviderAvailabilityError({
        cause: { originalCode: "40P01" },
      })?.code,
    ).toBe("PROVIDER_AVAILABILITY_VERSION_CONFLICT");
    expect(
      mapPrismaProviderAvailabilityError({
        code: "P2028",
        message: "could not serialize access due to concurrent update",
      })?.code,
    ).toBe("PROVIDER_AVAILABILITY_VERSION_CONFLICT");
  });

  it("maps unique races for receipts, pause, and generic uniques", () => {
    expect(
      mapPrismaProviderAvailabilityError({
        code: "P2002",
        meta: { target: ["scope_key", "idempotency_key"] },
      })?.details,
    ).toEqual({ reason: "RECEIPT_UNIQUE_RACE" });
    expect(
      mapPrismaProviderAvailabilityError({
        code: "P2002",
        meta: {
          constraint: "provider_temporary_pauses_one_unresolved_per_provider",
        },
      })?.code,
    ).toBe("PROVIDER_AVAILABILITY_PAUSE_CONFLICT");
    expect(
      mapPrismaProviderAvailabilityError({
        meta: { code: "23505" },
        message: "duplicate key",
      })?.details,
    ).toEqual({ reason: "UNIQUE_CONSTRAINT_CONFLICT" });
  });

  it("maps foreign-key and check constraint SQLSTATEs via driver adapter nesting", () => {
    expect(
      mapPrismaProviderAvailabilityError({
        meta: {
          driverAdapterError: {
            cause: { originalCode: "23503" },
          },
        },
      })?.details,
    ).toEqual({ reason: "FOREIGN_KEY_VIOLATION" });
    expect(
      mapPrismaProviderAvailabilityError({
        code: "P2004",
        message: "check constraint",
      })?.details,
    ).toEqual({ reason: "CHECK_CONSTRAINT_VIOLATION" });
    expect(
      mapPrismaProviderAvailabilityError({
        cause: { code: "23514" },
      })?.code,
    ).toBe("PROVIDER_AVAILABILITY_COVERAGE_INVALID");
  });

  it("detects retryable serialization failures including already-mapped errors", () => {
    const mapped = providerAvailabilitySerializationConflictError();
    expect(isProviderAvailabilitySerializationFailure(mapped)).toBe(true);
    expect(isProviderAvailabilitySerializationFailure({ code: "P2034" })).toBe(
      true,
    );
    expect(
      isProviderAvailabilitySerializationFailure({
        code: "P2028",
        message: "write conflict",
      }),
    ).toBe(true);
    expect(isProviderAvailabilitySerializationFailure({ code: "P2002" })).toBe(
      false,
    );
    expect(isProviderAvailabilitySerializationFailure("x")).toBe(false);
  });
});
