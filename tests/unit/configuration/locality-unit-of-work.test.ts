import {
  isLocalitySerializationFailure,
  localitySerializationConflictError,
} from "../../../src/modules/configuration/infrastructure/locality-serialization-errors.js";
import {
  runLocalityTransactionWithClient,
} from "../../../src/modules/configuration/infrastructure/prisma-locality.repository.js";
import { LocalityError } from "../../../src/modules/configuration/locality.types.js";

describe("locality serializable unit of work", () => {
  it("succeeds after one serialization failure and reruns the whole callback", async () => {
    let workCalls = 0;
    const client = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work({ tx: workCalls + 1 }),
      ),
    };

    const result = await runLocalityTransactionWithClient(
      client as never,
      async () => {
        workCalls += 1;
        if (workCalls === 1) {
          throw { code: "P2034" };
        }
        return "ok";
      },
    );

    expect(result).toBe("ok");
    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(workCalls).toBe(2);
  });

  it("succeeds on the third attempt after two serialization failures", async () => {
    let workCalls = 0;
    const client = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work({ tx: workCalls + 1 }),
      ),
    };

    const result = await runLocalityTransactionWithClient(
      client as never,
      async () => {
        workCalls += 1;
        if (workCalls <= 2) {
          throw localitySerializationConflictError();
        }
        return "ok";
      },
    );

    expect(result).toBe("ok");
    expect(client.$transaction).toHaveBeenCalledTimes(3);
    expect(workCalls).toBe(3);
  });

  it("does not retry non-serialization LocalityError values", async () => {
    const error = new LocalityError("LOCALITY_IDEMPOTENCY_CONFLICT");
    const client = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work({}),
      ),
    };

    await expect(
      runLocalityTransactionWithClient(client as never, async () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
  });

  it("maps exhaustion after three serialization failures to a stable conflict", async () => {
    const client = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work({}),
      ),
    };

    await expect(
      runLocalityTransactionWithClient(client as never, async () => {
        throw { meta: { code: "40001" } };
      }),
    ).rejects.toMatchObject({
      code: "LOCALITY_VERSION_CONFLICT",
      details: { reason: "SERIALIZATION_FAILURE", retryable: true },
    });
    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe("locality serialization failure classification", () => {
  it("recognizes retryable Prisma, SQLSTATE, and mapped domain errors only", () => {
    expect(isLocalitySerializationFailure({ code: "P2034" })).toBe(true);
    expect(
      isLocalitySerializationFailure({
        code: "P2028",
        message: "Transaction closed after deadlock",
      }),
    ).toBe(true);
    expect(isLocalitySerializationFailure({ code: "P2028" })).toBe(false);
    expect(
      isLocalitySerializationFailure({
        meta: { driverAdapterError: { cause: { originalCode: "40P01" } } },
      }),
    ).toBe(true);
    expect(
      isLocalitySerializationFailure(
        new LocalityError("LOCALITY_VERSION_CONFLICT", undefined, {
          details: { reason: "SERIALIZATION_FAILURE", retryable: true },
        }),
      ),
    ).toBe(true);
    expect(
      isLocalitySerializationFailure(
        new LocalityError("LOCALITY_VERSION_CONFLICT", undefined, {
          details: { reason: "STALE_VERSION" },
        }),
      ),
    ).toBe(false);
  });
});
