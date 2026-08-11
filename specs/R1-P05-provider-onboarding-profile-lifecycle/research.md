# Phase 0 Research — R1-P05 Provider Onboarding, Profile & Lifecycle

**Date**: 2026-08-10  
**Status**: Complete — no unresolved technical clarification  
**Authority**: [spec.md](./spec.md), DEC-036, OQ-007, the active R1-P05
roadmap section, and the Cleanora constitution

## RQ-01 — Which module owns R1-P05?

**Decision:** Introduce one `providers` business module. It owns provider
applications, provider/profile/contact/member/invitation/gallery persistence,
application and operational lifecycle rules, completion/readiness projections,
dashboard/settings aggregation, provider-scoped authorization facts, and all
R1-P05 HTTP workflows.

`authentication` continues to own identity categories, role grants, OTPs,
credentials, and global permissions. `customers` owns Individual/Company
profiles. `configuration` owns active countries. `media` owns storage metadata
and Cloudinary operations. `admin` owns `audit_logs`. Cross-module calls use
explicit public contracts wired in `composition.ts`.

**Alternatives rejected:** placing providers inside `customers`; letting
Authentication own provider review; a generic marketplace module; or direct
cross-module repository/Prisma access.

## RQ-02 — How is pre-approval authority represented?

**Decision:** `providers.application_owner_user_id` is the authoritative,
draft-scoped `Application Owner` link. It permits only the selected user's
editable application/profile/contact/media reads and writes plus
submit/resubmit. It is not Provider membership and does not grant
`PROVIDER_OWNER` or `provider_admin`.

Successful Staff Admin approval atomically sets `owner_user_id`, creates active
Provider `OWNER` membership, adds verified `PROVIDER_OWNER`, and assigns or
enables the existing `provider_admin` role. Admin invitations are unavailable
until approval.

## RQ-03 — Who owns the approval transaction?

**Decision:** `ProviderApprovalService` owns the approval use case and
the database transaction because providers owns the application lifecycle.
`PrismaProvidersUnitOfWork` receives two transaction-bound factories through
composition:

1. `ProviderIdentityAuthorityWriter` from Authentication, which alone maps
   `users`, `roles`, and `user_roles`; and
2. Admin's general transactional audit writer, which alone maps `audit_logs`.

The transaction locks/rechecks the pending Provider and latest review cycle,
rechecks current applicant eligibility/profile facts, transitions the
application, grants identity authority, creates OWNER membership/history,
appends audit, and enqueues mandatory email intent. Any failure rolls back all
database effects. External email and Cloudinary calls never run inside the
transaction.

**Alternatives rejected:** calling the existing standalone role-management
transaction from inside approval; providers writing Authentication tables;
eventual consistency for ownership grants; or moving provider tables into
Authentication.

## RQ-04 — What public cross-module contracts are required?

**Decision:** Add narrow contracts without leaking Prisma rows:

- Authentication: `ProviderIdentityReader`,
  `ProviderIdentityAuthorityWriter`, and invitation-only identity onboarding
  commands. Authority writes are restricted to `PROVIDER_OWNER` and the
  existing `provider_admin` role.
- Customers: `ProviderApplicantProfileReader` returns the matching
  Individual/Company name and completeness context.
- Configuration: `ActiveCountryReader` resolves an active `countryCode`.
- Media: extend `media.public.ts` for provider image/video upload, PROCESSING/
  FAILED state, safe signed delivery, derived video thumbnail delivery, and
  cleanup lifecycle.
- Admin: reuse transaction-scoped general audit and safe denial audit ports.
- Email: use the existing `EmailPort`; providers supplies provider-specific
  template intent and idempotency keys.

## RQ-05 — How is authorization enforced?

**Decision:** Three deny-by-default lanes are separate:

- `Application Owner`: active, non-verification-only principal plus exact
  server-read `application_owner_user_id`, only before terminal approval or
  rejection and only in editable application states.
- Provider OWNER/ADMIN: active principal, enabled global `provider_admin` role,
  active membership for the exact requested Provider, required membership
  level, and usable resource state. OWNER-only operations also require
  membership level `OWNER`.
- Invitation acceptance: the fixed-email verification result is a restricted
  authenticated onboarding principal authorized only for accept/session cleanup.
  Acceptance atomically enables Authentication's `provider_admin` role and the
  Providers-owned membership. Authentication derives later full login
  capability from its role state and never reads Provider tables; every
  Provider resource request still rechecks the exact active membership.
- Staff Admin: active principal with new global permissions
  `providers.applications.review` or `providers.lifecycle.manage`, seeded only
  to `staff_admin`.

