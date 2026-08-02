# R1-P02 Authentication Data Model

**Migration owner**: R1-P02  
**Migration history**: `r1_p02_complete_authentication`, followed by the
immutable forward fixes `r1_p02_fix_phone_e164_constraint`,
`r1_p02_google_provider_profile_claims`, and
`r1_p02_email_verification_for_individuals`
**Baseline**: additive after
`r1_p01_foundation_country_configuration`; the applied R1-P01 SQL is immutable

## Model Boundary

R1-P02 adds exactly these tables:

1. `users`
2. `user_credentials`
3. `user_sessions`
4. `otp_codes`
5. `password_reset_tokens`
6. `social_accounts`
7. `auth_events`

It does not add roles, permissions, profiles, worker-management records,
addresses, wallets, or future-phase compatibility tables. Existing R1-P01
models and relations remain unchanged.

## Enums

| Enum | Values |
|---|---|
| `AccountCategory` | `INDIVIDUAL`, `COMPANY`, `ENGINEER`, `PROVIDER_OWNER`, `WORKER` |
| `UserStatus` | `ACTIVE`, `SUSPENDED`, `BANNED` |
| `AuthenticationMethod` | `PASSWORD`, `GOOGLE` |
| `SessionCapability` | `FULL`, `VERIFICATION_ONLY` |
| `AuthDeliveryChannel` | `SMS`, `EMAIL` |
| `OtpPurpose` | `CATEGORY_VERIFICATION`, `OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION` |
| `AuthChallengeStatus` | `PENDING_DELIVERY`, `ACTIVE`, `CONSUMED`, `SUPERSEDED`, `EXHAUSTED`, `DELIVERY_FAILED` |
| `PasswordResetPurpose` | `PASSWORD_RESET` |
| `SessionRevocationReason` | `LOGOUT`, `LOGOUT_ALL`, `PASSWORD_CHANGE`, `PASSWORD_RESET`, `REFRESH_REUSE`, `ACCOUNT_SUSPENDED`, `ACCOUNT_BANNED`, `SECURITY_FAILURE` |
| `SocialProvider` | `GOOGLE` |
| `AuthEventOutcome` | `SUCCEEDED`, `FAILED`, `DENIED` |

`AuthDeliveryChannel.SMS` and
`OtpPurpose.OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION` remain in the centralized
schema only because they are part of an already-applied migration. DEC-028
forbids new R1-P02 runtime use of those historical values; removing them would
require a separately reviewed compatibility migration and is unnecessary for
the email-only behavior.

`auth_events.event_type` remains a module-validated string so adding a safe
event name does not require a database enum migration.

## `users`

| Field | Prisma/database direction | Rule |
|---|---|---|
| `id` | `String @id @default(cuid())` | Opaque identity ID |
| `phoneE164` | nullable, unique, `VARCHAR(16)`, map `phone_e164` | Contact/login identifier when present; R1-P02 never infers phone ownership |
| `emailNormalized` | nullable at storage level, unique, `VARCHAR(320)`, map `email_normalized` | Lowercase normalized email; application-required for every new R1-P02 self-signup and Google identity |
| `accountCategories` | `AccountCategory[] @default([])` | Enrolled categories |
| `verifiedCategories` | `AccountCategory[] @default([])` | Category gates completed |
| `status` | `UserStatus @default(ACTIVE)` | Identity-wide availability |
| `suspendedUntil` | nullable timestamp | Required while status is `SUSPENDED` |
| `statusChangedAt` | timestamp default now | Status evidence |
| `phoneVerifiedAt` | nullable timestamp | Phone assurance evidence |
| `emailVerifiedAt` | nullable timestamp | Email assurance evidence |
| `createdAt`, `updatedAt` | normal mapped timestamps | Lifecycle |

Relations are module-private to credential, sessions, OTPs, resets, social
accounts, and auth events. Pending categories are derived as enrolled minus
verified.

### Database checks

- `cardinality(account_categories) > 0`.
- `verified_categories <@ account_categories`.
- E.164 format is `^\+[1-9][0-9]{1,14}$` when present.
- Normalized email equals its lowercased trimmed representation.
- The forward constraint
  `users_verified_individual_contact_check` requires a verified Individual to
  have email plus `email_verified_at`, while preserving already-verified
  historical phone identities for migration compatibility.
- Verified `COMPANY`, `ENGINEER`, or `PROVIDER_OWNER` requires email and
  `email_verified_at`.
- `SUSPENDED` requires `suspended_until`; application validation additionally
  requires it to be in the future when a status mutation is later authorized.

The unique nullable phone/email indexes are the final concurrency guard against
duplicate identities. Prisma `P2002` maps to generic public semantics.

