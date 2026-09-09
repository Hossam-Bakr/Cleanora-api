import { ProviderAvailabilityError } from "../../../src/modules/providers/domain/provider-availability.errors.js";
import {
  isProviderAvailabilitySerializationFailure,
  providerAvailabilitySerializationConflictError,
} from "../../../src/modules/providers/infrastructure/provider-availability-prisma-errors.js";
import {
  runProviderAvailabilityWriteTransactionWithClient,
} from "../../../src/modules/providers/infrastructure/prisma-provider-availability.repository.js";

describe("provider availability serializable unit of work", () => {
  it("succeeds after one serialization failure and reruns the whole callback", async () => {
    let workCalls = 0;
    const client = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work({ tx: workCalls + 1 }),
      ),
    };

    const result = await runProviderAvailabilityWriteTransactionWithClient(
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

    const result = await runProviderAvailabilityWriteTransactionWithClient(
      client as never,
      async () => {
        workCalls += 1;
        if (workCalls <= 2) {
          throw providerAvailabilitySerializationConflictError();
        }
        return "ok";
      },
    );

    expect(result).toBe("ok");
    expect(client.$transaction).toHaveBeenCalledTimes(3);
    expect(workCalls).toBe(3);
  });

  it("does not retry non-serialization ProviderAvailabilityError values", async () => {
    const error = new ProviderAvailabilityError(
      "PROVIDER_AVAILABILITY_IDEMPOTENCY_CONFLICT",
    );
    const client = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work({}),
      ),
    };

    await expect(
      runProviderAvailabilityWriteTransactionWithClient(client as never, async () => {
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
      runProviderAvailabilityWriteTransactionWithClient(client as never, async () => {
        throw { meta: { code: "40001" } };
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
      details: { reason: "SERIALIZATION_FAILURE", retryable: true },
    });
    expect(client.$transaction).toHaveBeenCalledTimes(3);
  });
});

describe("provider availability serialization failure classification", () => {
  it("recognizes retryable Prisma, SQLSTATE, and mapped domain errors only", () => {
    expect(isProviderAvailabilitySerializationFailure({ code: "P2034" })).toBe(true);
    expect(
      isProviderAvailabilitySerializationFailure({
        code: "P2028",
        message: "Transaction closed after serialization failure",
      }),
    ).toBe(true);
    expect(isProviderAvailabilitySerializationFailure({ code: "P2028" })).toBe(
      false,
    );
    expect(
      isProviderAvailabilitySerializationFailure({
        cause: { originalCode: "40P01" },
      }),
    ).toBe(true);
    expect(
      isProviderAvailabilitySerializationFailure(
        new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
          undefined,
          { details: { reason: "SERIALIZATION_FAILURE", retryable: true } },
        ),
      ),
    ).toBe(true);
    expect(
      isProviderAvailabilitySerializationFailure(
        new ProviderAvailabilityError(
          "PROVIDER_AVAILABILITY_VERSION_CONFLICT",
          undefined,
          { details: { reason: "STALE_VERSION" } },
        ),
      ),
    ).toBe(false);
  });
});
