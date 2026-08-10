-- R1-P04A: post-signup company regulatory details.
-- Both columns are nullable: existing records remain valid and no regulatory
-- value is invented by migration.

ALTER TABLE "company_profiles"
ADD COLUMN "commercial_registration_number" VARCHAR(100),
ADD COLUMN "tax_registration_number" VARCHAR(100);
