import { getPrismaClient } from "#integrations/database/prisma-client-accessor";

import type { AppConfigRecord } from "../domain/configuration.types.js";

/**
 * Read global configuration registry records without leaking Prisma models.
 */
export class AppConfigRepository {
  async findByKey(key: string): Promise<AppConfigRecord | undefined> {
    const config = await getPrismaClient().appConfig.findUnique({
      where: { key }
    });

    return config === null
      ? undefined
      : {
          key: config.key,
          value: config.value,
          valueKind: config.valueKind,
          resolutionPolicy: config.resolutionPolicy
        };
  }
}
