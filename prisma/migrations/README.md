# Cleanora Migrations

R1-P00 creates no migration because it introduces no product tables.

Every later database-changing phase creates a named migration:

```text
r1_pxx_short_description
```

Generated SQL must be reviewed. Applied migrations are immutable; corrections use forward migrations. The introducing phase owns constraints, indexes, defaults, backfills, compatibility checks, and documentation.

R1-P02 owns three chronological authentication migrations:

1. `r1_p02_complete_authentication` introduces the approved authentication schema.
2. `r1_p02_fix_phone_e164_constraint` corrects only the E.164 check escaping through a forward migration.
3. `r1_p02_google_provider_profile_claims` adds nullable, safe Google display-name and avatar URL claims to the authentication-owned social link.

The earlier migrations remain unchanged.

Forward-fix note: the original check encoded an extra backslash and rejected valid normalized phone values. The correction replaces only `users_phone_e164_check`; it does not alter tables, columns, or stored data. Its explanation lives here rather than inside the exact-validated SQL file.

The Google presentation-claims migration is additive and requires no backfill.
Existing password users and linked Google records remain valid with null values.
