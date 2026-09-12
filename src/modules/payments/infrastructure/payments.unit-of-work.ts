import { getPrismaClient } from "#database/prisma";
import type { PrismaClient } from "#generated/prisma/client";

import type {
  PaymentsRepository,
  PaymentsUnitOfWork as PaymentsUnitOfWorkPort,
} from "../payments.repository.js";
import { PrismaPaymentsRepository } from "./prisma-payments.repository.js";

/**
 * @desc Payments-owned transaction helper.
 * @access Infrastructure / composition
 */
export class PaymentsUnitOfWork implements PaymentsUnitOfWorkPort {
  public constructor(private readonly explicitClient?: PrismaClient) {}

  /**
   * @desc Run ledger writes in one payments-owned transaction.
   * @access Infrastructure
   */
  public async run<T>(
    work: (repository: PaymentsRepository) => Promise<T>,
  ): Promise<T> {
    const client = this.explicitClient ?? getPrismaClient();
    return client.$transaction(async (transaction) =>
      work(new PrismaPaymentsRepository(transaction)),
    );
  }
}
