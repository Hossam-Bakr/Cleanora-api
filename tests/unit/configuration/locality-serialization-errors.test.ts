import {
  isLocalitySerializationFailure,
  localitySerializationConflictError,
  mapPrismaLocalityPersistenceError,
} from "../../../src/modules/configuration/infrastructure/locality-serialization-errors.js";
import { LocalityError } from "../../../src/modules/configuration/locality.types.js";

describe("locality-serialization-errors mapping", () => {
  it("recognizes already-mapped serialization conflicts", () => {
    const mapped = localitySerializationConflictError();
    expect(isLocalitySerializationFailure(mapped)).toBe(true);
    expect(mapped.code).toBe("LOCALITY_VERSION_CONFLICT");
  });

  it("returns false for non-objects and unrelated errors", () => {
    expect(isLocalitySerializationFailure("boom")).toBe(false);
    expect(isLocalitySerializationFailure(null)).toBe(false);
    expect(
      isLocalitySerializationFailure(
        new LocalityError("LOCALITY_CITY_NOT_FOUND"),
      ),
    ).toBe(false);
    expect(isLocalitySerializationFailure({ code: "P2002" })).toBe(false);
  });

  it("maps Prisma serialization codes and nested SQLSTATEs", () => {
    expect(isLocalitySerializationFailure({ code: "P2034" })).toBe(true);
    expect(
      isLocalitySerializationFailure({
        meta: { code: "40001" },
      }),
    ).toBe(true);
    expect(
      isLocalitySerializationFailure({
        cause: { originalCode: "40P01" },
      }),
    ).toBe(true);
    expect(
      isLocalitySerializationFailure({
        cause: { code: "40001" },
      }),
    ).toBe(true);
    expect(
      isLocalitySerializationFailure({
        meta: {
          driverAdapterError: {
            cause: { originalCode: "40P01" },
          },
        },
      }),
    ).toBe(true);
  });

  it("treats closed-transaction codes as serialization when hints match", () => {
    expect(
      isLocalitySerializationFailure({
        code: "P2028",
        message: "could not serialize access due to concurrent update",
      }),
    ).toBe(true);
    expect(
      isLocalitySerializationFailure({
        code: "P2028",
        meta: { target: ["write conflict"] },
      }),
    ).toBe(true);
    expect(
      isLocalitySerializationFailure({
        code: "P2028",
        meta: { constraint: ["deadlock"] },
      }),
    ).toBe(true);
    expect(
      isLocalitySerializationFailure({
        code: "P2028",
        message: "transaction already closed",
      }),
    ).toBe(false);
  });

  it("maps unique and foreign-key persistence failures to stable locality errors", () => {
    expect(mapPrismaLocalityPersistenceError({ code: "P2002" })).toMatchObject({
      code: "LOCALITY_ALREADY_EXISTS",
      details: { reason: "UNIQUE_CONSTRAINT_CONFLICT" },
    });
    expect(
      mapPrismaLocalityPersistenceError({
        meta: { driverAdapterError: { cause: { originalCode: "23505" } } },
      }),
    ).toMatchObject({ code: "LOCALITY_ALREADY_EXISTS" });
    expect(mapPrismaLocalityPersistenceError({ code: "P2003" })).toMatchObject({
      code: "LOCALITY_DEPENDENCY_FAILED",
      details: { reason: "FOREIGN_KEY_VIOLATION" },
    });
    expect(mapPrismaLocalityPersistenceError({ code: "P9999" })).toBeNull();
  });
});
