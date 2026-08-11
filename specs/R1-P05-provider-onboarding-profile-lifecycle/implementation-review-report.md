# R1-P05 Implementation Review Report

**Status:** **PASS** — all verified blocker/major findings resolved  
**Reviewed:** 2026-08-11  
**Scope:** Active R1-P05 specification, plan, tasks, contracts, complete tracked and untracked implementation diff, migration, OpenAPI, Postman, composition, and tests.  
**Independence:** Three fresh read-only Codex review agents inspected the phase independently. Cursor Claude was not available in this environment; this limitation must remain visible in final evidence.

## Review intake

- [x] Repository authority, active spec, plan, tasks, and contracts loaded
- [x] Complete Git diff and untracked R1-P05 surface reviewed
- [x] Module-boundary, security, transaction, persistence, API, and test rules applied
- [x] No review agent changed, formatted, staged, or committed files

## Verdict

`PASS`

All verified blocker/major findings were resolved. Two final read-only reviewers
independently returned PASS on the stable remediation tree. Completion evidence
was reconciled without repeating the long suites, per the human owner's explicit
direction; the final delta passed focused regression, typecheck, lint, and build.

## Findings

| ID | Severity | Finding | Primary evidence | Resolution state at intake |
|---|---|---|---|---|
| R1P05-REV-001 | BLOCKER | Production Provider gallery-video upload/finalization is explicitly stubbed and always fails. | `src/modules/media/infrastructure/provider-media.adapter.ts:47-49,153-208`; FR-044/046/047; T052/T056/T059/T060 | Accepted; pending fix |
| R1P05-REV-002 | MAJOR | Accepted active Provider ADMINs cannot discover Providers through `GET /providers` or read `GET /providers/{providerId}`. | `src/modules/providers/provider-application.service.ts:205-240`; FR-049/050/052 | Accepted; pending fix |
| R1P05-REV-003 | MAJOR | Provider media authorization derives Authentication authority from membership and allows disabled-member reads. | `src/modules/providers/provider-media.service.ts:698-739,777-794`; FR-052; SC-010 | Accepted; pending fix |
| R1P05-REV-004 | MAJOR | Completion/readiness uses the viewing actor or fabricated constants, producing contradictory projections. | `provider-projection.service.ts:146-160,361-435`; approval/review/lifecycle/profile/media aggregate builders | Accepted; pending shared authoritative projection fix |
| R1P05-REV-005 | MAJOR | Create, submit, and approval decisions are based on non-transactional preflight facts and omit required transaction-time rechecks. | `provider-application.service.ts:112-168,356-406`; `provider-approval.service.ts:71-204`; transaction contract | Accepted; pending fix |
| R1P05-REV-006 | MAJOR | Provider media persistence/status ownership is bypassed, and media work can occur before Provider scope/version authorization. | `src/composition.ts:192-220`; `provider-media.service.ts:296-332,482-501,742-748`; module/transaction contracts | Accepted; pending fix |
| R1P05-REV-007 | MAJOR | Two new R1-P05 compatibility tests remain `it.todo`; T009/T156 evidence calls them pre-existing. T148 also overclaims a single SC-001–015 journey. | `provider-onboarding-compatibility.test.ts:42-48`; `r1-p05-acceptance.test.ts:161-177`; tasks/completion report | Accepted; pending tests/evidence correction |
| R1P05-REV-008 | MAJOR | Raw invitation bearer secret is embedded in a URL, violating the body-only rule and creating log/history exposure. | `provider-invitation-email.adapter.ts:40-45`; FR-086; `contracts/provider-api.md` | Accepted; pending fix |
| R1P05-REV-009 | MAJOR | Concurrent removal of a user's final memberships on two Providers can leave global `provider_admin` enabled. | `provider-membership.service.ts:135-155`; repository count and authority reconciliation | Accepted; pending per-user serialization and barrier regression |
| R1P05-REV-010 | MAJOR | Providers imports Authentication/Admin internals instead of named public contracts; the architecture test is too permissive. | approval/review/lifecycle imports; `providers.ports.ts`; `prisma-providers.unit-of-work.ts`; boundary rules | Accepted; pending public-seam and architecture-test fix |
| R1P05-REV-011 | MAJOR | Durable review email intents are inserted but the bounded dispatcher is never constructed or run in production composition. | `provider-email-dispatcher.ts:83-148`; `composition.ts:500-636`; FR-077 | Accepted; pending runtime lifecycle wiring/test |
| R1P05-REV-012 | MAJOR | Clean-migration validator omits three migration folders and does not prove double-seed or live constraint probes despite the report claim. | `scripts/validate-clean-migration.ts:11-21,522-570`; T008/T155 | Accepted; pending validator/proof fix |
| R1P05-REV-013 | MAJOR | Postman validator counts 41 requests but unconditionally reports parity; `{memberUserId}` drifts from canonical `{userId}`. | `scripts/validate-postman.ts:161-199`; `generate-r1-p05-postman.ts:282`; T002/T157 | Accepted; pending exact operation-set validation |

## Checks run by reviewers

- `npm run typecheck` — passed by one independent reviewer.
- `npm run openapi:validate` — passed; 35 paths / 41 operations.
- `npm.cmd run postman:validate` — command passed, but R1P05-REV-013 invalidates its parity claim.
- Focused media/boundary/compatibility run — 10 passed, 2 todo; confirms R1P05-REV-007.
- `git diff --check` — passed with line-ending warnings only.

## Resolution log

Resolution decisions, patches, and regression evidence are recorded in
`review-resolution.md`. The final code-only re-reviews verified:

- separate authoritative account activity from FULL session capability, so a
  valid restricted invitation-onboarding principal can accept while suspended
  accounts remain denied;
- audited, existence-safe Provider media denials for missing/cross-scope reads,
  mutation preflight, and transaction-time failures after rollback;
- corrected Provider projections, membership visibility, transaction-time
  authority rechecks, Media/Configuration public seams, production video flow,
  dispatcher wiring, migration proof validation, API envelopes, authoritative
  media metadata, and exact OpenAPI/Postman parity.

No deployment, production migration, Git publication, or next-phase activation
was part of this review.
