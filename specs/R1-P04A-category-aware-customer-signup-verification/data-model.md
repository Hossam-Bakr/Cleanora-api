# Data Model: R1-P04A

## Existing Authentication entities

`users`, credentials, sessions, and OTP challenges retain their existing
email-only behavior. Password-based category verification sets
`email_verified_at`; `phone_verified_at` remains null. R1-P04A adds no user
deadline and no OTP purpose/channel enum value.

## Customer profile invariant

- Individual signup/enrollment creates `individual_profiles.full_name`.
- Company signup/enrollment creates `company_profiles.company_name` and
  `representative_full_name`.
- Engineer signup/enrollment creates `engineer_profiles.full_name` and
  `professional_title`.
- Provider Owner creates no customer profile.

The matching profile is created in the same transaction as identity/category
enrollment. Failed initial delivery removes the unverified identity and matching
profile through the Customers writer.

## R1-P04A migration

Only `company_profiles` changes:

| Column | Type | Null | Purpose |
|---|---|---:|---|
| `commercial_registration_number` | `VARCHAR(100)` | yes | Private post-signup commercial identifier |
| `tax_registration_number` | `VARCHAR(100)` | yes | Private post-signup tax identifier |

No backfill, default, uniqueness constraint, or external-verification claim is
introduced.
