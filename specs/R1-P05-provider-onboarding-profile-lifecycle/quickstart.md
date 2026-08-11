# Quickstart — R1-P05 Provider Onboarding, Profile & Lifecycle

**Purpose**: Implementation and verification handoff only. This document does
not authorize or perform implementation, migration application, Git, deployment,
or production work.

## 1. Read in this order

1. `docs/ai/context-router.md`
2. `docs/product/current.md`
3. this phase's `spec.md`, especially Clarifications and FR-001–FR-086
4. `plan.md`, `research.md`, and `data-model.md`
5. `contracts/provider-api.md`, OpenAPI, module contracts, and transaction boundaries
6. `tasks.md`

Preserve the one-active-phase rule and all unrelated dirty-worktree changes.

## 2. Non-negotiable decisions

- A user owns at most one Provider; before approval they are only its Application
  Owner and have no Provider membership/global role.
- `INDIVIDUAL_TEAM` requires an Individual customer identity/profile;
  `REGISTERED_COMPANY` requires Company signup/profile. Both apply as Provider.
- Approval atomically grants verified `PROVIDER_OWNER`, enables
  `provider_admin`, and creates OWNER membership. Rejection creates none.
- `PROVIDER_OWNER` is removed from public signup/enrollment and exists only as a
  staff-granted category during approval.
- Invited Provider Admin users may have empty customer category arrays, but only
  Authentication's invitation-only flow may create them; authority appears only
  after email verification and atomic invitation acceptance.
- Profile completion is ten equal 10-point checks. Documents are separate
  readiness: not required for Individuals and deferred to R1-P06 for Companies.
- Approved edits preserve `APPROVED`; recompute completion/readiness and keep
  public eligibility false.
- Suspended Providers may manage/remediate. Reinstatement returns `INACTIVE`,
  never `LIVE`.
- Direct contacts are private and never appear in preview/customer DTOs.
- Maximum 12 gallery images and 2 gallery videos. Images are normalized to the
  locked fixed dimensions and each input is <=5 MiB; video is <=40 MiB and
  <=1080p. Only READY media counts.
- Invitation raw tokens are sent once from memory after commit and never enter
  an outbox/log/audit/response. Failure requires OWNER resend and token rotation.

## 3. Implementation sequence

Follow `tasks.md` exactly in dependency order:

1. migration and Authentication/Media public-contract prerequisites;
2. providers module domain, persistence, transaction participants, and ports;
3. application/profile/contact/completion/readiness journeys;
4. media and submission/review/approval;
5. invitations/onboarding/membership;
6. dashboard/settings/preview/history and suspension;
7. runtime OpenAPI, Postman, documentation, compatibility, and final gates.

Write the listed tests before or with their corresponding behavior. Do not use
real SMTP or Cloudinary credentials in automated tests; inject deterministic
fakes. Do not run database-backed suites concurrently: this repository uses one
shared isolated proof database and Vitest is configured for one worker.

## 4. Required test fixtures

- eligible/ineligible Individual and Company users with matching/mismatching or
  incomplete customer profiles;
- public-signup attempts using `PROVIDER_OWNER` (must fail);
- invitation-created user with empty category arrays before acceptance;
- DRAFT, PENDING_REVIEW, CHANGES_REQUESTED, APPROVED, REJECTED, INACTIVE, and
  SUSPENDED Provider states;
- Staff Admin with/without each new permission;
- READY/PROCESSING/FAILED/PENDING_DELETE Provider media and exactly-at-limit
  image/video sets;
- active, expired, revoked, accepted, replaced, mismatched, and delivery-failed
  invitations;
- users with authority in zero, one, and multiple Providers for global role
  reconciliation.

## 5. Minimum acceptance journeys

1. Individual creates draft, completes ten checks, submits, Staff requests
   changes, owner fixes/resubmits, Staff approves, and the full atomic authority
   outcome exists once.
2. Company creates and submits without R1-P06 documents; completion may reach
   100%, while `documentsVerified` stays blocked and public eligibility false.
3. Rejection leaves no Provider membership, role, or Provider Owner category.
4. Approved profile/contact/media edit keeps `APPROVED`, changes version,
   recomputes completion/readiness, and never exposes direct contact in preview.
5. OWNER invites an existing user and a new categoryless user; both verify/match
   and accept atomically, with replay/race protection.
6. Invitation delivery failure exposes only `RESEND_REQUIRED`; resend rotates
   token/version/expiry and the old token cannot succeed.
7. OWNER disables an ADMIN and `provider_admin` remains enabled only when the
   user retains another active Provider authority.
8. Staff suspension preserves management/remediation access; reinstate produces
   `INACTIVE` and never `LIVE`.

## 6. Concurrency proof

Use barriers/latches and deterministic fakes—never sleeps—to race duplicate
application creation, submit, approval, invitation accept/resend/revoke, gallery
limit writes, slot replacement, and member-role reconciliation. Assert final row
cardinality, history/audit/outbox effects, versions, and authority—not merely HTTP
status counts. Run each focused concurrency suite three consecutive times.

## 7. Validation commands

Run sequentially from the repository root after all implementation tasks finish:

```powershell
npm run prisma:validate
npm run prisma:generate
npm run db:validate-clean-migration
npm run test:unit
npm run test:integration
npm run test:coverage
npm run typecheck
npm run lint
npm run build
npm run docs:check
npm run openapi:validate
npm run postman:validate
git diff --check
```

There is no `test:e2e` script. End-to-end API journeys belong in the existing
Supertest integration suites. Migration validation must cover the complete
migration chronology, isolated clean apply, idempotent double seed, constraint
probes, and R1-P01 through R1-P04A compatibility.

## 8. Completion evidence

Do not mark the phase complete until every task is checked, each command above
passes, the 1024 completion combinations and 11 readiness gates are covered,
OpenAPI/runtime/Postman stay synchronized, privacy-negative tests pass, and an
independent review finds no blocker/major issue. Commit, push, merge, deployment,
and production migration remain separate human-authorized actions.
