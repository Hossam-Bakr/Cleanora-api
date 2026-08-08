import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import type {
  GeneralTransactionalAuditWriter,
  PrivilegedAuditWriter,
} from "#modules/admin/audit.service";

/**
 * Factories injected by composition. Customers must never import Admin Prisma
 * writer implementations directly.
 */
export type GeneralTransactionalAuditWriterFactory = (
  transaction: Prisma.TransactionClient,
) => GeneralTransactionalAuditWriter;

export type PrivilegedTransactionalAuditWriterFactory = (
  transaction: Prisma.TransactionClient,
) => PrivilegedAuditWriter;

export interface CustomersTransactionContext {
  readonly prisma: Prisma.TransactionClient;
  readonly generalAudit: GeneralTransactionalAuditWriter;
  readonly privilegedAudit: PrivilegedAuditWriter;
}

/**
 * Customers-owned unit of work. Accepts only transactional audit writer
 * factories (general + privileged). The non-TX denial writer must not be
 * accepted or invoked inside this UoW.
 */
export class PrismaCustomersUnitOfWork {
  public constructor(
    private readonly createGeneralAudit: GeneralTransactionalAuditWriterFactory,
    private readonly createPrivilegedAudit: PrivilegedTransactionalAuditWriterFactory,
    private readonly transactionOptions: {
      readonly maxWaitMs?: number;
      readonly timeoutMs?: number;
    } = {},
  ) {}

  public async run<T>(
    work: (context: CustomersTransactionContext) => Promise<T>,
  ): Promise<T> {
    return getPrismaClient().$transaction(
      async (transaction) =>
        work({
          prisma: transaction,
          generalAudit: this.createGeneralAudit(transaction),
          privilegedAudit: this.createPrivilegedAudit(transaction),
        }),
      {
        maxWait: this.transactionOptions.maxWaitMs ?? 2_000,
        timeout: this.transactionOptions.timeoutMs ?? 5_000,
      },
    );
  }
}
