# R1-P07 Research and Technical Decisions

**Date:** 2026-08-22
**Authority:** DEC-038, DEC-039, `spec.md`, Cleanora Constitution, repository architecture

No product question remains open. These decisions resolve implementation
approach only and do not authorize implementation.

## Decision 1 — Extend Providers; do not create a Workers module

**Decision:** Providers owns Worker engagements/profiles, skills, Teams,
memberships, primary-Supervisor assignment, access projection, invitations,
history, idempotency, notification intents, and `workersReady`.

**Rationale:** These facts define the Provider's workforce and exact-Provider
authorization. One owner preserves atomic Team/readiness behavior.

**Rejected:** A Workers module splits one transaction across artificial owners;
Authentication ownership conflates credentials with operations; shared
repositories violate the constitution.

## Decision 2 — Public contracts at existing seams

**Decision:** Extend `authentication.public.ts`, `media.public.ts`,
`audit.public.ts`, and `providers.public.ts`. Composition injects concrete
transaction-bound factories; Providers never imports another module's private
repository or Prisma adapter.

**Rationale:** This follows current R1-P05/R1-P06 wiring and keeps dependency
direction explicit.

**Rejected:** Cross-module Prisma access violates ownership. Internal HTTP adds
failure modes without meaningful decoupling.

## Decision 3 — Provider-owned transaction and fixed lock order

**Decision:** `ProviderWorkforceService` coordinates through
`PrismaProvidersWorkforceUnitOfWork`. Commands lock idempotency scope, Provider
membership, Worker rows, Teams, memberships, authority projection, and then
append history/audit/outbox in the documented order.

**Rationale:** Last-cleaner and readiness changes otherwise race. Sorted locks
produce deterministic safe conflicts instead of partial commits/deadlocks.

**Rejected:** Optimistic checks alone cannot protect cross-row invariants;
serializable isolation alone is not a documented business lock strategy.

## Decision 4 — Deterministic non-persisted invitation bearer proof

**Decision:** The invitation link carries routing fields plus an HMAC signature
derived with existing `AUTH_VERIFIER_SECRET`, domain
`cleanora:worker-invitation:v1`, invitation ID/version, email identity, and
expiry. Inspection/acceptance regenerates and constant-time compares it. Resend
creates a new version and supersedes earlier versions.

**Rationale:** The outbox stores only an invitation reference and regenerates
the link at delivery. No plaintext token or generic token hash is persisted or
logged, and no new env setting is required.

**Rejected:** Persisting raw links violates DEC-038; adding a secret violates
the locked configuration decision; JWT access secrets couple unrelated token
semantics.

## Decision 5 — Separate invitation versions from access projection

**Decision:** `ProviderWorkerInvitation` is immutable per issued version;
`ProviderWorkerLoginAccess` holds current `INVITED/ACTIVE/EXPIRED/REVOKED`
projection and version. Invitation status records terminal
`ACCEPTED/EXPIRED/REVOKED/SUPERSEDED` evidence.

**Rationale:** Resend invalidation and race winners remain auditable; Worker
status never implies access status.

**Rejected:** One mutable invitation row erases resend history. Deriving access
from Worker status violates FR-019.

## Decision 6 — Specialized workforce notification intents

**Decision:** Add `ProviderWorkforceNotificationIntent` with exact locale, safe
template key, recipient routing, invitation/history references, idempotency,
lease/retry fields, and allowlisted safe variables. Reuse SMTP adapters outside
the transaction.

**Rationale:** Pre-account invitations have no `recipientUserId`, while the
existing Provider outbox requires one. A phase-owned table avoids weakening old
invariants.

**Rejected:** Making the old recipient nullable adds R1-P05 compatibility risk;
synchronous email couples truth to SMTP.

## Decision 7 — Operational phone projection

**Decision:** Store normalized E.164 in the Provider-owned Worker Profile.
Return it only from Owner/Admin/self/current-primary-Supervisor DTOs. Other
projections omit it. Never copy it to history, audit, outbox variables, errors,
or logs.

**Rationale:** This exactly implements the privacy matrix and avoids a generic
colleague surface.

**Rejected:** Authentication phone has different ownership/verification.
Generic DTOs increase accidental leakage.

## Decision 8 — Two-stage private avatar workflow

**Decision:** Media validates/processes/uploads outside a database transaction
and returns a READY receipt. Providers then binds that media ID with profile
`expectedVersion` inside its transaction. Replaced/unbound media becomes
cleanup-eligible; authorized reads request short-lived signed delivery.

**Rationale:** Cloudinary cannot participate safely in a DB transaction. CAS
prevents stale uploads replacing newer avatars.

**Rejected:** Cloudinary I/O inside transactions violates architecture;
Providers-owned storage duplicates Media policy.

## Decision 9 — Database constraints and deferred invariants

**Decision:** Partial unique indexes enforce one current cross-Provider identity
engagement, one current Team membership per Worker, and normalized Team names
among non-archived Teams. Ordinary uniqueness protects normalized Worker skills.
Deferred PostgreSQL constraint triggers enforce Escort membership and
primary-Supervisor eligibility after each transaction, backed by domain checks.

**Rationale:** Concurrency requires DB enforcement. Deferred checks allow valid
atomic repair orderings such as clearing `cleans` before changing Worker type.

**Rejected:** Application-only uniqueness races; immediate cross-row triggers
reject valid multi-row transitions.

## Decision 10 — Derived readiness

**Decision:** `workersReady` is queried from current engagement/profile,
identity/role/access facts. Providers exposes safe readiness and booking-safe
Team/cleaning facts. `eligibleForPublicBrowse` remains unchanged/false.

**Rationale:** A writable readiness flag can drift and would improperly affect
later marketplace ownership.

**Rejected:** Persisted readiness duplicates source truth; Provider operational
status is not an equivalent gate.

The additive `Provider.workforceStateVersion` used to serialize Worker/Team
creation is only a command-version anchor. It carries no readiness or public-
browse meaning.

## Decision 11 — Closed command reason types

**Decision:** Zod and domain command unions use the five DEC-039 catalogs. The
service rejects cross-catalog codes. Removal and `OTHER` require a trimmed
meaningful note of at least 10 characters.

**Rationale:** Typed inputs assist implementation while domain validation stays
authoritative.

**Rejected:** One global enum accepts semantically wrong codes; free text
weakens audit evidence.

## Decision 12 — No new operational configuration

**Decision:** Reuse Authentication verifier/JWT/session settings, existing
Provider invitation TTL default (72 hours), SMTP/outbox lease settings,
Cloudinary private-media settings, and current profile-image limits. Add no new
secret, credential, or `.env` value.

**Rationale:** Required capabilities already exist and locked values are known.

**Rejected:** Phase-specific duplicate configuration increases operator error
and contradicts the approved no-new-secret boundary.
