import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

describe('R1-P02 migration boundary', () => {
  it('preserves R1-P01 and creates only approved authentication tables', async () => {
    const baseline = await readFile('prisma/migrations/r1_p01_foundation_country_configuration/migration.sql');
    expect(createHash('sha256').update(baseline).digest('hex').toUpperCase()).toBe('BF84EEE3768ED0246B187B7EF1A1690B4CED5B07B7B2F9085FDCC72108E04EC8');
    const sql = await readFile('prisma/migrations/r1_p02_complete_authentication/migration.sql', 'utf8');
    expect(createHash('sha256').update(sql).digest('hex').toUpperCase()).toBe('3BD939A8145DC512F4EB5C758A94E2A6467C26DEC4802FB836D7F14DD42DFC2B');
    for (const table of ['users', 'user_credentials', 'user_sessions', 'otp_codes', 'password_reset_tokens', 'social_accounts', 'auth_events']) expect(sql).toContain(table);
    expect((sql.match(/CREATE TABLE/g) ?? [])).toHaveLength(7);
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM)\b/i);
    expect(sql).toContain('otp_codes_one_open_challenge_idx');
    expect(sql).toContain('social_accounts_r1_google_individual_check');
  });
});

describe('R1-P02 phone constraint correction', () => {
  it('uses a forward migration and accepts normalized E.164 values', async () => {
    const sql = await readFile('prisma/migrations/r1_p02_fix_phone_e164_constraint/migration.sql', 'utf8');
    expect(sql).toContain(`CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\\+[1-9][0-9]{1,14}$')`);
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE|DROP COLUMN/u);
    const e164 = /^\+[1-9][0-9]{1,14}$/u;
    expect(e164.test('+201234567890')).toBe(true);
    for (const malformed of ['201234567890', '+00123', '+20abc', '+']) expect(e164.test(malformed)).toBe(false);
  });
});

describe('R1-P02 Google presentation claims', () => {
  it('adds only nullable provider-owned name and avatar columns', async () => {
    const sql = await readFile(
      'prisma/migrations/r1_p02_google_provider_profile_claims/migration.sql',
      'utf8',
    );
    expect(sql).toContain('ALTER TABLE "social_accounts"');
    expect(sql).toContain('"provider_display_name" VARCHAR(200)');
    expect(sql).toContain('"provider_avatar_url" VARCHAR(2048)');
    expect(sql).not.toMatch(/NOT NULL|DROP TABLE|TRUNCATE|DELETE FROM/iu);
  });
});

describe('R1-P02 email verification for Individuals', () => {
  it('forward-fixes the verification invariant without rewriting history', async () => {
    const sql = await readFile(
      'prisma/migrations/r1_p02_email_verification_for_individuals/migration.sql',
      'utf8',
    );
    expect(sql).toContain('DROP CONSTRAINT "users_verified_individual_check"');
    expect(sql).toContain(
      'ADD CONSTRAINT "users_verified_individual_contact_check"',
    );
    expect(sql).toContain('"email_verified_at" IS NOT NULL');
    expect(sql).toContain('"phone_verified_at" IS NOT NULL');
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE|DELETE FROM/iu);
  });
});
