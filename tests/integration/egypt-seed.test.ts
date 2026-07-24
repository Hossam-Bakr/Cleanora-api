
import { getPrismaClient } from "../../src/integrations/database/prisma-client-accessor.js";
import type { PrismaLifecycle } from "../../src/integrations/database/prisma-lifecycle.js";
import { seed } from "../../prisma/seed.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle
} from "../helpers/test-database-lifecycle.js";

const hasDatabase = process.env["DATABASE_URL"] !== undefined;

describe.skipIf(!hasDatabase)("Egypt seed", () => {
  let database: PrismaLifecycle;

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
  });

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it(
    "is idempotent for authoritative country, currency, and configuration data",
    async () => {
      await seed();
      await seed();

      const prisma = getPrismaClient();
      const country = await prisma.country.findUniqueOrThrow({
        where: { code: "EG" }
      });
      const [currencyCount, countryCount, appConfigCount, countryConfigCount] =
        await Promise.all([
          prisma.currency.count({ where: { code: "EGP" } }),
          prisma.country.count({ where: { code: "EG" } }),
          prisma.appConfig.count({
            where: {
              key: {
                in: [
                  "platform.default_timezone",
                  "country.display_name",
                  "country.supported_locales",
                  "country.currency_code"
                ]
              }
            }
          }),
          prisma.countryConfig.count({ where: { countryId: country.id } })
        ]);

      expect(currencyCount).toBe(1);
      expect(countryCount).toBe(1);
      expect(appConfigCount).toBe(4);
      expect(countryConfigCount).toBe(3);
    },
    30_000
  );
});
