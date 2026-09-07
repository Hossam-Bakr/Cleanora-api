/**
 * Providers-owned unit of work for R1-P09 Provider Service mutations and
 * repeatable-read snapshot reads. Composition supplies public Catalog,
 * Configuration, Authentication, and Admin factories; domain/services never
 * receive the raw Prisma transaction.
 */

import { getPrismaClient } from "#database/prisma";
import { Prisma, type PrismaClient } from "#generated/prisma/client";
import type { GeneralTransactionalAuditWriter } from "#modules/admin/audit.public";
import type { TransactionalProviderServiceStaffAuthorizer } from "#modules/authentication/authentication.public";
import { createTransactionalProviderIdentityReader } from "#modules/authentication/authentication.public";
import type { CatalogDefinitionReader } from "#modules/catalog/catalog.public";
import type { ProviderServicePricingPolicyReader } from "#modules/configuration/configuration.public";

import type {
  ProviderServiceTransactionContext,
  ProviderServiceUnitOfWork,
} from "../domain/provider-service.ports.js";
import { PrismaProviderServiceRepository } from "./prisma-provider-service.repository.js";
import { mapPrismaProviderServiceError } from "./provider-service-prisma-errors.js";

export type ProviderServiceCatalogReaderFactory = (
  transaction: Prisma.TransactionClient,
) => CatalogDefinitionReader;

export type ProviderServicePricingPolicyReaderFactory = (
  transaction: Prisma.TransactionClient,
) => ProviderServicePricingPolicyReader;

export type ProviderServiceStaffAuthorizerFactory = (
  transaction: Prisma.TransactionClient,
) => TransactionalProviderServiceStaffAuthorizer;

export type ProviderServiceAuditWriterFactory = (
  transaction: Prisma.TransactionClient,
) => GeneralTransactionalAuditWriter;

const DEFAULT_MAX_WAIT_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * @desc Providers serializable/repeatable-read UoW for Provider Service workflows.
 * @access Infrastructure
 * @explanation Mutation isolation is Serializable; readiness and snapshot reads
 * use RepeatableRead. Serialization failures map to retryable snapshot conflicts.
 */
export class PrismaProviderServiceUnitOfWork
  implements ProviderServiceUnitOfWork
{
  public constructor(
    private readonly createCatalogReader: ProviderServiceCatalogReaderFactory,
    private readonly createPricingPolicyReader: ProviderServicePricingPolicyReaderFactory,
    private readonly createStaffAuthorizer: ProviderServiceStaffAuthorizerFactory,
    private readonly createAuditWriter: ProviderServiceAuditWriterFactory,
    private readonly explicitClient?: PrismaClient,
    private readonly transactionOptions: {
      readonly maxWaitMs?: number;
      readonly timeoutMs?: number;
    } = {},
  ) {}

  private get client(): PrismaClient {
    return this.explicitClient ?? getPrismaClient();
  }

  /**
   * @desc Run a Providers-owned mutation under Serializable isolation.
   * @access Infrastructure
   */
  public async runMutation<T>(
    work: (context: ProviderServiceTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.runWithIsolation(
      Prisma.TransactionIsolationLevel.Serializable,
      work,
    );
  }

  /**
   * @desc Run a readiness/snapshot read under RepeatableRead isolation.
   * @access Infrastructure
   */
  public async runReadSnapshot<T>(
    work: (context: ProviderServiceTransactionContext) => Promise<T>,
  ): Promise<T> {
    return this.runWithIsolation(
      Prisma.TransactionIsolationLevel.RepeatableRead,
      work,
    );
  }

  private async runWithIsolation<T>(
    isolationLevel: Prisma.TransactionIsolationLevel,
    work: (context: ProviderServiceTransactionContext) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.client.$transaction(
        async (transaction) =>
          work({
            identityReader: createTransactionalProviderIdentityReader(transaction),
            providerServices: new PrismaProviderServiceRepository(transaction),
            catalog: this.createCatalogReader(transaction),
            pricingPolicy: this.createPricingPolicyReader(transaction),
            staffAuthorizer: this.createStaffAuthorizer(transaction),
            audit: this.createAuditWriter(transaction),
          }),
        {
          isolationLevel,
          maxWait: this.transactionOptions.maxWaitMs ?? DEFAULT_MAX_WAIT_MS,
          timeout: this.transactionOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        },
      );
    } catch (error: unknown) {
      const mapped = mapPrismaProviderServiceError(error);
      if (mapped !== null) {
        throw mapped;
      }
      throw error;
    }
  }
}
