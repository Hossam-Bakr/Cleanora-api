/**
 * Eligibility-owned unit of work (R1-P11 Batch B).
 *
 * Opens an interactive Prisma transaction at RepeatableRead — the isolation
 * level required for evaluation snapshot consistency (DEC-081 / plan.md).
 * Composition supplies this helper; evaluation orchestration (later batches)
 * must not open independent nested transactions for dependency readers.
 */

import { getPrismaClient } from "#database/prisma";
import { Prisma, type PrismaClient } from "#generated/prisma/client";

import { EligibilityError } from "../eligibility.errors.js";
import { isRetryableConflictError } from "../eligibility.technical-errors.js";
import { PrismaEligibilityRepository } from "./prisma-eligibility.repository.js";

const DEFAULT_MAX_WAIT_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 60_000;

export interface EligibilityUnitOfWorkContext {
  readonly eligibility: PrismaEligibilityRepository;
  readonly transaction: Prisma.TransactionClient;
}

export type EligibilityUnitOfWorkOptions = {
  readonly maxWaitMs?: number;
  readonly timeoutMs?: number;
};

/**
 * @desc Eligibility RepeatableRead interactive transaction helper.
 * @access Infrastructure
 * @explanation Mirrors Providers availability/service UoW isolation pattern:
 * evaluation reads and atomic persistence share one RepeatableRead snapshot.
 */
export class EligibilityUnitOfWork {
  public constructor(
    private readonly explicitClient?: PrismaClient,
    private readonly transactionOptions: EligibilityUnitOfWorkOptions = {},
  ) {}

  private get client(): PrismaClient {
    return this.explicitClient ?? getPrismaClient();
  }

  /**
   * @desc Run Eligibility work under RepeatableRead isolation.
   * @access Infrastructure
   * @explanation Maps Prisma interactive-transaction timeouts and serialization
   * failures (P2028, P2034, 40001, 40P01) to CONFLICT so callers can retry.
   */
  public async runRepeatableRead<T>(
    work: (context: EligibilityUnitOfWorkContext) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.$transaction(
        async (transaction) =>
          work({
            eligibility: new PrismaEligibilityRepository(transaction),
            transaction,
          }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          maxWait: this.transactionOptions.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
          timeout: this.transactionOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        },
      );
    } catch (error: unknown) {
      if (isRetryableConflictError(error)) {
        throw new EligibilityError("CONFLICT", {
          details: { reason: "TRANSACTION_CONTENTION" },
          cause: error,
        });
      }
      throw error;
    }
  }
}

/**
 * @desc Convenience helper that constructs a default Eligibility UoW.
 * @access Infrastructure / composition
 */
export function withEligibilityRepeatableRead<T>(
  work: (context: EligibilityUnitOfWorkContext) => Promise<T>,
  options?: EligibilityUnitOfWorkOptions,
): Promise<T> {
  return new EligibilityUnitOfWork(undefined, options).runRepeatableRead(work);
}
