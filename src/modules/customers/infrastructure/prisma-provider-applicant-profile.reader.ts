import type { Prisma, PrismaClient } from "#generated/prisma/client";

import { getPrismaClient } from "#database/prisma";

import { PrismaProfileRepository } from "./prisma-profile.repository.js";
import type {
  ProviderApplicantProfileQuery,
  ProviderApplicantProfileReader,
  ProviderApplicantProfileResult,
} from "../customers.public.js";

function isNonEmpty(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Customers-owned applicant profile reader implementation.
 * Kept in infrastructure so the public contract file stays Prisma-free.
 */
export function createPrismaProviderApplicantProfileReader(
  suppliedClient?: unknown,
): ProviderApplicantProfileReader {
  const client = (suppliedClient ?? getPrismaClient()) as
    | PrismaClient
    | Prisma.TransactionClient;
  const repository = new PrismaProfileRepository();

  return {
    async readApplicantProfile(
      query: ProviderApplicantProfileQuery,
    ): Promise<ProviderApplicantProfileResult> {
      const view = "$transaction" in client
        ? await client.$transaction((transaction) =>
            repository.get(transaction, query.userId, query.category),
          )
        : await repository.get(client, query.userId, query.category);

      if (query.category === "INDIVIDUAL") {
        const fullName = isNonEmpty(view.fullName) ? view.fullName.trim() : null;
        return {
          category: "INDIVIDUAL",
          profileComplete: view.created && fullName !== null,
          fullName,
        };
      }

      const companyName = isNonEmpty(view.companyName)
        ? view.companyName.trim()
        : null;
      const representativeFullName = isNonEmpty(view.representativeFullName)
        ? view.representativeFullName.trim()
        : null;
      return {
        category: "COMPANY",
        profileComplete:
          view.created &&
          companyName !== null &&
          representativeFullName !== null,
        companyName,
        representativeFullName,
      };
    },
  };
}
