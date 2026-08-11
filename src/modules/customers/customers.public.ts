/**
 * Approved public surface for cross-module consumers.
 * Business modules must import from this file only — not from
 * `domain/` or `infrastructure/`.
 */
export const CUSTOMERS_PUBLIC_CONTRACT = "customers.public" as const;

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

/**
 * Customers-owned factory. Implementation lives in infrastructure so this
 * public contract file remains free of Prisma imports.
 */
export function createProviderApplicantProfileReader(
  transaction?: unknown,
): ProviderApplicantProfileReader {
  return createPrismaProviderApplicantProfileReader(transaction);
}
