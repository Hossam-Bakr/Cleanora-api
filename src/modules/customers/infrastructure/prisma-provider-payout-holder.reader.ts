import type { ProviderPayoutHolderAuthorityReader } from "../customers.public.js";
import { getPrismaClient } from "#database/prisma";
import type { Prisma, PrismaClient } from "#generated/prisma/client";

export class PrismaProviderPayoutHolderReader implements ProviderPayoutHolderAuthorityReader {
  public constructor(
    private readonly db: PrismaClient | Prisma.TransactionClient = getPrismaClient(),
    private readonly lockAuthoritativeRows = false,
  ) {}
  public async readLegalNameFacts(input: Parameters<ProviderPayoutHolderAuthorityReader["readLegalNameFacts"]>[0]) {
    if (this.lockAuthoritativeRows) {
      const userIds = [...new Set([input.applicationOwnerUserId, input.activeOwnerUserId])].sort();
      for (const userId of userIds) {
        await this.db.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR SHARE`;
        await this.db.$queryRaw`SELECT id FROM individual_profiles WHERE user_id = ${userId} FOR SHARE`;
        await this.db.$queryRaw`SELECT id FROM company_profiles WHERE user_id = ${userId} FOR SHARE`;
        await this.db.$queryRaw`SELECT id FROM engineer_profiles WHERE user_id = ${userId} FOR SHARE`;
      }
    }
    const [applicant, owner] = await Promise.all([
      this.db.user.findUnique({
        where: { id: input.applicationOwnerUserId },
        select: { individualProfile: true, companyProfile: true, engineerProfile: true },
      }),
      this.db.user.findUnique({
        where: { id: input.activeOwnerUserId },
        select: { individualProfile: true, companyProfile: true, engineerProfile: true },
      }),
    ]);
    const legalEntityName = input.providerKind === "REGISTERED_COMPANY"
      ? applicant?.companyProfile?.companyName ?? null
      : applicant?.individualProfile?.fullName ?? applicant?.engineerProfile?.fullName ?? null;
    const ownerLegalName = owner?.individualProfile?.fullName ?? owner?.engineerProfile?.fullName ?? owner?.companyProfile?.representativeFullName ?? null;
    return { legalEntityName, ownerLegalName };
  }
}

export function createPrismaProviderPayoutHolderAuthorityReader(
  transactionContext?: unknown,
): ProviderPayoutHolderAuthorityReader {
  return transactionContext === undefined
    ? new PrismaProviderPayoutHolderReader()
    : new PrismaProviderPayoutHolderReader(
        transactionContext as Prisma.TransactionClient,
        true,
      );
}
