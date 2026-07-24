# Data Model — R1-P01 Project Foundation & Country Configuration

**Date**: 2026-07-24  
**Phase**: R1-P01  
**Migration name**: `r1_p01_foundation_country_configuration`  
**Schema file**: `prisma/schema.prisma` (extend; do not create a second schema)  
**Standalone boundary**: Cleanora repository migration history only

> Field designs below are the planning contract for implementation. They follow `docs/architecture/database-conventions.md`. Raw Prisma types must not cross module public APIs.

## Scope

| Table | Owner module | Lifecycle |
|---|---|---|
| `countries` | `configuration` | Authoritative reference |
| `currencies` | `configuration` | Authoritative reference |
| `app_configs` | `configuration` | Global key registry + global values + resolution policy |
| `country_configs` | `configuration` | Country-scoped values |
| `audit_logs` | `admin` | Append-only audit foundation |

**Out of scope tables**: all R1-P02+ identity, marketplace, payment, geo tables.

---

## Enums (phase-owned)

### `ConfigValueKind`

`STRING` | `NUMBER` | `BOOLEAN` | `OBJECT` | `ARRAY`

### `ConfigResolutionPolicy`

| Value | Meaning |
|---|---|
| `GLOBAL_ONLY` | Effective value from `app_configs` only; every `country_configs` write rejected; corrupt leftover country rows fail resolve with `CONFIG_COUNTRY_OVERRIDE_REJECTED` (never silent ignore; never return country value) |
| `COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK` | Country value overrides global; else global; else fail |
| `COUNTRY_REQUIRED` | Country value required; missing fails closed; global must not silently replace |

### `AuditActorType`

`USER` | `SYSTEM` | `UNKNOWN`

---

## Entity: Currency (`currencies`)

| Field | Type | Notes |
|---|---|---|
| `id` | opaque string PK (`cuid` or `uuid`) | Surrogate key |
| `code` | string(3) | ISO 4217; unique; e.g. `EGP` |
| `name_en` | string | English display name |
| `name_ar` | string | Arabic display name |
| `decimal_places` | int | Non-negative; EGP → `2` |
| `is_active` | boolean | Default `true` |
| `created_at` | datetime | Required |
| `updated_at` | datetime | Mutable authoritative |

**Uniques / indexes**:
- `UNIQUE (code)`
- Index on `(is_active)` optional

**Validation invariants**:
- `code` uppercase ISO 4217 pattern
- Inactive currency cannot be newly assigned as a country’s default currency

**Deletion**: Soft via `is_active = false`; never hard-delete if referenced

---

## Entity: Country (`countries`)

| Field | Type | Notes |
|---|---|---|
| `id` | opaque string PK | Surrogate key |
| `code` | string(2) | ISO 3166-1 alpha-2; unique; e.g. `EG` |
| `name_en` | string | English display name |
| `name_ar` | string | Arabic display name |
| `default_currency_id` | FK → `currencies.id` | Required |
| `default_locale` | string | BCP 47-ish tag; Egypt seed uses `ar-EG` as default locale capability marker |
| `supported_locales` | Json (string array) | e.g. `["ar-EG","en-EG"]` — locale foundation without extra table |
| `is_active` | boolean | Default `true` |
| `created_at` | datetime | Required |
| `updated_at` | datetime | Mutable authoritative |

**Uniques / indexes**:
- `UNIQUE (code)`
- Index on `(is_active)`
- FK index on `default_currency_id`

**Validation invariants**:
- `code` uppercase alpha-2
- `default_currency_id` must reference an **active** currency at write time
- Unknown / inactive / unsupported country codes fail at configuration resolve
- Egypt enabled via seed (`EG` + active), not hard-coded business branches

**Deletion**: Soft via `is_active = false`; restrict hard delete

**Relations**:
- Country → Currency (many-to-one, required default currency)
- Country → CountryConfig (one-to-many)

---

## Entity: AppConfig (`app_configs`) — global key registry

