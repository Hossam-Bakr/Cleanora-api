# R1-P07 Data Model

**Status:** Design only; no Prisma or database change has been executed
**Future migration:** `r1_p07_worker_team_crew_management`

## Ownership

All models below are Providers-owned unless explicitly noted as an existing
opposite relation. Authentication continues to own `User`, `UserRole`,
credentials, sessions, and `UserPreferences`; Media owns `MediaFile`; Admin owns
`AuditLog`. Providers accesses those owners only through public contracts at
runtime.

## Planned enums

| Enum | Values |
|---|---|
| `WorkerOperationalStatus` | `DRAFT`, `ACTIVE`, `INACTIVE`, `REMOVED` |
| `WorkerGender` | `MALE`, `FEMALE` (HTTP maps approved `male`/`female`) |
| `WorkerType` | `CLEANING_STAFF`, `ESCORT`, `OTHER` |
| `WorkerLoginAccessStatus` | `INVITED`, `ACTIVE`, `EXPIRED`, `REVOKED` |
| `WorkerInvitationStatus` | `PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`, `SUPERSEDED` |
| `ProviderTeamStatus` | `DRAFT`, `ACTIVE`, `INACTIVE`, `ARCHIVED` |
| `ProviderWorkforceTargetType` | `WORKER`, `WORKER_PROFILE`, `LOGIN_ACCESS`, `INVITATION`, `ADMIN_MEMBERSHIP`, `TEAM`, `TEAM_MEMBERSHIP`, `PRIMARY_SUPERVISOR`, `READINESS` |
| `ProviderWorkforceNotificationTemplate` | invitation, access, lifecycle, Admin membership, leave/removal templates defined in contracts |
| `ProviderWorkforceNotificationStatus` | `PENDING`, `SENDING`, `SENT`, `FAILED` |
| `ProviderWorkforceCommandStatus` | `IN_PROGRESS`, `ACCEPTED` |

Reason codes remain command-specific TypeScript/Zod unions and safe text
columns in history/audit. They are not one global Prisma enum because a global
enum would falsely imply that every code is valid for every action.

## Planned models

### `ProviderWorker` → `provider_workers`

The Provider-to-person engagement and operational lifecycle.

| Field | Shape | Rule |
|---|---|---|
| `id` | cuid/string PK | Stable Worker/engagement identifier |
| `providerId` | FK Provider | Exact owner; restrict delete |
| `identityUserId` | nullable FK User | Null before accepted identity link; restrict delete |
| `predecessorWorkerId` | nullable self FK, unique | Links a rehire to one terminal predecessor |
| `status` | `WorkerOperationalStatus` | Default `DRAFT`; `REMOVED` terminal |
| `version` | positive int | Starts 1; increment on accepted engagement command |
| `acceptedInvitationLocale` | nullable `PreferredLanguage` | Last accepted invitation locale fallback |
| `endedAt` | nullable timestamp | Set on removal or self-leave; current iff null |
| `createdAt`, `updatedAt` | timestamps | Retained history |

Indexes/constraints:

- `(provider_id, status, id)` and `(provider_id, updated_at, id)` reads.
- Partial unique index on `identity_user_id WHERE identity_user_id IS NOT NULL
  AND ended_at IS NULL`, enforcing one current engagement across Providers.
- Predecessor must be `REMOVED`, must reference the same Provider and identity,
  and cannot form a cycle; application check plus deferred constraint trigger.
- No delete path. Rehire inserts a new row.

### `ProviderWorkerProfile` → `provider_worker_profiles`

| Field | Shape | Rule |
|---|---|---|
| `workerId` | PK/FK ProviderWorker | One profile per engagement |
| `fullLegalName` | varchar(200) | Trimmed, meaningful, required for completeness |
| `gender` | `WorkerGender` | Required |
| `operationalPhoneE164` | varchar(16) | Required E.164; never Authentication truth |
| `workerType` | `WorkerType` | Required |
| `displayTitle` | nullable varchar(120) | Optional |
| `supervisorCapable` | boolean | Independent of Worker type |
| `avatarMediaFileId` | nullable unique FK MediaFile | Media-owned private READY avatar |
| `version` | positive int | Profile/avatar CAS |
| timestamps | | |

The phone is excluded from generic history/audit/outbox JSON and from all DTOs
except Owner/Admin/self/current-primary-Supervisor projections.

