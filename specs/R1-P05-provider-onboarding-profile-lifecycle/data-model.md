# Data Model — R1-P05 Provider Onboarding, Profile & Lifecycle

**Status**: **Implemented and validated**  
**Migration owner**: R1-P05 / `providers`, with narrow forward changes owned by
Authentication and Media  
**Proposed migration**: `r1_p05_provider_onboarding_profile_lifecycle`

This document was the schema-ready design basis and is now implemented by the
phase-owned forward migration. Existing applied
migrations remain immutable.

## Ownership summary

| Data | Owner | Notes |
|---|---|---|
| Provider/application/profile/contact/member/invitation/gallery/outbox | `providers` | Eight new Provider-owned tables |
| User categories, OTP, sessions, roles, grants | `authentication` | Providers participates only through public transaction-bound contracts |
| `media_files` and Cloudinary lifecycle | `media` | Providers owns semantic slots/gallery references |
| Country rows | `configuration` | Provider profile stores active country FK |
| `audit_logs` | `admin` | Provider transaction receives Admin writer |

## New enums

```text
ProviderKind = INDIVIDUAL_TEAM | REGISTERED_COMPANY

ProviderApplicationStatus =
  DRAFT | PENDING_REVIEW | CHANGES_REQUESTED | APPROVED | REJECTED

ProviderOperationalStatus = INACTIVE | LIVE | SUSPENDED
ProviderStatusDomain = APPLICATION | OPERATIONAL

ProviderMembershipLevel = OWNER | ADMIN
ProviderMembershipStatus = ACTIVE | DISABLED

ProviderInvitationStatus = PENDING | ACCEPTED | REVOKED | EXPIRED
ProviderGalleryKind = IMAGE | VIDEO

ProviderEmailTemplate =
  APPLICATION_SUBMITTED | CHANGES_REQUESTED | APPROVED | REJECTED |
  SUSPENDED | REINSTATED

ProviderEmailOutboxStatus = PENDING | SENDING | SENT | FAILED
```

Additions to existing enums:

- `OtpPurpose.PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION`
- `MediaOwnerType.PROVIDER_LOGO`
- `MediaOwnerType.PROVIDER_COVER`
- `MediaOwnerType.PROVIDER_GALLERY_IMAGE`
- `MediaOwnerType.PROVIDER_GALLERY_VIDEO`
- `MediaStatus.PROCESSING`
- `MediaStatus.FAILED`

`LIVE` is part of the locked lifecycle so it exists in the enum, but R1-P05 has
no command that can set it. Reinstatement always produces `INACTIVE`.

## Existing model changes

### `User`

Add named opposite relations only for application ownership, approved ownership,
memberships, review/history actors, and invitations.

The forward migration intentionally drops `users_categories_nonempty_check`.
An empty enrolled/verified category array is legal only for an identity created
through Authentication's invitation-only Provider Admin onboarding contract.
Public signup/enrollment continues to require a supported customer category and
must reject `PROVIDER_OWNER`. Email verification creates a restricted
invitation-onboarding principal capable only of acceptance/session cleanup.
Full login capability for the invited identity is enabled only after
Authentication sees its enabled `provider_admin` role. The Provider acceptance
transaction enables that role together with an active membership; subsequent
Provider access independently requires the exact Providers-owned membership.
Authentication never reads Provider tables, and an empty-category identity
without enabled Provider authority remains verification-only/blocked.

### `OtpCode`

Make `accountCategory` nullable and add
`PROVIDER_ADMIN_INVITATION_EMAIL_VERIFICATION`. Add a SQL purpose-shape CHECK:

- existing category-verification purposes require non-null `account_category`;
- Provider Admin invitation email verification requires null
  `account_category`, email channel, and the invitation-bound flow.

Existing rows need no backfill.

### Authorization catalogs

No new role is created. Existing `provider_admin` remains the global Provider
management capability. Add:

- `providers.applications.review`
- `providers.lifecycle.manage`

Seed both only to `staff_admin`. The seed remains idempotent and creates no
runtime grant. Approval may add verified `PROVIDER_OWNER` only through the
Authentication-owned transaction participant. Public signup/enrollment never
accepts that category.

### `MediaFile`

Add the four Provider owner types and the `PROCESSING`/`FAILED` states. Media
owns technical storage/processing state. `ownerUserId` is the authoritative
application/approved owner identity, while Provider authorization is derived
from Provider ownership/membership and purpose-specific references—not from a
caller-supplied media owner id.

