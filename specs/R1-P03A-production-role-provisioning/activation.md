# R1-P03A — Production Role Provisioning (Owner MVP)

**Status:** Complete as of `2026-08-07` by explicit human-owner approval (DEC-030)

**Activated:** 2026-08-06 (original); **Revised:** 2026-08-07 per DEC-030;
**Completed:** 2026-08-07

## Goal

Provide a minimal, fail-closed production path to provision `staff_admin` and to
expose ordinary **non-customer** role management without weakening R1-P02 or R1-P03.

## Scope under DEC-030

1. `POST /api/v1/internal/owner/staff-admins` — owner secret header,
   `OWNER_ADMIN_API_ENABLED=true`, timing-safe secret, rate limit, assign/re-enable
   `staff_admin` only, idempotent, atomic grant+audit, reason
   `owner_staff_admin_provision`.
2. Authenticated staff-admin HTTPS role-grant commands for approved non-customer
   roles via `RoleManagementService` — **no customer-role workflow**.
3. Reuse existing persistence; **no new Prisma models** for the simplified MVP.
4. Migration hygiene for obsolete superseded bootstrap tables on disposable test DBs
   only (restore corrupted SQL + forward drop migration).

## Removed from scope (superseded design)

Ed25519 envelopes, CLI bootstrap, closure/authorization-use tables, fingerprints,
six-class bootstrap evidence, permanent closure semantics, and customer-role
provisioning eligibility inside role management.

## Phase transition

- R1-P03 remains Complete.
- R1-P03A is Complete.
- R1-P04 is not active; planning resume requires separate explicit human-owner
  activation (prerequisite Complete gate now satisfied).
- No phase is currently In Progress.

## Locked boundaries

- Authentication owns provisioning and transactions.
- Admin owns audit-record lifecycle through the existing writer.
- No automatic grants. No UI. Placeholder secrets only in documentation.
- R1-P04 does not require customer-role grants from this phase (DEC-030).

## Explicitly unauthorized by this Complete approval

- Git commit/push/merge without the exact owner Git authorization phrase.
- Applying migrations to production `Cleanora` DB.
- Real owner secret selection or live staff_admin provisioning.
- Automatic activation or implementation of R1-P04.

## Current gate

None for R1-P03A. Next authorized action is separate human-owner direction to
resume R1-P04 planning (or another owner-authorized phase), plus optional Git
workflow if the owner later says exactly `commit and push`.