Provider scope facts come from `provider_members`; caller-supplied provider,
member, role, kind, status, and ownership facts are never authoritative.
Suspension blocks operating/public eligibility but does not disable active
management memberships.

## RQ-06 — What is the Staff Admin review contract?

**Decision:** Staff APIs provide a deterministic queue, private dossier,
approve, request-changes, reject, suspend, and reinstate commands. Queue order
is `submitted_at ASC, id ASC`; cursors encode both values. Default page size is
20 and maximum is 100. Filters are application status, provider kind, and
submitted time range.

Changes request, rejection, suspension, and reinstatement require trimmed
reason text; approval uses a fixed audit action and no caller reason. Every
decision records actor, time, previous/next state, cycle, and reason where
required. Staff reads include private identity/contact evidence and never emit
storage keys or raw invitation tokens.

## RQ-07 — Which HTTP resource layout is used?

**Decision:** Authenticated provider workflows use `/api/v1/providers` with
resource ids after creation. Staff workflows use
`/api/v1/staff/providers`. Token-bearing invitation workflows use
`/api/v1/provider-admin-invitations`; raw tokens are supplied in request bodies,
not path/query strings.

The contract covers create/list accessible Providers, private aggregate,
profile, contacts, media, completion, readiness, submit, history, dashboard,
settings, contact-free preview, members, invitations, safe invitation
inspection/acceptance, invitation-only onboarding, and the Staff Admin review
and operational commands. R1-P05 defines no anonymous Browse or public Provider
Details route.

All responses use Cleanora's success/error envelope and request id. Every
mutable JSON or multipart command carries `expectedVersion`; stale writes
return a stable 409 conflict.

## RQ-08 — How is provider media handled?

**Decision:** Reuse and extend the existing `media` module and Cloudinary
adapter. Providers owns authorization and media associations; media owns
`media_files`, byte validation/normalization, signed delivery, and cleanup.

- Images: JPEG/PNG/WebP input, at most 5 MiB; Sharp decode, auto-orient,
  metadata strip, center-cover resize, and WebP output at 600x600 logo,
  1600x600 cover, or 1200x900 gallery.
- Videos: MP4/WebM input, at most 40 MiB; Cloudinary video upload returns
  authoritative width/height and the asset is rejected/cleaned if above
  1920x1080. No 60-second enforcement.
- Logo and cover are single slots. Gallery permits 12 images and 2 videos.
  Pending items reserve capacity so concurrent uploads cannot exceed limits.
- Media rows expose safe processing states. Only READY associations contribute
  to completion. Video thumbnails use an authorized signed Cloudinary derived
  image from the same opaque storage key; the key never leaves the media port.
- Upload happens outside database transactions. Reservation/finalization use
  CAS; failed uploads become cleanup-eligible and never replace a READY slot.

**Alternatives rejected:** provider-specific storage code, client-side count or
dimension authority, local filesystem, public URLs, raw Cloudinary ids, hard
video-duration rejection, or external I/O inside Prisma transactions.

## RQ-09 — How does admin invitation onboarding work?

**Decision:** An approved OWNER creates a hashed-token invitation. The raw
256-bit token is returned only to the email adapter/link builder and submitted
to API inspect/accept bodies. Storage keeps a keyed verifier/hash, normalized
email, 72-hour expiry, version, and lifecycle timestamps. Resend rotates the
verifier and increments token version, invalidating prior tokens. Revoke and
accept use CAS and row locking.

Existing users authenticate and must have the same verified normalized email
before acceptance. New users use an Authentication-owned invitation-only
registration and email-OTP path with fixed email, required phone/password, and
empty customer-category arrays. After verification, the authenticated user
calls the same idempotent accept command. Acceptance atomically consumes the
invitation, creates active ADMIN membership, reconciles the global
`provider_admin` role, appends history/audit, and returns the Provider scope.

If identity verification succeeds but final acceptance encounters a transient
failure, the verified identity and still-valid invitation permit safe retry;
no Provider authority is granted until acceptance commits.

## RQ-10 — How are membership disable/remove semantics handled?

**Decision:** R1-P05 persists membership status `ACTIVE` or `DISABLED`; HTTP
`DELETE` performs a soft disable and never deletes history. A later re-invite
may reactivate a disabled ADMIN exactly once. OWNER membership cannot be
disabled or removed through Provider APIs. After an ADMIN is disabled,
providers counts that user's remaining active Provider memberships/ownerships
inside the transaction and asks Authentication to disable `provider_admin`
only when none remain.

## RQ-11 — How are completion, readiness, dashboard, and settings produced?

**Decision:** They are derived projections and create no generic settings or
readiness table.