### `ProviderWorkerSkill` → `provider_worker_skills`

Fields: `id`, `workerId`, `displayLabel` (varchar 100), `normalizedLabel`
(varchar 100), timestamps. Unique `(worker_id, normalized_label)`. Skill-set
replacement increments the profile/aggregate version and writes safe history.
No R1-P08 FK is created.

### `ProviderWorkerLoginAccess` → `provider_worker_login_access`

One row per Worker: `workerId` PK/FK, `status`, `version`, nullable
`currentInvitationId`, `activatedAt`, `revokedAt`, timestamps. This is the
Provider-owned access projection, not a credential or session. Every transition
requiring Authentication role change occurs through a transaction-bound public
writer in the Providers transaction.

### `ProviderWorkerInvitation` → `provider_worker_invitations`

Immutable issued versions with mutable terminal status:

- `id`, `workerId`, `invitationVersion` (positive int), `emailNormalized`
  (varchar 320), `locale` (`PreferredLanguage`), `status`, `version` (CAS).
- `issuedByUserId`, nullable `acceptedByUserId`, `issuedAt`, `expiresAt`,
  `acceptedAt`, `revokedAt`, `expiredAt`, `supersededAt`, timestamps.
- Unique `(worker_id, invitation_version)`; at most one `PENDING` row per Worker
  through partial unique index.
- No raw token, token verifier, password, OTP, or link column. The signed bearer
  proof is regenerated from immutable fields using existing external
  `AUTH_VERIFIER_SECRET` and domain separation.
- Expiry is exactly 72 hours from issuance. Resend terminally supersedes every
  prior pending version and stores a newly selected `AR` or `EN` locale.

### `ProviderTeam` → `provider_teams`

Fields: `id`, `providerId`, nullable `name`, nullable `normalizedName`, `status`
(default `DRAFT`), nullable `primarySupervisorWorkerId`, `version`, timestamps.

Constraints:

- Partial unique `(provider_id, normalized_name) WHERE status <> 'ARCHIVED' AND
  normalized_name IS NOT NULL`.
- `ACTIVE` requires a valid normalized name and at least one current member
  whose Worker is `ACTIVE`, type `CLEANING_STAFF`, and `cleans=true`.
- Primary Supervisor is optional but, when set, must be an `ACTIVE` Worker of
  the same Provider, current member of this Team, and Supervisor-capable.
- `ARCHIVED` is terminal; archive is allowed only from `INACTIVE`.

### `ProviderTeamMembership` → `provider_team_memberships`

Fields: `id`, `teamId`, `workerId`, `cleans`, `version`, `startedAt`, nullable
`endedAt`, timestamps.

Constraints:

- Partial unique `(worker_id) WHERE ended_at IS NULL` for one current Team
  membership across the Provider.
- Unique `(team_id, worker_id, started_at)` for historical identity.
- Team and Worker must belong to the same Provider.
- Any current or historical membership created/updated while Worker type is
  `ESCORT` has `cleans=false`; `cleans=true` is rejected.
- Moving a Worker ends the old membership and creates a new membership in one
  transaction; history is append-only.

### `ProviderWorkforceHistory` → `provider_workforce_history`

Immutable safe event ledger: `id`, `providerId`, `targetType`, `targetId`,
`targetVersion`, `eventCode` (varchar 100), `actorUserId`, nullable
`reasonCode`, nullable `note` (bounded), nullable `safeBefore`/`safeAfter` JSON,
`requestId`, `createdAt`.

Rules:

- No update/delete application methods.
- JSON allowlists exclude operational phone, email where unnecessary,
  invitation bearer proof, OTP/password/session/credential data, storage key,
  and raw audit payload.
- Separate rows record each truth in atomic multi-target commands, including
  membership change and Team inactivation.

### `ProviderWorkforceCommand` → `provider_workforce_commands`

Idempotency ledger: `id`, `providerId`, `scopeKey`, `idempotencyKey`,
`requestFingerprint`, `status`, nullable `safeResultCode`, nullable
`safeResultJson`, `actorUserId` (nullable before authenticated invitation
onboarding), `createdAt`, `completedAt`. Unique `(scope_key, idempotency_key)`;
same key+fingerprint replays the prior result, same key+different fingerprint is
a safe 409 conflict. Sensitive submitted fields are never copied into result
JSON.

### `ProviderWorkforceNotificationIntent` → `provider_workforce_notification_intents`