No public storage key, direct URL, credential, or polymorphic arbitrary owner id
is added.

## Provider-owned tables

Exactly these eight tables are introduced.

### 1. `Provider`

| Field | Type | Rules |
|---|---|---|
| `id` | cuid string | PK |
| `applicationOwnerUserId` | string | required, unique, FK users RESTRICT |
| `ownerUserId` | nullable string | unique, FK users RESTRICT; null until approval |
| `kind` | ProviderKind | mutable only before first submission |
| `applicationStatus` | ProviderApplicationStatus | default DRAFT |
| `operationalStatus` | ProviderOperationalStatus | default INACTIVE |
| `reviewCycle` | integer | default 0; incremented exactly once per accepted submission |
| `version` | integer | default 1, positive CAS token |
| `firstSubmittedAt` | nullable timestamp | set once; locks kind |
| `lastSubmittedAt` | nullable timestamp | queue ordering/cursor |
| `applicationChangedAt` | timestamp | current application status change time |
| `operationalChangedAt` | timestamp | current operational status change time |
| `approvedAt` | nullable timestamp | set on approval |
| `rejectedAt` | nullable timestamp | set on terminal rejection |
| `suspendedAt` | nullable timestamp | current suspension time |
| `createdAt`, `updatedAt` | timestamp | standard |

Constraints/indexes:

- unique `application_owner_user_id` prevents a second Provider/application,
  including after rejection;
- unique nullable `owner_user_id` prevents one user owning two approved Providers;
- CHECK `version > 0` and `review_cycle >= 0`;
- CHECK timestamp/status consistency for APPROVED/REJECTED/SUSPENDED;
- index `(application_status, kind, last_submitted_at, id)` for Staff queue;
- index `(operational_status, id)` for later lifecycle consumers.

Application transitions:

```text
DRAFT -> PENDING_REVIEW
PENDING_REVIEW -> CHANGES_REQUESTED | APPROVED | REJECTED
CHANGES_REQUESTED -> PENDING_REVIEW
```

`REJECTED` and `APPROVED` are terminal. Post-approval profile/contact/media
management does not reopen or demote approval.

Operational transitions implemented here:

```text
INACTIVE -> SUSPENDED
SUSPENDED -> INACTIVE
```

### 2. `ProviderProfile`

| Field | Type | Rules |
|---|---|---|
| `id` | cuid | PK |
| `providerId` | string | unique FK providers RESTRICT |
| `displayNameAr` | nullable varchar(200) | required for submission after trim |
| `displayNameEn` | nullable varchar(200) | optional |
| `descriptionAr` | nullable varchar(4000) | required for submission after trim |
| `descriptionEn` | nullable varchar(4000) | optional |
| `countryId` | nullable string | FK countries RESTRICT; must be active on accepted write/submission |
| `logoMediaFileId` | nullable string | unique FK media_files RESTRICT; current READY slot only |
| `coverMediaFileId` | nullable string | unique FK media_files RESTRICT; current READY slot only |
| timestamps | timestamp | standard |

The authoritative Individual/Company applicant names are not duplicated.
Private review reads them through Customers. Display names are presentation
values and cannot override the applicant identity.

Logo/cover upload reserves a new Media row first. The profile pointer changes
only after successful READY finalization, so a failed replacement preserves the
previous READY asset.

### 3. `ProviderContact`

| Field | Type | Rules |
|---|---|---|
| `id` | cuid | PK |
| `providerId` | string | unique FK providers RESTRICT |
| `operationalEmailNormalized` | nullable varchar(320) | required for submission |
| `operationalPhoneE164` | nullable varchar(16) | required for submission |
| `channels` | JSON | validated ordered array of `{type,value}`, maximum 20, private |
| timestamps | timestamp | standard |

This single row is full-replaced through the typed contacts endpoint. Channel
types are the closed set `WHATSAPP`, `SOCIAL`, `WEBSITE`, and
`EXTERNAL_BOOKING`; WhatsApp/Website/External Booking allow at most one value
each, Social permits multiple unique normalized HTTPS URLs, and every value is
type-validated. JSON is used only for this bounded typed contact array; it is
not a generic settings object. Every field is private and absent from preview/
customer DTOs.

