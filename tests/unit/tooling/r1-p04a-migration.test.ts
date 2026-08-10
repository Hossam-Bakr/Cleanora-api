import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { assertCategoryAwareSignupMigrationSql } from '../../../scripts/validate-clean-migration.js';

describe('R1-P04A migration guard', () => {
  it('accepts the reviewed phase migration exactly', async () => {
    const sql = await readFile(
      resolve('prisma/migrations/r1_p04a_category_aware_customer_signup_verification/migration.sql'),
      'utf8',
    );
    expect(() => assertCategoryAwareSignupMigrationSql(sql)).not.toThrow();
  });

  it.each([
    'DROP TABLE "users";',
    'ALTER TABLE "users" ADD COLUMN "unexpected" TEXT;',
    'ALTER TABLE "users" ADD COLUMN "required" TEXT NOT NULL;',
  ])('rejects unrelated or unsafe SQL: %s', (sql) => {
    expect(() => assertCategoryAwareSignupMigrationSql(sql)).toThrow();
  });
});
