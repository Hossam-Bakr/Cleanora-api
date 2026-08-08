import type { Prisma } from "#generated/prisma/client";

import type { PreferencesInput } from "../domain/customers.types.js";

type Transaction = Prisma.TransactionClient;

export type StoredPreferences = {
  readonly version: number;
  readonly language: "AR" | "EN" | null;
  readonly remindersSms: boolean;
  readonly remindersPush: boolean;
  readonly promotionalSms: boolean;
  readonly promotionalPush: boolean;
};

export class PrismaPreferencesRepository {
  public async get(transaction: Transaction, userId: string): Promise<StoredPreferences | undefined> {
    const preferences = await transaction.userPreferences.findUnique({ where: { userId } });
    return preferences === null ? undefined : preferences;
  }

  public async replace(
    transaction: Transaction,
    userId: string,
    input: PreferencesInput,
  ): Promise<StoredPreferences | undefined> {
    const existing = await transaction.userPreferences.findUnique({ where: { userId } });
    if (existing === null) {
      if (input.version !== 1) return undefined;
      return transaction.userPreferences.create({
        data: {
          userId,
          language: input.language,
          remindersSms: input.reminders.sms,
          remindersPush: input.reminders.push,
          promotionalSms: input.promotional.sms,
          promotionalPush: input.promotional.push,
        },
      });
    }
    const result = await transaction.userPreferences.updateMany({
      where: { userId, version: input.version },
      data: {
        language: input.language,
        remindersSms: input.reminders.sms,
        remindersPush: input.reminders.push,
        promotionalSms: input.promotional.sms,
        promotionalPush: input.promotional.push,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) return undefined;
    return transaction.userPreferences.findUniqueOrThrow({ where: { userId } });
  }
}