## `user_credentials`

| Field | Direction | Rule |
|---|---|---|
| `id` | cuid primary key | Internal record |
| `userId` | unique FK to `users`, `onDelete: Restrict` | At most one password credential |
| `passwordHash` | `VARCHAR(255)` | Argon2id PHC string only |
| `passwordHashVersion` | integer default 1 | Hash-policy migration |
| `credentialVersion` | integer default 1 | Invalidates old JWT/session credentials |
| `failedLoginAttempts` | integer default 0 | Consecutive failure state |
| `failureWindowStartedAt` | nullable timestamp | Lockout window |
| `lockedUntil` | nullable timestamp | Temporary lock |
| `lastFailedAt` | nullable timestamp | Safe evidence |
| `lastAuthenticatedAt` | nullable timestamp | Safe evidence |
| `passwordChangedAt` | timestamp default now | Credential lifecycle |
| `createdAt`, `updatedAt` | timestamps | Lifecycle |

Counters must be non-negative. A Google-only identity may have no credential
row. R1-P02 exposes no worker-creation API; controlled database fixtures may
create a worker identity and credential for login tests.

## `user_sessions`

One row is one stable refresh-token family.

| Field | Direction | Rule |
|---|---|---|
| `id` | cuid primary key | Stable `sid` for the family |
| `userId` | FK to `users`, `onDelete: Restrict` | Owner |
| `currentRefreshVerifier` | unique `CHAR(64)` | HMAC of current raw refresh JWT |
| `verifierKeyVersion` | positive integer | Key selection |
| `rotationCounter` | integer default 0 | Monotonic family generation |
| `credentialVersion` | positive integer | Credential version at issuance |
| `authenticationMethod` | enum | Password or Google origin |
| `capability` | enum | Full or verification-only |
| `expiresAt` | timestamp | Fixed absolute family expiry |
| `lastUsedAt` | nullable timestamp | Safe usage evidence |
| `revokedAt` | nullable timestamp | Revocation state |
| `revocationReason` | nullable enum | Required when revoked |
| `compromisedAt` | nullable timestamp | Refresh reuse evidence |
| `ipHash`, `userAgentHash` | nullable `CHAR(64)` | Keyed privacy-preserving context |
| `createdAt`, `updatedAt` | timestamps | Lifecycle |

Indexes:

- unique `current_refresh_verifier`;
- `(user_id, revoked_at)`;
- `(user_id, expires_at)`;
- `expires_at`;
- `revoked_at`.

Checks:

- rotation and version values are non-negative/positive as applicable;
- expiry is after creation;
- revocation time and reason are both null or both present;
- compromise implies revoked reason `REFRESH_REUSE`.

Rotation conditionally replaces the verifier and increments
`rotation_counter`; it never changes `expires_at`.

## `otp_codes`

| Field | Direction |
|---|---|
| `id` | cuid public opaque challenge selector |
| `userId` | FK to `users`, `onDelete: Restrict` |
| `accountCategory` | category whose state may change |
| `purpose` | OTP purpose enum |
| `channel` | Email for all new R1-P02 challenges; SMS is historical enum compatibility only |
| `destinationHash` | `CHAR(64)` domain-separated HMAC |
| `codeVerifier` | `CHAR(64)` HMAC; never raw OTP |
| `verifierKeyVersion` | positive integer |
| `status` | challenge state |
| `attemptCount`, `maxAttempts` | bounded integers |
| `resendAvailableAt`, `expiresAt` | deterministic time policy |
| `deliveredAt`, `deliveryFailedAt`, `lastAttemptAt`, `consumedAt`, `supersededAt` | nullable state evidence |
| `createdAt` | immutable creation time |

Indexes:

- `expires_at`;
- `(user_id, purpose, account_category, status)`;
- `(status, expires_at)`;
- reviewed partial unique index on
  `(user_id, purpose, account_category)` while status is
  `PENDING_DELIVERY` or `ACTIVE`.

Checks enforce positive attempts, `0 <= attempt_count <= max_attempts`, expiry
after creation, and coherent status/timestamp combinations. Every verification
query also includes status and expiry; an index does not replace the predicate.

## `password_reset_tokens`

| Field | Direction |
|---|---|
| `id` | cuid public selector |
| `userId` | FK to `users`, `onDelete: Restrict` |
| `purpose` | `PASSWORD_RESET` |
| `channel` | authoritative email channel for all new R1-P02 recovery rows; historical enum compatibility permits earlier values |
| `destinationHash` | `CHAR(64)` HMAC |
| `tokenVerifier` | unique `CHAR(64)` HMAC |
| `verifierKeyVersion` | positive integer |
| `status` | shared challenge state |
| `attemptCount`, `maxAttempts` | bounded integers |
| `resendAvailableAt`, `expiresAt` | deterministic time policy |
| delivery/attempt/consume/supersede timestamps | state evidence |
| `createdAt` | immutable creation time |

