import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import type {
  GeneralTransactionalAuditWriter,
  PrivilegedAuditWriter,
} from "#modules/admin/audit.public";

import { providersError } from "../domain/providers.errors.js";
import type {
  ProviderEmailOutboxRepositoryPort,
  ProviderIdentityAuthorityWriterPort,
  ProviderIdentityReaderPort,
  ProviderApplicantProfileReaderPort,
  ActiveCountryReaderPort,
  ProviderMediaReaderPort,
  ProviderRepositoryPort,
  ProvidersUnitOfWorkPort,
} from "../domain/providers.ports.js";
import type { ProtectedOperationAuthorizer } from "#modules/authentication/authentication.public";
import { PrismaProviderEmailOutboxRepository } from "./prisma-provider-email-outbox.repository.js";
import { PrismaProviderRepository } from "./prisma-provider.repository.js";

/**
 * Factories injected by composition. Providers never imports Admin or
 * Authentication Prisma writer implementations directly.
 */
export type GeneralTransactionalAuditWriterFactory = (
  transaction: Prisma.TransactionClient,
) => GeneralTransactionalAuditWriter;

export type PrivilegedTransactionalAuditWriterFactory = (
  transaction: Prisma.TransactionClient,
) => PrivilegedAuditWriter;

export type ProviderIdentityAuthorityWriterFactory = (
  transaction: Prisma.TransactionClient,
) => ProviderIdentityAuthorityWriterPort;
export type ProviderIdentityReaderFactory = (
  transaction: Prisma.TransactionClient,
) => ProviderIdentityReaderPort;
export type ProviderApplicantProfileReaderFactory = (
  transaction: Prisma.TransactionClient,
) => ProviderApplicantProfileReaderPort;
export type ProviderActiveCountryReaderFactory = (
  transaction: Prisma.TransactionClient,
) => ActiveCountryReaderPort;
export type ProviderAuthorizationFactory = (
  transaction: Prisma.TransactionClient,
) => ProtectedOperationAuthorizer;
export type ProviderMediaReaderFactory = (
  transaction: Prisma.TransactionClient,
) => ProviderMediaReaderPort;

export interface ProvidersTransactionContext {
  readonly providers: ProviderRepositoryPort;
  readonly emailOutbox: ProviderEmailOutboxRepositoryPort;
  readonly identityAuthority: ProviderIdentityAuthorityWriterPort;
  readonly identityReader: ProviderIdentityReaderPort;
  readonly applicantProfiles: ProviderApplicantProfileReaderPort;
  readonly activeCountries: ActiveCountryReaderPort;
  readonly mediaReader: ProviderMediaReaderPort;
  readonly authorization: ProtectedOperationAuthorizer;
  readonly generalAudit: GeneralTransactionalAuditWriter;
  readonly privilegedAudit: PrivilegedAuditWriter;
}

function isPrismaTransactionTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2028"
  );
}

/**
 * Providers-owned unit of work. Accepts Admin audit and Authentication
 * authority writer factories; denial audit stays outside this transaction.
 */
export class PrismaProvidersUnitOfWork implements ProvidersUnitOfWorkPort {
  public constructor(
    private readonly createGeneralAudit: GeneralTransactionalAuditWriterFactory,
    private readonly createPrivilegedAudit: PrivilegedTransactionalAuditWriterFactory,
    private readonly createIdentityAuthority: ProviderIdentityAuthorityWriterFactory,
    private readonly createIdentityReader: ProviderIdentityReaderFactory,
    private readonly createApplicantProfiles: ProviderApplicantProfileReaderFactory,
    private readonly createActiveCountries: ProviderActiveCountryReaderFactory,
    private readonly createAuthorization: ProviderAuthorizationFactory,
    private readonly createMediaReader: ProviderMediaReaderFactory,
    private readonly transactionOptions: {
      readonly maxWaitMs?: number;
      readonly timeoutMs?: number;
    } = {},
  ) {}

  public async run<T>(
    work: (context: ProvidersTransactionContext) => Promise<T>,
  ): Promise<T> {
    try {
      return await getPrismaClient().$transaction(
        async (transaction) =>
          work({
            providers: new PrismaProviderRepository(transaction),
            emailOutbox: new PrismaProviderEmailOutboxRepository(transaction),
            identityAuthority: this.createIdentityAuthority(transaction),
            identityReader: this.createIdentityReader(transaction),
            applicantProfiles: this.createApplicantProfiles(transaction),
            activeCountries: this.createActiveCountries(transaction),
            authorization: this.createAuthorization(transaction),
            mediaReader: this.createMediaReader(transaction),
            generalAudit: this.createGeneralAudit(transaction),
            privilegedAudit: this.createPrivilegedAudit(transaction),
          }),
        {
          maxWait: this.transactionOptions.maxWaitMs ?? 15_000,
          timeout: this.transactionOptions.timeoutMs ?? 60_000,
        },
      );
    } catch (error) {
      if (isPrismaTransactionTimeout(error)) {
        throw providersError("PROVIDER_STATE_CONFLICT", {
          reason: "TRANSACTION_CONTENTION",
        });
      }
      throw error;
    }
  }
}
