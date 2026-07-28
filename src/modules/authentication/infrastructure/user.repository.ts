import { Prisma } from "#generated/prisma/client";
import { getPrismaClient } from "#integrations/database/index";
import type { AccountCategory } from "../domain/authentication.types.js";
import { mapIdentity } from "./authentication.mapper.js";

export class UserRepository {
  findByPhone(phoneE164: string) {
    return getPrismaClient().user.findUnique({ where: { phoneE164 } });
  }
  findByEmail(emailNormalized: string) {
    return getPrismaClient().user.findUnique({ where: { emailNormalized } });
  }
  findById(id: string) {
    return getPrismaClient().user.findUnique({ where: { id } });
  }
  async create(data: {
    phoneE164?: string;
    emailNormalized?: string;
    category: AccountCategory;
  }) {
    try {
      return await getPrismaClient().user.create({
        data: {
          phoneE164: data.phoneE164 ?? null,
          emailNormalized: data.emailNormalized ?? null,
          accountCategories: [data.category],
          verifiedCategories: [],
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return null;
      throw error;
    }
  }
  async enroll(userId: string, category: AccountCategory) {
    const user = await this.findById(userId);
    if (user === null) return null;
    return getPrismaClient().user.update({
      where: { id: userId },
      data: {
        accountCategories: [...new Set([...user.accountCategories, category])],
      },
    });
  }
  
  map = mapIdentity;
}