`profileCompletion` policy `r1-p05-v1` has the ten stable codes in `spec.md`,
each worth 10 points. Documents and later-phase gates never affect it.
`marketplaceReadiness` returns the eleven locked gates with applicability,
status, satisfaction, blocker codes, and owning phase. Individual documents are
`NOT_REQUIRED`; Company documents are `BLOCKED` by R1-P06. Future gates are
`NOT_STARTED`/`BLOCKED`; public eligibility is always false.

Dashboard and settings compose bounded Provider-owned reads plus existing
account/security links/status. They never expose private contacts in preview
and never persist an unstructured settings object.

## RQ-12 — How are post-approval edits and suspension handled?

**Decision:** Permitted post-approval profile/contact/media edits keep
application status `APPROVED`, increment Provider version, append general audit,
and recalculate projections. R1-P12 owns any future public-change moderation.

`SUSPENDED` blocks operating/public readiness only. Active OWNER/ADMIN may
continue authorized management/remediation. Staff reinstatement in R1-P05
always sets `INACTIVE`; it never restores or grants `LIVE`.

## RQ-13 — How are mandatory emails made reliable?

**Decision:** Providers owns a narrow transactional email outbox for
application submission, review-decision, and operational notices.
The business transaction inserts a unique idempotency-keyed intent; a bounded
in-process dispatcher sends through `EmailPort` outside the transaction and
records attempt count, next attempt, sent time, and last safe error code. Retry
delays are 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours; the fifth
failed attempt becomes terminal `FAILED` for explicit operational repair.

Admin-invitation delivery is deliberately different: the random raw token
exists only in process memory after its verifier commits, is sent immediately
post-commit, and is never placed in the durable outbox. If delivery fails, the
safe invitation record reports resend-required and OWNER resend rotates the
token/verifier and expiry before another attempt.

This is active-phase delivery infrastructure, not R1-P23 notification history
or preferences. No queue, BullMQ, Docker, cloud scheduler, SMS, optional
preference, or generic notification table is introduced. Missing mandatory
email configuration fails the providers readiness probe.

## RQ-14 — How are retries and concurrency controlled?

**Decision:** Database uniqueness plus serializable or locked short
transactions protect one application per user, one owner per Provider, one
member per Provider/user, one active invitation per Provider/email, review
cycle numbering, gallery limits, approval, acceptance, and role reconciliation.

Commands use `expectedVersion`. Initial create safely returns the existing
Provider for an identical retry and conflicts on a different kind. Approval and
invitation acceptance are idempotent for the already-completed matching
outcome; conflicting terminal/state outcomes fail. External delivery uses
outbox idempotency keys.

## RQ-15 — What migration is planned?

**Decision:** One forward-only migration named
`r1_p05_provider_onboarding_profile_lifecycle` incrementally extends
`prisma/schema.prisma`, Authentication permission seeds, the invitation-only
OTP purpose/category shape, the existing user category nonempty constraint,
media owner/status enums, and the eight R1-P05 Provider models described in
[data-model.md](./data-model.md).

The migration intentionally drops `users_categories_nonempty_check` so only
Authentication's invitation-only workflow can create an identity with empty
category arrays. Existing category subset constraints remain. No applied
migration is edited and no Provider backfill occurs. SQL adds partial indexes
and CHECK constraints not expressible in Prisma; implementation validates clean
apply, double seed, Prisma generation, and R1-P01 through R1-P04A compatibility.

## RQ-16 — What performance and operational bounds apply?

**Decision:** Non-media endpoints use bounded queries, explicit selects, and
deterministic cursor pagination. Queue/list page size is 20 by default and 100
maximum. Dashboard/settings avoid unbounded fan-out. Media uploads are bounded
by fixed counts and bytes; external upload latency is excluded from database
transaction time. Outbox processing uses bounded batches and does not overlap
unbounded database work.

No product SLA or unsupported scale forecast is invented. Quickstart records a
repeatable concurrency workload for invariants and query bounds rather than a
fragile wall-clock pass criterion.

## RQ-17 — What remains explicitly deferred?

**Decision:** R1-P06 documents/payout destinations; R1-P07 workers/teams;
R1-P09 offerings/pricing; R1-P10 coverage/availability/capacity; R1-P11
eligibility; R1-P12 anonymous Browse/public details and public-change
moderation; R1-P23 notification center/preferences; Staff Admin provisioning;
frontend UI; ownership transfer; rejected restart; Docker/cloud/deployment;
and all booking/order/payment work remain out of scope.

## Research completion

No `NEEDS CLARIFICATION` remains. The five product decisions are recorded in
the specification; all other choices above are technical planning decisions
that preserve canonical behavior and module ownership.