Fields: `id`, `providerId`, `template`, `locale`, nullable `recipientUserId`,
nullable `recipientEmailNormalized`, nullable `invitationId`, nullable
`historyId`, `safeVariables` JSON, unique `idempotencyKey`, status/attempt/lease
fields matching the current Provider dispatcher pattern, timestamps.

Constraints:

- Exactly one usable recipient route is present; pre-account invitation uses
  email, post-acceptance prefers user identity.
- `locale` is immutable intent meaning. Invitation intents use their version
  locale; later messages use valid User preference, then accepted invitation
  locale, then `AR`.
- Safe variables contain no full phone, invitation proof/link, credential,
  password, OTP, cookie, storage key, or arbitrary audit JSON.
- Dispatcher failure/retry updates delivery fields only.

### Existing model changes

- `Provider`: opposite relations to Workers, Teams, history, commands, intents,
  plus `workforceStateVersion Int @default(1)` as the CAS anchor for creating a
  new Worker or Team when no target aggregate version exists yet. It is not a
  readiness flag and does not affect public-browse eligibility.
- `User`: opposite relations for Worker identities, invitation actors,
  workforce-history actors, intent recipients.
- `MediaFile`: add `WORKER_PROFILE_IMAGE` to `MediaOwnerType` and nullable
  one-to-one opposite relation/ownership fields needed by Media. Storage remains
  Media-owned.
- `ProviderMember`: add `version Int @default(1)` for exact-version Admin
  grant/revocation. Existing rows retain their current authority meaning.

## Lifecycle matrices

### Worker engagement

| From | To | Data effect |
|---|---|---|
| New | `DRAFT` | Insert Worker + profile; identity may be null |
| `DRAFT` | `ACTIVE` | Required operational profile is complete; login access remains a separate lifecycle |
| `ACTIVE` | `INACTIVE` | Reason required; clear invalid primary assignment; last-cleaner impact may inactivate Team |
| `INACTIVE` | `ACTIVE` | Recheck required operational profile and transition rules; login access remains separate |
| non-removed | `REMOVED` | Owner removal or self-leave; end membership/access; terminal history |
| `REMOVED` | any | Prohibited; rehire inserts linked Worker |

### Login access and invitation

| Access | Event | Result |
|---|---|---|
| none | issue | `INVITED`, one `PENDING` version |
| `INVITED` | accept latest valid version | invitation `ACCEPTED`, access `ACTIVE`, identity/role link |
| `INVITED` | 72-hour expiry | invitation/access `EXPIRED` |
| `INVITED` | revoke | invitation/access `REVOKED` |
| `ACTIVE` | revoke or engagement end | access `REVOKED`; identity stays |
| `EXPIRED`/`REVOKED` | issue/resend | new version, access `INVITED`; old terminal evidence stays |

### Team

| From | To | Data effect |
|---|---|---|
| New | `DRAFT` | Name may be absent; members are permitted but not required |
| `DRAFT` | `ACTIVE` | Unique name + at least one valid cleaner |
| `ACTIVE` | `INACTIVE` | Owner/Admin command or confirmed atomic last-cleaner consequence |
| `INACTIVE` | `ACTIVE` | Recheck name and valid cleaner |
| `INACTIVE` | `ARCHIVED` | End memberships, clear Supervisor, retain history |
| `ARCHIVED` | any | Prohibited |

## Cross-row invariants and lock checks

1. Lock Provider membership before any workforce aggregate.
2. Lock Worker before profile/access/invitations.
3. Lock all affected Teams ascending, then memberships ascending.
4. Recompute valid cleaners while locked.
5. Supervisor final-cleaner `cleans=false` conflicts without writes.
6. Owner/Admin confirmed final-cleaner change updates membership and Team
   `INACTIVE` plus separate history/audit/idempotency/outbox atomically.
7. Changing `CLEANING_STAFF` to `ESCORT` conflicts while current membership has
   `cleans=true`.
8. Clearing Supervisor assignment precedes any transition that would make the
   assigned Worker invalid, inside the same transaction.
9. `workersReady` is queried/derived and never written as a mutable flag.

## Deletion and retention

Worker engagements, invitations, membership history, lifecycle history, audit,
idempotent accepted outcomes, and notification evidence are not hard-deleted by
ordinary operations. Private media cleanup follows Media policy; removing an
avatar association does not bypass Media retention/cleanup state.
