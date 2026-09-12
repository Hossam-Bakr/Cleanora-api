import { PaymentsUnitOfWork } from "#modules/payments/infrastructure/payments.unit-of-work";

describe("R1-P14 payments unit of work", () => {
  it("runs work inside one transaction", async () => {
    const transaction = {
      ledgerAccount: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const client = {
      $transaction: vi.fn(async (work: (tx: unknown) => Promise<string>) =>
        work(transaction),
      ),
    };
    const unitOfWork = new PaymentsUnitOfWork(client as never);
    const result = await unitOfWork.run(async (repository) => {
      await repository.findAccounts("country-eg", "EGP");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.ledgerAccount.findMany).toHaveBeenCalled();
  });
});