### 4. `ProviderStatusHistory`

| Field | Type | Rules |
|---|---|---|
| `id` | cuid | PK |
| `providerId` | string | FK providers RESTRICT |
| `domain` | ProviderStatusDomain | APPLICATION or OPERATIONAL |
| `fromApplicationStatus` | nullable ProviderApplicationStatus | application rows only |
| `toApplicationStatus` | nullable ProviderApplicationStatus | application rows only |
| `fromOperationalStatus` | nullable ProviderOperationalStatus | operational rows only |
| `toOperationalStatus` | nullable ProviderOperationalStatus | operational rows only |
| `reviewCycle` | nullable integer | required for submission/review rows |
| `actorUserId` | string | FK users RESTRICT |
| `reason` | nullable varchar(2000) | required for changes/reject/suspend/reinstate |
| `requestId` | nullable string | trace correlation only |
| `createdAt` | timestamp | append-only ordering |

SQL CHECKs enforce exactly one typed status pair per domain, valid reason shape,
and positive review cycles. Partial unique constraints provide one submission
transition and one final review decision for `(provider_id, review_cycle)`.
Rows are append-only and never cascade-deleted.

### 5. `ProviderMember`

| Field | Type | Rules |
|---|---|---|
| `id` | cuid | PK |
| `providerId` | string | FK providers RESTRICT |
| `userId` | string | FK users RESTRICT |
| `level` | ProviderMembershipLevel | OWNER or ADMIN |
| `status` | ProviderMembershipStatus | ACTIVE or DISABLED |
| `invitedByUserId` | nullable string | OWNER FK users RESTRICT; null for OWNER |
| `enabledAt` | timestamp | required for active membership |
| `disabledAt` | nullable timestamp | required when disabled |
| timestamps | timestamp | standard |

Constraints:

- unique `(provider_id, user_id)`;
- partial unique one OWNER per Provider;
- OWNER is always ACTIVE and has no inviter;
- status/timestamp consistency;
- indexes `(user_id, status)` and `(provider_id, level, status)`.

Disabling ADMIN is soft. No R1-P05 API deletes membership evidence or disables
the OWNER.

### 6. `ProviderAdminInvitation`

| Field | Type | Rules |
|---|---|---|
| `id` | cuid | PK |
| `providerId` | string | FK providers RESTRICT |
| `emailNormalized` | varchar(320) | private target identity |
| `tokenVerifier` | char(64) | unique keyed digest; never raw token |
| `tokenVersion` | integer | positive; increments on resend |
| `status` | ProviderInvitationStatus | default PENDING |
| `version` | integer | positive CAS token |
| `invitedByUserId` | string | OWNER FK users RESTRICT |
| `acceptedByUserId` | nullable string | matching user FK users RESTRICT |
| `expiresAt` | timestamp | exactly 72 hours from latest creation/resend |
| `sentAt` | nullable timestamp | last successful immediate send |
| `deliveryFailedAt` | nullable timestamp | last immediate send failure |
| `lastSafeDeliveryErrorCode` | nullable varchar(100) | no SMTP payload/message |
| `acceptedAt`, `revokedAt`, `expiredAt` | nullable timestamp | state-specific |
| timestamps | timestamp | standard |

Constraints/indexes:

- partial unique `(provider_id, email_normalized)` while PENDING;
- unique token verifier;
- positive version/tokenVersion;
- terminal timestamp/user consistency;
- indexes `(provider_id, status, created_at)` and `(status, expires_at)`.

Create/resend commits the verifier/version/expiry/audit, then sends the raw token
once from process memory. The token never enters an outbox, log, audit, or API
response. A delivery failure records only safe failure state and requires OWNER
resend; resend rotates verifier, raw token, version, and expiry, invalidating all
older tokens. Lazy/sweep expiry materializes `EXPIRED` before another invitation
for the same email.

### 7. `ProviderGalleryItem`

| Field | Type | Rules |
|---|---|---|
| `id` | cuid | PK |
| `providerId` | string | FK providers RESTRICT |
| `mediaFileId` | string | unique FK media_files RESTRICT |
| `kind` | ProviderGalleryKind | IMAGE or VIDEO |
| `position` | integer | non-negative stable order |
| `createdByUserId` | string | authorized uploader FK users RESTRICT |
| timestamps | timestamp | standard |

