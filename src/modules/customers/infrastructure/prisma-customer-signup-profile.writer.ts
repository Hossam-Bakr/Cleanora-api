import type { Prisma } from "#generated/prisma/client";

import type {
  CustomerSignupProfileWriterFactory,
} from "../customer-signup-profile.writer.js";

function required(value: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 200) {
    throw new Error("Customer signup profile input is invalid");
  }
  return normalized;
}

/** Customers-owned persistence participant for Authentication's signup transaction. */
export const createPrismaCustomerSignupProfileWriter: CustomerSignupProfileWriterFactory =
  (transactionValue) => {
    const transaction = transactionValue as Prisma.TransactionClient;
    return {
      async create(userId, input) {
        await transaction.customerProfile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        switch (input.category) {
          case "INDIVIDUAL":
            await transaction.individualProfile.upsert({
              where: { userId },
              create: { userId, fullName: required(input.fullName) },
              update: {},
            });
            return;
          case "COMPANY":
            await transaction.companyProfile.upsert({
              where: { userId },
              create: {
                userId,
                companyName: required(input.companyName),
                representativeFullName: required(
                  input.representativeFullName,
                ),
              },
              update: {},
            });
            return;
          case "ENGINEER":
            await transaction.engineerProfile.upsert({
              where: { userId },
              create: {
                userId,
                fullName: required(input.fullName),
                professionalTitle: required(input.professionalTitle),
              },
              update: {},
            });
        }
      },

      async remove(userId, category) {
        switch (category) {
          case "INDIVIDUAL":
            await transaction.individualProfile.deleteMany({ where: { userId } });
            break;
          case "COMPANY":
            await transaction.companyProfile.deleteMany({ where: { userId } });
            break;
          case "ENGINEER":
            await transaction.engineerProfile.deleteMany({ where: { userId } });
            break;
        }
        const remainingProfiles = await Promise.all([
          transaction.individualProfile.count({ where: { userId } }),
          transaction.companyProfile.count({ where: { userId } }),
          transaction.engineerProfile.count({ where: { userId } }),
        ]);
        if (remainingProfiles.every((count) => count === 0)) {
          await transaction.customerProfile.deleteMany({ where: { userId } });
        }
      },
    };
  };
