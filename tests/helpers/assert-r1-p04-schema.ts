import { getPrismaClient } from "../../src/database/prisma.js";

/**
 * Fail closed when TEST_DATABASE_HAS_R1_P04 is enabled but migrations are absent.
 * Never silently skip acceptance coverage in that state.
 */
export async function assertR1P04CustomerSchemaReady(): Promise<void> {
  const tables = await getPrismaClient().$queryRawUnsafe<
    Array<{ table_name: string }>
  >(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN (
         'customer_profiles',
         'media_files',
         'user_addresses',
         'user_preferences',
         'privacy_requests',
         'individual_profiles',
         'company_profiles',
         'engineer_profiles'
       )`,
  );
  const present = new Set(tables.map((row) => row.table_name));
  const required = [
    "customer_profiles",
    "media_files",
    "user_addresses",
    "user_preferences",
    "privacy_requests",
    "individual_profiles",
    "company_profiles",
    "engineer_profiles",
  ] as const;
  const missing = required.filter((name) => !present.has(name));
  if (missing.length > 0) {
    throw new Error(
      `R1-P04 customer schema missing tables: ${missing.join(", ")}. ` +
        "Apply migrations r1_p04_customer_profiles_preferences_text_addresses " +
        "and r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage before enabling " +
        "TEST_DATABASE_HAS_R1_P04=true.",
    );
  }

  const columns = await getPrismaClient().$queryRawUnsafe<
    Array<{ column_name: string }>
  >(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'media_files'
       AND column_name IN ('storage_provider', 'width', 'height', 'cleanup_eligible_at')`,
  );
  if (columns.length < 4) {
    throw new Error(
      "R1-P04 Cloudinary media columns missing on media_files " +
        "(expected storage_provider, width, height, cleanup_eligible_at). " +
        "Apply migration r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage.",
    );
  }
}
