
import { ProviderServiceError } from "../../../src/modules/providers/domain/provider-service.errors.js";
import { PrismaProviderServiceUnitOfWork } from "../../../src/modules/providers/infrastructure/prisma-provider-service.unit-of-work.js";

describe("prisma-provider-service.unit-of-work", () => {
  it("runs mutation and read snapshots through $transaction with isolation levels", async () => {
    const transaction = { tag: "tx" };
    type TransactionOptions = {
      isolationLevel: string;
      maxWait?: number;
      timeout?: number;
    };
    const client = {
      $transaction: vi.fn(
        async (
          work: (tx: unknown) => Promise<unknown>,
          _options?: TransactionOptions,
        ) => work(transaction),
      ),
    };

    const catalog = vi.fn(() => ({ listSelectable: vi.fn() }));
    const pricing = vi.fn(() => ({ readForCountry: vi.fn() }));
    const staff = vi.fn(() => ({ authorize: vi.fn() }));
    const audit = vi.fn(() => ({ append: vi.fn() }));

    const uow = new PrismaProviderServiceUnitOfWork(
      catalog as never,
      pricing as never,
      staff as never,
      audit as never,
      client as never,
      { maxWaitMs: 100, timeoutMs: 200 },
    );

    const mutationResult = await uow.runMutation(async (context) => {
      expect(context.providerServices).toBeDefined();
      expect(context.catalog).toBeDefined();
      expect(context.pricingPolicy).toBeDefined();
      expect(context.staffAuthorizer).toBeDefined();
      expect(context.audit).toBeDefined();
      return "mutated";
    });
    expect(mutationResult).toBe("mutated");

    const readResult = await uow.runReadSnapshot(async () => "read");
    expect(readResult).toBe("read");

    expect(client.$transaction).toHaveBeenCalledTimes(2);
    expect(catalog).toHaveBeenCalledWith(transaction);
    expect(pricing).toHaveBeenCalledWith(transaction);
    expect(staff).toHaveBeenCalledWith(transaction);
    expect(audit).toHaveBeenCalledWith(transaction);

    const firstOptions = client.$transaction.mock.calls[0]?.[1];
    expect(firstOptions).toEqual(
      expect.objectContaining({
        isolationLevel: expect.stringContaining("Serializable"),
        maxWait: 100,
        timeout: 200,
      }),
    );

    const secondOptions = client.$transaction.mock.calls[1]?.[1];
    expect(secondOptions).toEqual(
      expect.objectContaining({
        isolationLevel: expect.stringContaining("RepeatableRead"),
      }),
    );
  });

  it("maps Prisma serialization failures thrown by $transaction", async () => {
    const client = {
      $transaction: vi.fn(async () => {
        throw { code: "P2034" };
      }),
    };
    const uow = new PrismaProviderServiceUnitOfWork(
      () => ({}) as never,
      () => ({}) as never,
      () => ({}) as never,
      () => ({}) as never,
      client as never,
    );

    await expect(uow.runMutation(async () => "x")).rejects.toBeInstanceOf(
      ProviderServiceError,
    );
    await expect(uow.runMutation(async () => "x")).rejects.toMatchObject({
      code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
    });
  });

  it("rethrows unmapped errors", async () => {
    const boom = new Error("connection reset");
    const client = {
      $transaction: vi.fn(async () => {
        throw boom;
      }),
    };
    const uow = new PrismaProviderServiceUnitOfWork(
      () => ({}) as never,
      () => ({}) as never,
      () => ({}) as never,
      () => ({}) as never,
      client as never,
    );

    await expect(uow.runReadSnapshot(async () => "x")).rejects.toBe(boom);
  });
});
