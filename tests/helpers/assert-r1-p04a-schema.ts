import { getPrismaClient } from '../../src/database/prisma.js';

/** Fail closed when the category-aware signup migration is absent. */
export async function assertR1P04ACustomerSignupSchemaReady(): Promise<void> {
  const columns = await getPrismaClient().$queryRawUnsafe<
    Array<{ readonly table_name: string; readonly column_name: string }>
  >(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'company_profiles'
       AND column_name IN (
           'commercial_registration_number',
           'tax_registration_number'
         )`,
  );
  const present = new Set(
    columns.map((row) => `${row.table_name}.${row.column_name}`),
  );
  const required = [
    'company_profiles.commercial_registration_number',
    'company_profiles.tax_registration_number',
  ] as const;
  const missing = required.filter((value) => !present.has(value));
  if (missing.length > 0) {
    throw new Error(
      `R1-P04A schema missing columns: ${missing.join(', ')}. ` +
        'Apply migration r1_p04a_category_aware_customer_signup_verification.',
    );
  }
}
