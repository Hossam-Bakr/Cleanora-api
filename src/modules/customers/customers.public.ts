/**
 * Approved public surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * `domain/` or `infrastructure/`.
 */
export const CUSTOMERS_PUBLIC_CONTRACT = "customers.public" as const;

export interface ProviderPayoutHolderAuthorityReader {
  readLegalNameFacts(input: {
    readonly providerKind: "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY";
    readonly applicationOwnerUserId: string;
    readonly activeOwnerUserId: string;
  }): Promise<{
    readonly legalEntityName: string | null;
    readonly ownerLegalName: string | null;
  }>;
}

export type TransactionalProviderPayoutHolderAuthorityReaderFactory = (
  transaction: unknown,
) => ProviderPayoutHolderAuthorityReader;

/** Provider-applicant categories that Customers may resolve for R1-P05. */
export type ProviderApplicantCategory = "INDIVIDUAL" | "COMPANY";

export interface ProviderApplicantProfileQuery {
  readonly userId: string;
  readonly category: ProviderApplicantCategory;
}

/**
 * Matching-profile facts for Provider eligibility and private Staff review.
 * Never returns preferences, addresses, tax/registration ids, or images.
 */
export type ProviderApplicantProfileResult =
  | {
      readonly category: "INDIVIDUAL";
      readonly profileComplete: boolean;
      readonly fullName: string | null;
    }
  | {
      readonly category: "COMPANY";
      readonly profileComplete: boolean;
      readonly companyName: string | null;
      readonly representativeFullName: string | null;
    };

export interface ProviderApplicantProfileReader {
  readApplicantProfile(
    query: ProviderApplicantProfileQuery,
  ): Promise<ProviderApplicantProfileResult>;
}

import { createPrismaProviderApplicantProfileReader } from "./infrastructure/prisma-provider-applicant-profile.reader.js";
import { createPrismaProviderPayoutHolderAuthorityReader } from "./infrastructure/prisma-provider-payout-holder.reader.js";

/** Customers-owned payout-holder authority reader with an optional transaction context. */
export function createProviderPayoutHolderAuthorityReader(
  transaction?: unknown,
): ProviderPayoutHolderAuthorityReader {
  return createPrismaProviderPayoutHolderAuthorityReader(transaction);
}

/**
 * Customers-owned factory. Implementation lives in infrastructure so this
 * public contract file remains free of Prisma imports.
 */
export function createProviderApplicantProfileReader(
  transaction?: unknown,
): ProviderApplicantProfileReader {
  return createPrismaProviderApplicantProfileReader(transaction);
}
