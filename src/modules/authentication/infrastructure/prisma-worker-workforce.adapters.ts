import { createHash } from "node:crypto";

import type { Prisma } from "#generated/prisma/client";

import type {
  TransactionalWorkerIdentityAuthorityWriter,
  TransactionalWorkerIdentityAuthorityWriterFactory,
  TransactionalWorkerIdentityReaderFactory,
  TransactionalWorkerProofUseAuthorizer,
  TransactionalWorkerProofUseAuthorizerFactory,
  WorkerIdentityReader,
} from "../authentication.public.js";

type WorkforceAuthenticationTransaction = Pick<
  Prisma.TransactionClient,
  "user" | "userRole" | "role" | "sensitiveActionProofUse"
>;

export class PrismaWorkerIdentityReader implements WorkerIdentityReader {
  public constructor(private readonly db: WorkforceAuthenticationTransaction) {}

  private async mapUser(user: NonNullable<Awaited<ReturnType<WorkforceAuthenticationTransaction["user"]["findUnique"]>>>) {
    const roleRows = await this.db.userRole.findMany({
      where: { userId: user.id, status: "ENABLED", role: { code: { in: ["worker", "provider_supervisor"] } } },
      select: { role: { select: { code: true } } },
    });
    const roles = new Set(roleRows.map((row) => row.role.code));
    const preference = await this.db.user.findUnique({
      where: { id: user.id }, select: { userPreferences: { select: { language: true } } },
    });
    return {
      userId: user.id,
      status: user.status,
      isAccountActive: user.status === "ACTIVE",
      emailNormalized: user.emailNormalized,
      workerRoleEnabled: roles.has("worker"),
      providerSupervisorRoleEnabled: roles.has("provider_supervisor"),
      preferredLanguage: preference?.userPreferences?.language ?? null,
    } as const;
  }

  public async getIdentity(userId: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    return user === null ? null : this.mapUser(user);
  }

  public async findByEmailNormalized(emailNormalized: string) {
    const user = await this.db.user.findUnique({ where: { emailNormalized } });
    return user === null ? null : this.mapUser(user);
  }
}

export class PrismaWorkerIdentityAuthorityWriter implements TransactionalWorkerIdentityAuthorityWriter {
  public constructor(private readonly db: WorkforceAuthenticationTransaction) {}

  private async reconcile(roleCode: "worker" | "provider_supervisor" | "provider_admin", input: { readonly userId: string; readonly shouldBeEnabled: boolean }): Promise<void> {
    const role = await this.db.role.findUnique({ where: { code: roleCode }, select: { id: true } });
    if (role === null) throw new Error("AUTH_ACCOUNT_UNAVAILABLE");
    const existing = await this.db.userRole.findUnique({ where: { userId_roleId: { userId: input.userId, roleId: role.id } } });
    const now = new Date();
    if (input.shouldBeEnabled) {
      if (existing === null) {
        await this.db.userRole.create({ data: { userId: input.userId, roleId: role.id, status: "ENABLED", assignedAt: now, enabledAt: now } });
      } else if (existing.status !== "ENABLED") {
        await this.db.userRole.update({ where: { id: existing.id }, data: { status: "ENABLED", enabledAt: now, disabledAt: null, revokedAt: null } });
      }
      return;
    }
    if (existing?.status === "ENABLED") await this.db.userRole.update({ where: { id: existing.id }, data: { status: "DISABLED", disabledAt: now } });
  }

  public reconcileWorkerRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }) { return this.reconcile("worker", input); }
  public reconcileProviderSupervisorRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }) { return this.reconcile("provider_supervisor", input); }
  public reconcileProviderAdminRole(input: { readonly userId: string; readonly shouldBeEnabled: boolean }) { return this.reconcile("provider_admin", input); }
}

export class PrismaWorkerProofUseAuthorizer implements TransactionalWorkerProofUseAuthorizer {
  public constructor(private readonly db: WorkforceAuthenticationTransaction) {}

  public async assertConsumed(input: Parameters<TransactionalWorkerProofUseAuthorizer["assertConsumed"]>[0]): Promise<boolean> {
    const earliest = new Date(input.now.getTime() - input.maximumAgeSeconds * 1000);
    const use = await this.db.sensitiveActionProofUse.findFirst({
      where: {
        proofIdHash: createHash("sha256").update(input.proofId).digest("hex"),
        actorUserId: input.actorUserId,
        purpose: input.purpose,
        providerId: input.providerId,
        destinationVersionId: input.workerId,
        requestId: input.requestId,
        authenticatedAt: { gte: earliest, lte: input.now },
      },
      select: { id: true },
    });
    return use !== null;
  }
}

export const createPrismaWorkerIdentityReaderFactory: TransactionalWorkerIdentityReaderFactory =
  (transaction) => new PrismaWorkerIdentityReader(transaction as Prisma.TransactionClient);
export const createPrismaWorkerIdentityAuthorityWriterFactory: TransactionalWorkerIdentityAuthorityWriterFactory =
  (transaction) => new PrismaWorkerIdentityAuthorityWriter(transaction as Prisma.TransactionClient);
export const createPrismaWorkerProofUseAuthorizerFactory: TransactionalWorkerProofUseAuthorizerFactory =
  (transaction) => new PrismaWorkerProofUseAuthorizer(transaction as Prisma.TransactionClient);
