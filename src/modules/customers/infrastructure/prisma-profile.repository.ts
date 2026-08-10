import type { Prisma } from "#generated/prisma/client";

import type {
  CustomerProfileView,
  ProfileInput,
} from "../domain/customers.types.js";
import type { SupportedCustomerCategory } from "../domain/customer-self.policy.js";

type Transaction = Prisma.TransactionClient;

export class PrismaProfileRepository {
  public async get(
    transaction: Transaction,
    userId: string,
    category: SupportedCustomerCategory,
  ): Promise<CustomerProfileView> {
    switch (category) {
      case "INDIVIDUAL": {
        const profile = await transaction.individualProfile.findUnique({
          where: { userId },
        });
        return profile === null
          ? { category, created: false }
          : { category, created: true, fullName: profile.fullName };
      }
      case "COMPANY": {
        const profile = await transaction.companyProfile.findUnique({
          where: { userId },
        });
        return profile === null
          ? { category, created: false }
          : {
              category,
              created: true,
              companyName: profile.companyName,
              representativeFullName: profile.representativeFullName,
              commercialRegistrationNumber:
                profile.commercialRegistrationNumber,
              taxRegistrationNumber: profile.taxRegistrationNumber,
            };
      }
      case "ENGINEER": {
        const profile = await transaction.engineerProfile.findUnique({
          where: { userId },
        });
        return profile === null
          ? { category, created: false }
          : {
              category,
              created: true,
              fullName: profile.fullName,
              professionalTitle: profile.professionalTitle,
            };
      }
    }
  }

  public async upsert(
    transaction: Transaction,
    userId: string,
    input: ProfileInput,
  ): Promise<CustomerProfileView> {
    await transaction.customerProfile.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    switch (input.category) {
      case "INDIVIDUAL": {
        const profile = await transaction.individualProfile.upsert({
          where: { userId },
          create: { userId, fullName: input.fullName },
          update: { fullName: input.fullName },
        });
        return {
          category: input.category,
          created: true,
          fullName: profile.fullName,
        };
      }
      case "COMPANY": {
        const profile = await transaction.companyProfile.upsert({
          where: { userId },
          create: {
            userId,
            companyName: input.companyName,
            representativeFullName: input.representativeFullName,
            commercialRegistrationNumber:
              input.commercialRegistrationNumber,
            taxRegistrationNumber: input.taxRegistrationNumber,
          },
          update: {
            companyName: input.companyName,
            representativeFullName: input.representativeFullName,
            commercialRegistrationNumber:
              input.commercialRegistrationNumber,
            taxRegistrationNumber: input.taxRegistrationNumber,
          },
        });
        return {
          category: input.category,
          created: true,
          companyName: profile.companyName,
          representativeFullName: profile.representativeFullName,
          commercialRegistrationNumber: profile.commercialRegistrationNumber,
          taxRegistrationNumber: profile.taxRegistrationNumber,
        };
      }
      case "ENGINEER": {
        const profile = await transaction.engineerProfile.upsert({
          where: { userId },
          create: {
            userId,
            fullName: input.fullName,
            professionalTitle: input.professionalTitle,
          },
          update: {
            fullName: input.fullName,
            professionalTitle: input.professionalTitle,
          },
        });
        return {
          category: input.category,
          created: true,
          fullName: profile.fullName,
          professionalTitle: profile.professionalTitle,
        };
      }
    }
  }
}
