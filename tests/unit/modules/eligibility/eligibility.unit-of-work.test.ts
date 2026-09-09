/**
 * Eligibility UoW RepeatableRead helper (coverage for Batch G).
 */

import { EligibilityError } from "#modules/eligibility/eligibility.errors";
import {
  EligibilityUnitOfWork,
  withEligibilityRepeatableRead,
} from "#modules/eligibility/infrastructure/eligibility.unit-of-work";
import { Prisma } from "#generated/prisma/client";

describe("EligibilityUnitOfWork", () => {
  it("runs work under RepeatableRead and supplies a repository", async () => {
    const transaction = { marker: "tx" };
    const client = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) =>
        work(transaction),
      ),
    };
    const uow = new EligibilityUnitOfWork(client as never);
    const result = await uow.runRepeatableRead(async (context) => {
      expect(context.transaction).toBe(transaction);
      expect(context.eligibility).toBeDefined();
      return "ok";
    });
    expect(result).toBe("ok");
    expect(client.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 15_000,
        timeout: 60_000,
      }),
    );
  });

  it("maps Prisma P2028 timeouts to CONFLICT", async () => {
    const client = {
      $transaction: vi.fn(async () => {
        throw Object.assign(new Error("tx timeout"), { code: "P2028" });
      }),
    };
    const uow = new EligibilityUnitOfWork(client as never);
    await expect(uow.runRepeatableRead(async () => "nope")).rejects.toMatchObject(
      {
        code: "CONFLICT",
        details: { reason: "TRANSACTION_CONTENTION" },
      },
    );
    await expect(
      uow.runRepeatableRead(async () => "nope"),
    ).rejects.toBeInstanceOf(EligibilityError);
  });

  it("rethrows non-timeout errors unchanged", async () => {
    const boom = new Error("other");
    const client = {
      $transaction: vi.fn(async () => {
        throw boom;
      }),
    };
    const uow = new EligibilityUnitOfWork(client as never);
    await expect(uow.runRepeatableRead(async () => "nope")).rejects.toBe(boom);
  });
});

describe("withEligibilityRepeatableRead", () => {
  it("is exported as a convenience helper", () => {
    expect(typeof withEligibilityRepeatableRead).toBe("function");
  });
});
