import { getPrismaClient } from "../../src/database/prisma.js";

export const R1_P05_PROVIDER_TABLES = [
  "providers",
  "provider_profiles",
  "provider_contacts",
  "provider_status_history",
  "provider_members",
  "provider_admin_invitations",
  "provider_gallery_items",
  "provider_email_outbox",
] as const;

export const R1_P05_MIGRATION_SUFFIX =
  "r1_p05_provider_onboarding_profile_lifecycle" as const;

/**
 * Fail closed when R1-P05 Provider tables are expected but absent.
 * Never silently skip acceptance coverage once a suite opts into live probes.
 */
export async function assertR1P05ProviderSchemaReady(): Promise<void> {
  const tables = await getPrismaClient().$queryRawUnsafe<
    Array<{ table_name: string }>
  >(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN (
         'providers',
         'provider_profiles',
         'provider_contacts',
         'provider_status_history',
         'provider_members',
         'provider_admin_invitations',
         'provider_gallery_items',
         'provider_email_outbox'
       )`,
  );
  const present = new Set(tables.map((row) => row.table_name));
  const missing = R1_P05_PROVIDER_TABLES.filter((name) => !present.has(name));
  if (missing.length > 0) {
    throw new Error(
      `R1-P05 provider schema missing tables: ${missing.join(", ")}. ` +
        `Apply migration ${R1_P05_MIGRATION_SUFFIX} before enabling live Provider probes.`,
    );
  }
}

/**
 * Returns true when all eight Provider tables exist; false when any are missing.
 * Use for graceful skip decisions — do not treat absence as a passing test.
 */
export async function hasR1P05ProviderSchema(): Promise<boolean> {
  try {
    await assertR1P05ProviderSchemaReady();
    return true;
  } catch {
    return false;
  }
}
