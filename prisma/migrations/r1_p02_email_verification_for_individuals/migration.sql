-- DEC-028 moves new R1-P02 Individual verification to the account email.
-- Preserve already-verified historical phone identities while allowing every
-- new Individual verification path to satisfy the invariant through email.
ALTER TABLE "users"
DROP CONSTRAINT "users_verified_individual_check";

ALTER TABLE "users"
ADD CONSTRAINT "users_verified_individual_contact_check"
CHECK (
  NOT ('INDIVIDUAL' = ANY("verified_categories"))
  OR (
    "email_normalized" IS NOT NULL
    AND "email_verified_at" IS NOT NULL
  )
  OR (
    "phone_e164" IS NOT NULL
    AND "phone_verified_at" IS NOT NULL
  )
);