Unique `(provider_id, position)`. Provider row locking plus service policy
enforces at most 12 images and 2 videos, counting reserved/PROCESSING media.
Video READY requires both validated video and READY thumbnail. Only READY items
count toward completion/readiness. Removal deletes the business reference and
marks the Media row `PENDING_DELETE` for bounded cleanup; history/audit retains
the mutation evidence.

### 8. `ProviderEmailOutbox`

| Field | Type | Rules |
|---|---|---|
| `id` | cuid | PK |
| `providerId` | string | FK providers RESTRICT |
| `template` | ProviderEmailTemplate | six closed non-invitation templates |
| `status` | ProviderEmailOutboxStatus | default PENDING |
| `recipientUserId` | string | identity email resolved at dispatch |
| `reviewCycle` | nullable integer | application decision context |
| `statusHistoryId` | nullable string | FK status history RESTRICT |
| `idempotencyKey` | varchar(200) | unique |
| `attemptCount` | integer | default 0, non-negative |
| `nextAttemptAt` | nullable timestamp | dispatcher schedule; null when terminal |
| `lockedUntil` | nullable timestamp | recoverable lease |
| `sentAt` | nullable timestamp | terminal success |
| `lastSafeErrorCode` | nullable varchar(100) | no SMTP payload/message |
| timestamps | timestamp | standard |

The six durable templates cover submission, requested changes, approval,
rejection, suspension, and reinstatement. The dispatcher resolves the current
authoritative recipient email, sends outside the transaction in bounded batches,
and records only safe delivery state. Retry delays are 1 minute, 5 minutes,
30 minutes, 2 hours, and 12 hours; after the fifth failed attempt status becomes
terminal `FAILED`, `nextAttemptAt` becomes null, and operational evidence remains
visible for explicit repair. Invitation email is intentionally excluded.

Indexes: unique idempotency key and `(status, next_attempt_at, locked_until)`.
Outbox rows are operational evidence, not R1-P23 notification history or user
preferences.

## Derived, non-persisted projections

### Profile completion policy `r1-p05-v1`

Exactly ten boolean checks, each worth 10 points:

1. `ELIGIBLE_CATEGORY_VERIFIED`
2. `MATCHING_CUSTOMER_PROFILE_COMPLETE`
3. `ARABIC_DISPLAY_NAME`
4. `ARABIC_DESCRIPTION`
5. `OPERATIONAL_EMAIL`
6. `OPERATIONAL_PHONE`
7. `ACTIVE_COUNTRY`
8. `READY_LOGO`
9. `READY_COVER`
10. `MIN_READY_GALLERY_IMAGES`

Documents and every later-phase gate are excluded.

### Marketplace readiness

Derived on read. R1-P05 returns all eleven locked gates; future gates remain
blocked/not started, Individual documents are `NOT_REQUIRED`, Company documents
are R1-P06-blocked, and `eligibleForPublicBrowse` is always false.

### Dashboard and settings

Derived from bounded Provider tables plus safe Authentication/account links.
No provider settings, completion, readiness, dashboard, or public-view table is
created.

## Migration SQL review checklist

- [ ] Migration is forward-only and named exactly for R1-P05.
- [ ] Exactly eight Provider-owned tables are created.
- [ ] `users_categories_nonempty_check` is deliberately dropped while public
      enrollment and login policies preserve category safety.
- [ ] Nullable OTP category has an exact purpose/channel/category CHECK.
- [ ] Provider Media owner/status enum values are added once.
- [ ] One-application/owner/member/slot/pending-invite partial uniqueness exists.
- [ ] Every version/count/position/domain/timestamp CHECK exists.
- [ ] No FK cascades application/history/member/invitation/outbox evidence away.
- [ ] No raw token, credential, direct URL, generic settings, document, payout,
      worker, service, coverage, eligibility, or booking table/column exists.
- [ ] Seed changes add only two Staff permissions/mappings and remain idempotent.
- [ ] Migration inventory validates the full chronology, not a shortened subset.
- [ ] Prisma generation/validation, isolated clean migration, double seed,
      constraint probes, and earlier-phase compatibility tests pass.

## Backfill and forward-fix policy

There are no pre-existing Provider rows, so no Provider backfill is required.
Existing OTP category values remain unchanged when the column becomes nullable.
If applied SQL needs correction, create a new forward migration; never edit an
applied migration.