Canonical registry for every known configuration key, its value kind, resolution policy, and optional global value.

| Field | Type | Notes |
|---|---|---|
| `id` | opaque string PK | Surrogate key |
| `key` | string | Stable dotted key; unique globally |
| `value` | Json? | Global value; **nullable** when policy is `COUNTRY_REQUIRED` (declaration only) |
| `value_kind` | `ConfigValueKind` | Declared kind for validation |
| `resolution_policy` | `ConfigResolutionPolicy` | Per-key policy (clarification Option C) |
| `description` | string? | Operator-facing non-sensitive description |
| `created_at` | datetime | Required |
| `updated_at` | datetime | Mutable |

**Uniques / indexes**:
- `UNIQUE (key)` — configuration-key uniqueness for global scope

**Validation invariants**:
- `key` matches `^[a-z][a-z0-9_.]*$` (or documented equivalent)
- Unknown keys are not resolvable (must exist in registry)
- `value` must satisfy code-owned Zod schema for `key` when non-null
- `value_kind` must match runtime type of `value` when non-null
- For `GLOBAL_ONLY`, `value` MUST be present (non-null) to resolve successfully
- For `COUNTRY_REQUIRED`, `value` MUST NOT be used as silent fallback even if present
- Secrets/credentials forbidden (module rejects denylisted keys/patterns and secret-like payloads)

**Deletion**: Prefer deactivate-by-convention only if later needed; R1-P01 may restrict deletes. No secret store.

---

## Entity: CountryConfig (`country_configs`)

| Field | Type | Notes |
|---|---|---|
| `id` | opaque string PK | Surrogate key |
| `country_id` | FK → `countries.id` | Required |
| `key` | string | Same key namespace as `app_configs.key` |
| `value` | Json | Required country value |
| `value_kind` | `ConfigValueKind` | Must align with registry kind |
| `created_at` | datetime | Required |
| `updated_at` | datetime | Mutable |

**Uniques / indexes**:
- `UNIQUE (country_id, key)` — configuration-key uniqueness by country scope
- Index on `(key)` for cross-country admin queries later

**Validation invariants** (writes):
- `key` MUST exist in `app_configs`
- Registry policy must allow country values (`COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK` or `COUNTRY_REQUIRED`)
- **Reject every `country_configs` write** for a key whose `resolution_policy` is `GLOBAL_ONLY`
- `value` / `value_kind` must match registry Zod schema
- Country must be active for resolve paths that require supported countries
- No ambiguous duplicate rows (enforced by unique)

**Deletion**: Soft-delete not required in P01; updates overwrite value. Restrict hard delete if audit depends on historical config reads (P01 resolves live values only).

**Relations**:
- CountryConfig → Country (many-to-one)
- Logical association to AppConfig by `key` (no FK required; validated in application to avoid cross-table coupling rigidity). Optional FK on `key` is **not** used because Postgres FK to non-PK `app_configs.key` would require additional unique already present — application-level validation is sufficient and clearer for policy checks.

---

## Effective configuration (derived, not persisted)

Inputs: `key`, optional `countryCode`.

Algorithm:

1. Load `app_configs` by `key`. If missing → **fail** `CONFIG_KEY_UNKNOWN`.
2. If `countryCode` provided: load country by code; if missing/inactive/unsupported → **fail** `COUNTRY_UNAVAILABLE`.
3. Switch on `resolution_policy`:
   - `GLOBAL_ONLY`:
     - Return **only** the global `app_configs` value with `source: "global"`.
     - If the global value is missing/null → **fail** `CONFIG_VALUE_MISSING`.
     - If an invalid/corrupt country override row somehow exists for this key → **fail** `CONFIG_COUNTRY_OVERRIDE_REJECTED`.
     - Never ignore an invalid country override silently.
     - Never return the country value.
   - `COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK`: if country row exists → return it (`source: "country"`); else if global non-null → return global (`source: "global"`); else fail `CONFIG_VALUE_MISSING`.
   - `COUNTRY_REQUIRED`: require `countryCode`; load country row; if missing → fail `CONFIG_COUNTRY_VALUE_REQUIRED` (do **not** return global); else return country value (`source: "country"`).