Indexes:

- unique `token_verifier`;
- `expires_at`;
- `(user_id, status)`;
- `(status, expires_at)`;
- reviewed partial unique index on `(user_id, purpose)` for
  `PENDING_DELIVERY` or `ACTIVE`.

The API returns `id` as an opaque `challengeId` for every valid forgot-password
request, including absent identities. Eligible identities receive a separate
four-digit code out of band. The selector loads the row and the code is
HMAC-verified with the selector; the raw code is never stored. This changes no
column or index.

## `social_accounts`

| Field | Direction |
|---|---|
| `id` | cuid primary key |
| `userId` | FK to `users`, `onDelete: Restrict` |
| `provider` | provider enum |
| `accountCategory` | audience category |
| `providerSubject` | `VARCHAR(255)` |
| `providerEmailNormalized` | nullable `VARCHAR(320)` |
| `providerEmailVerifiedAt` | nullable timestamp |
| `linkedAt`, `lastAuthenticatedAt`, `createdAt`, `updatedAt` | lifecycle evidence |

Constraints:

- unique `(provider, provider_subject)`;
- unique `(user_id, provider, account_category)`;
- index `user_id`;
- Release 1 SQL check requires
  `provider = GOOGLE AND account_category = INDIVIDUAL`.

No provider access token, refresh token, ID token, raw claims, or payload is
persisted. Enabling another audience requires an explicit later forward
migration and product decision.

## `auth_events`

| Field | Direction |
|---|---|
| `id` | cuid primary key |
| `userId` | nullable FK to `users`, `onDelete: SetNull` |
| `sessionId` | nullable logical safe ID, no FK |
| `eventType` | validated `VARCHAR(64)` |
| `outcome` | outcome enum |
| `reasonCode` | nullable safe `VARCHAR(64)` |
| `requestId` | nullable request correlation |
| `identifierHash`, `ipHash`, `userAgentHash` | nullable keyed `CHAR(64)` |
| `context` | nullable allowlisted JSON |
| `createdAt` | immutable timestamp |

Indexes:

- `created_at`;
- `(user_id, created_at)`;
- `(event_type, created_at)`;
- `request_id`;
- `session_id`.

The repository exposes append only. There is no update/delete API. Context
cannot contain identifiers, destinations, provider payloads, token hashes, raw
errors, cookies, or secrets.

## Transaction and Lock Order

The authentication application service owns all transactions. Repositories
accept a module-private transaction context; Prisma types never cross the
module's public `index.ts`.

Lock order:

1. user;
2. credential, when involved;
3. scoped OTP/reset/session rows;
4. social account, when involved;
5. append auth event.

Required atomic workflows:

- signup/category enrollment state and challenge creation;
- challenge attempt/consumption and category verification;
- refresh compare-and-swap or family reuse revocation;
- password reset, credential replacement, all-session revocation, event;
- password change, other-session revocation, current-family rotation, event;
- logout/logout-all and event;
- social link/unlink and event.

Provider calls never occur inside a database transaction.

## Migration SQL Review

The initial migration was created during implementation with:

```text
prisma migrate dev --create-only --name r1_p02_complete_authentication
```

Use only an explicit isolated non-production development database for
generation. Before applying:

- confirm the migration contains only expected `CREATE TYPE`, `CREATE TABLE`,
  `CREATE INDEX`, `ALTER TABLE ... ADD CONSTRAINT`, and foreign-key statements;
- add/review the checks and two partial unique indexes Prisma cannot express;
- reject `DROP`, `TRUNCATE`, `DELETE`, cascade deletion, mutation of the five
  R1-P01 tables, raw-secret columns, and unapproved tables;
- verify the R1-P01 migration checksum remains unchanged;
- run `prisma validate` and regenerate the client only after SQL review.

Apply the full history only to an explicit empty, non-production
`CI_DATABASE_URL`. Runtime test-database updates use the matching direct
non-pooler migration URL and never the ordinary development/production URL.
The database proof must show:

- exactly the five R1-P01 product tables plus seven R1-P02 product tables and
  Prisma migration metadata;
- exactly one successful history row for each phase migration and forward fix;
- preserved R1-P01 seed behavior and idempotent R1-P02 policy seed additions;
- real PostgreSQL uniqueness, partial-index, check, expiry, and concurrency
  behavior.

After the migration has been applied anywhere shared, it is immutable. Any
defect uses a separately named forward migration with compatibility impact,
backfill if required, and clean/full-history tests.
