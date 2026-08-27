import { getPrismaClient } from "#database/prisma";
import type { Prisma } from "#generated/prisma/client";
import type { GeneralTransactionalAuditWriter } from "#modules/admin/audit.public";
import type {
  TransactionalWorkerIdentityAuthorityWriterFactory,
  TransactionalWorkerIdentityReaderFactory,
  TransactionalWorkerProofUseAuthorizerFactory,
} from "#modules/authentication/authentication.public";
import type { TransactionalWorkerAvatarAuthorizerFactory } from "#modules/media/media.public";

import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
} from "../domain/provider-workforce.types.js";
import { PrismaProviderWorkforceCommandRepository } from "./prisma-provider-workforce-command.repository.js";
import { PrismaProviderWorkforceHistoryRepository } from "./prisma-provider-workforce-history.repository.js";
import { PrismaProviderWorkforceNotificationRepository } from "./prisma-provider-workforce-notification.repository.js";
import { PrismaProviderWorkforceRepository } from "./prisma-provider-workforce.repository.js";
import { mapPrismaWorkforceError } from "./provider-workforce.prisma-errors.js";

export type WorkforceAuditWriterFactory = (transaction: Prisma.TransactionClient) => GeneralTransactionalAuditWriter;

export class PrismaProvidersWorkforceUnitOfWork implements ProvidersWorkforceUnitOfWorkPort {
  public constructor(
    private readonly createIdentityReader: TransactionalWorkerIdentityReaderFactory,
    private readonly createIdentityAuthority: TransactionalWorkerIdentityAuthorityWriterFactory,
    private readonly createProofUseAuthorizer: TransactionalWorkerProofUseAuthorizerFactory,
    private readonly createAvatarAuthorizer: TransactionalWorkerAvatarAuthorizerFactory,
    private readonly createAudit: WorkforceAuditWriterFactory,
  ) {}

  public async run<T>(callback: (context: ProvidersWorkforceTransactionContext) => Promise<T>): Promise<T> {
    try {
      return await getPrismaClient().$transaction(async (transaction): Promise<T> => callback({
        workforce: new PrismaProviderWorkforceRepository(transaction),
        commands: new PrismaProviderWorkforceCommandRepository(transaction),
        history: new PrismaProviderWorkforceHistoryRepository(transaction),
        notifications: new PrismaProviderWorkforceNotificationRepository(transaction),
        identityReader: this.createIdentityReader(transaction),
        identityAuthority: this.createIdentityAuthority(transaction),
        proofUseAuthorizer: this.createProofUseAuthorizer(transaction),
        avatarAuthorizer: this.createAvatarAuthorizer(transaction),
        audit: this.createAudit(transaction),
      }), { maxWait: 15_000, timeout: 60_000 });
    } catch (error: unknown) {
      const mapped = mapPrismaWorkforceError(error);
      if (mapped !== null) throw mapped;
      throw error;
    }
  }
}
