
import {
  assertCountryCurrencySupported,
  getCountryByCode,
  resolveEffectiveConfig
} from "#modules/configuration/configuration.service";
import type { PrismaLifecycle } from "../../src/database/prisma-lifecycle.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle
} from "../helpers/test-database-lifecycle.js";
import { hasApprovedTestDatabaseUrl } from "../helpers/resolve-test-database-url.js";

const hasDatabase = hasApprovedTestDatabaseUrl();
const databaseTestTimeoutMs = 15_000;

describe.skipIf(!hasDatabase)("configuration public API", () => {
  let database: PrismaLifecycle;

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
  });

  afterAll(async () => {
    await stopTestDatabaseLifecycle(database);
  });

  it("reads seeded country configuration only through the public contract", async () => {
    const country = await getCountryByCode("EG");
    const displayName = await resolveEffectiveConfig<{
      readonly en: string;
      readonly ar: string;
    }>("country.display_name", "EG");
    const locales = await resolveEffectiveConfig<readonly string[]>(
      "country.supported_locales",
      "EG"
    );

    await expect(assertCountryCurrencySupported("EG")).resolves.toBeUndefined();
    expect(country.code).toBe("EG");
    expect(displayName).toMatchObject({
      source: "country",
      value: { en: "Egypt", ar: "مصر" }
    });
    expect(locales).toMatchObject({
      source: "country",
      value: ["ar-EG", "en-EG"]
    });
  }, databaseTestTimeoutMs);
});