4. Validate runtime value against key Zod schema; on mismatch fail `CONFIG_VALUE_INVALID`.
5. Return contract DTO including `resolutionPolicy` and `source`.

---

## Entity: AuditLog (`audit_logs`) foundation

| Field | Type | Notes |
|---|---|---|
| `id` | opaque string PK | Surrogate key |
| `actor_type` | `AuditActorType` | `USER` / `SYSTEM` / `UNKNOWN` |
| `actor_id` | string? | When available |
| `action` | string | Stable action name (foundation vocabulary only in P01) |
| `target_type` | string | e.g. `country`, `app_config`, `system` |
| `target_id` | string? | When applicable |
| `reason` | string? | Optional human reason |
| `context` | Json? | Safe metadata only; no secrets |
| `request_id` | string? | Correlation id when available |
| `created_at` | datetime | Required; immutable |

**Uniques / indexes**:
- Index `(created_at)`
- Index `(actor_type, actor_id)`
- Index `(target_type, target_id)`
- Index `(action)`

**Validation invariants**:
- No `updated_at`
- No update/delete APIs in public contract
- `writeAudit` persistence failure → fail closed to caller
- Do not invent R1-P03 privileged before/after payloads beyond nullable `context` reserved for later extension

**Deletion**: Never hard-delete audit rows (constitution / conventions)

---

## Egypt seed (idempotent)

Natural keys (upsert targets):

| Record | Natural key | Seed intent |
|---|---|---|
| Currency | `code = EGP` | Active; decimal_places `2`; names EN/AR |
| Country | `code = EG` | Active; default currency EGP; `default_locale = ar-EG`; `supported_locales = ["ar-EG","en-EG"]` |
| App configs | keys listed below | Registry + policies + values |
| Country configs | `(EG, key)` | Country-required / override samples |

### Minimum seeded configuration keys (illustrative; finalize in tasks)

| Key | Policy | Global value | EG country value | Purpose |
|---|---|---|---|---|
| `platform.default_timezone` | `GLOBAL_ONLY` | e.g. `Africa/Cairo` | — (rejected if present) | Global platform default |
| `country.display_name` | `COUNTRY_REQUIRED` | null | Egypt EN/AR structure or string | Prove country-required |
| `country.supported_locales` | `COUNTRY_OVERRIDE_WITH_GLOBAL_FALLBACK` | `["en"]` | `["ar-EG","en-EG"]` | Prove override+fallback |
| `country.currency_code` | `COUNTRY_REQUIRED` | null | `EGP` | Country money scope foundation |

No fee matrices, auth secrets, or wallet settings.

**Idempotency**: upsert by natural keys; run twice → identical row counts for these natural keys.

---

## Migration plan

1. Inspect empty product schema + no prior migrations.
2. Add only the five models + enums above.
3. Create migration `r1_p01_foundation_country_configuration`.
4. Review generated SQL:
   - Accept: `CREATE TYPE`, `CREATE TABLE`, `CREATE UNIQUE INDEX`, `CREATE INDEX`, FKs with `ON DELETE RESTRICT` (or equivalent non-cascade for authoritative parents).
   - Reject unexplained: `DROP TABLE`, `TRUNCATE`, mass `DELETE`, cascade deletes on audit/financial-like tables, destructive rewrites.
5. `prisma generate`.
6. Clean empty DB: `migrate deploy` → seed → seed again → assert no duplicates.
7. Never edit applied migration; corrections via forward migration only.

---

## Public mapping (no Prisma leak)

| Prisma model | Public contract type (names illustrative) |
|---|---|
| `Country` | `CountryRecord` |
| `Currency` | `CurrencyRecord` |
| derived resolve | `EffectiveConfig` |
| `AuditLog` | `AuditRecord` / `WriteAuditInput` |

Repositories remain inside owning modules’ `infrastructure/` folders.
