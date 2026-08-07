# Review Resolution — R1-P03A Production Role Provisioning

## Final independent verdict — repair-loop iteration 2

`PASS` — zero BLOCKER, zero MAJOR, and zero MINOR findings. The separate
read-only reviewer modified no files. The persisted evidence is in
`review-report.md`.

R1-P03A specification preparation and independent specification review are
complete. The human owner subsequently authorized technical planning only on
2026-08-06 through Phase 0 research and Phase 1 design.

## Pre-loop repair resolution — six-class and phase-state findings

These findings are recorded separately from the earlier review iterations in
the continuing resolution history below.

| Finding | Decision | Evidence/fix | Validation state |
|---|---|---|---|
| MAJOR — FR-019/SC-010 omitted `AUDIT_FAILED` and `STALE_TARGET_OR_REVALIDATION_FAILED` and did not require a nonzero denominator for every class | `accepted` | Added the exact six-class matrix, at least six distinct observed attempts, one separately classified minimum per class, no multi-class reuse, no zero denominator, row-level evidence/state/redaction rules, audit-failure evidence independence, and aligned scenarios 2–5, 7, 9, 10, FR-017–FR-019, Audit Evidence, and SC-003/SC-005/SC-010/SC-015/SC-016. | Machine-checkable placement, semantic, six-row, nonzero-denominator, FR/SC sequence, docs, whitespace, and diff validation passed before independent re-review |
| MINOR — stale current-phase statements remained in R1-P00/R1-P03 artifacts and R1-P04 activation/Companion context | `accepted` | Marked R1-P00 active-pointer language as historical, converted R1-P03 activation to a Complete historical record, aligned R1-P04 activation with the sole active R1-P03A prerequisite, and used the sanctioned Companion writer to record R1-P04 `specify`/`specified`. | Repository-wide current-state scan passed; R1-P04 context is `specify`/`specified`, and `.specify/feature.json` targets R1-P03A |

## Independent repair-loop review — iteration 1

| Finding | Decision | Evidence/fix | Validation state |
|---|---|---|---|
| MINOR — completed R1-P00 and R1-P03 review/closure artifacts retained unqualified point-in-time `In Progress` or no-later-phase-active statements | `accepted` | Added concise historical phase-state notes to the affected R1-P00 review report/resolution and R1-P03 review report/resolution/completion report. The underlying point-in-time evidence remains unchanged. | PASS — required historical banners present; no unqualified current-status header in R1-P00, R1-P03, or R1-P04 |
| MINOR — an earlier review iteration's one-MAJOR/two-MINOR count was labeled as the latest | `accepted` | Relabeled the statement as an earlier independent re-review and retained the historical count without conflating it with the current repair iteration. | PASS — stale latest-count phrase absent; current iteration is recorded separately |

No `PASS` is claimed by this repair entry.

## Resolution summary

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| BLOCKER — OQ-015 through OQ-017 remained open after their owner decisions were accepted | `accepted` | DEC-029 records the accepted closure/recovery, public HTTPS API, and customer-eligibility decisions without broadening them. OQ-015 through OQ-017 were removed from `docs/product/open-questions.md`. | PASS — canonical decision/open-question scans and final independent re-review confirmed closure |
| MAJOR — first-`staff_admin` target eligibility was undefined | `accepted` | The owner selected Option A. The selected target must be an existing `ACTIVE`, non-verification-only identity with verified email and at least one server-confirmed verified enrolled category; no category type grants staff authority. Authentication revalidates every fact inside the bootstrap transaction immediately before grant, permanent closure, and audit. The answer is integrated across clarification, scenarios, edge cases, FR-005/FR-013/FR-016, entities, SC-001/SC-015/SC-016, and DEC-029; OQ-018 is removed. | Bootstrap target matrix, transaction-race coverage, canonical decision scan, and checklist revalidation |
| MAJOR — customer assign/enable eligibility was not transactionally revalidated | `accepted` | FR-002, FR-022, FR-028, and FR-030 now require the narrow Authentication-owned `RoleManagementService` extension to load and revalidate customer eligibility inside its existing unit of work. API/controller pre-checks are non-authoritative; failed transaction-time eligibility produces no grant mutation or grant-mutation audit. Disable/revoke retains the approved exception, and non-customer transitions remain unchanged. | Requirement, acceptance-scenario, edge-case, entity, and boundary consistency scan |
| MAJOR — success criteria did not measure the customer eligibility matrix | `accepted` | SC-013 covers every supported verified category, multi-category targets, required denial states, and ineligible-target disable/revoke. SC-014 covers racing eligibility changes and the no-mutation/no-grant-audit outcome. | FR/SC identifier and acceptance-coverage scan |
| MINOR — current phase, activation, and checklist notes were stale | `accepted` | `docs/product/current.md`, `activation.md`, and checklist Notes record all accepted decisions, no open R1-P03A owner decision, substantive 16/16 checklist status, final independent `PASS`, and the human-owner technical-planning gate. | PASS — cross-document status scan and final independent re-review |
| MINOR — strict trailing whitespace existed in `decision-log.md` | `accepted` | Trailing-space hard breaks were removed; separate paragraphs preserve the source-traceability statements. | Strict relevant-document scan passed with zero findings |
| MAJOR — FR-019 acceptance coverage was vacuous | `accepted` | Bootstrap scenarios 2–5, 7, 9, and 10 now require traceable safe denial or operational evidence for unsuccessful denied, duplicate, conflicting, audit-failed, permanently-closed, invalid-target, and stale-target outcomes. SC-010 measures evidence existence for 100% of the FR-019 attempt classes, distinguishes unsuccessful-attempt evidence from the successful-bootstrap audit record, and retains the complete redaction rule without choosing logging technology or persistence design. | FR-019/FR-017/FR-018 and SC-003/SC-005/SC-010/SC-015/SC-016 consistency scan; identifier validation |
| MINOR — contradictory current-phase language remained | `accepted` | Static roadmap metadata now delegates to `docs/product/current.md`; the completed R1-P03 statement is explicitly historical; and the R1-P04 plan describes its 48-FR/19-SC scope as paused, with R1-P03A currently the sole active phase. | Cross-document current-state scan confirms R1-P03A active, R1-P03 Complete, and R1-P04 paused before Phase 0 |
| MINOR — R1-P04 provisioning-gate citation was stale | `accepted` | The R1-P04 plan now cites spec lines 924–927, the full normative stop condition, instead of lines 921–924. | Citation text and target-line inspection |

Allowed decisions: `accepted`, `rejected-with-evidence`, `already-resolved`, `owner-decision-required`.

## Files changed

- `docs/product/decision-log.md`
- `docs/product/open-questions.md`
- `docs/product/current.md`
- `docs/product/roadmap.md`
- `specs/R1-P03-roles-permissions-privileged-audit/spec.md`
- `specs/R1-P03-roles-permissions-privileged-audit/activation.md`
- `specs/R1-P00-product-database-architecture/spec.md`
- `specs/R1-P00-product-database-architecture/quickstart.md`
- `specs/R1-P00-product-database-architecture/review-report.md`
- `specs/R1-P00-product-database-architecture/review-resolution.md`
- `specs/R1-P03-roles-permissions-privileged-audit/review-report.md`
- `specs/R1-P03-roles-permissions-privileged-audit/review-resolution.md`
- `specs/R1-P03-roles-permissions-privileged-audit/completion-report.md`
- `specs/R1-P03A-production-role-provisioning/spec.md`
- `specs/R1-P03A-production-role-provisioning/activation.md`
- `specs/R1-P03A-production-role-provisioning/checklists/requirements.md`
- `specs/R1-P03A-production-role-provisioning/review-resolution.md`
- `specs/R1-P03A-production-role-provisioning/review-report.md`
- `specs/R1-P04-customer-profiles-preferences-text-addresses/plan.md`
- `specs/R1-P04-customer-profiles-preferences-text-addresses/activation.md`
- `specs/R1-P04-customer-profiles-preferences-text-addresses/.spec-context.json`

## Regression coverage

This repair is specification and documentation only; implementation and test
changes are unauthorized. The normative regression coverage added to the
specification requires:

- the complete customer eligibility matrix across supported single and multiple
  verified categories and every denied account/category state;
- authorized disable/revoke for existing grants whose targets are currently
  ineligible;
- transaction-time assign/enable eligibility races; and
- no grant mutation or grant-mutation audit when transaction-time eligibility
  fails;
- a complete, nonempty FR-019 matrix with at least six distinct observed
  attempts and at least one separately classified `DENIED`, `DUPLICATE`,
  `CONFLICTING_OR_CONCURRENT_LOSER`, `AUDIT_FAILED`,
  `STALE_TARGET_OR_REVALIDATION_FAILED`, and `PERMANENTLY_CLOSED` attempt, with
  no attempt satisfying multiple required minima and no zero denominator;
- distinct safe evidence, no successful-bootstrap audit record, no grant or
  closure mutation, and zero sensitive disclosure for every unsuccessful row;
- `AUDIT_FAILED` operational evidence independent of the failed successful-
  bootstrap audit write and separately classified stale-target evidence; and
- no successful-bootstrap audit record or grant/closure mutation for an
  unsuccessful bootstrap attempt.

## Remaining risks or decisions

- No accepted review finding or R1-P03A owner product decision remains open.
- Final independent read-only specification re-review returned `PASS` with zero
  BLOCKER, MAJOR, and MINOR findings; the reviewer modified no files.
- Technical planning only is authorized through Phase 0 research and Phase 1
  design. Those planning phases are complete, with independent read-only
  technical-planning review as the next gate. Task generation and implementation
  remain unauthorized.

## Final checks

- The latest MAJOR and MINOR repairs passed the required pre-review validation.
  The exact six classes appear in FR-019, the acceptance matrix/scenarios, and
  SC-010; SC-005 names `AUDIT_FAILED`; SC-016 names
  `STALE_TARGET_OR_REVALIDATION_FAILED`; the matrix has exactly six required
  rows, at least six distinct attempts, at least one row per class, no
  multi-class minimum reuse, and no zero denominator.
- Current-state validation reports R1-P03A as sole active, R1-P03 and R1-P00 as
  Complete historical phases, and R1-P04 as paused before Phase 0. The
  sanctioned Companion writer records R1-P04 as `specify`/`specified`, while
  `.specify/feature.json` continues to target R1-P03A.
- The requirements checklist is substantively 16/16 after validation. Final
  independent review iteration 2 returned `PASS` with zero findings.

- Direct accepted findings were repaired within documentation/specification
  scope only.
- An earlier independent re-review's one MAJOR and two MINOR findings were
  independently verified, classified `accepted`, and repaired without changing
  DEC-029 or reopening OQ-015 through OQ-018.
- One clarification question was asked and answered. Option A was integrated
  immediately, and the checklist was substantively revalidated from 10/16 to
  16/16.
- FR-001 through FR-039 and SC-001 through SC-016 are unique and contiguous.
- FR-019 has explicit non-vacuous acceptance coverage in the bootstrap
  scenarios and measurable evidence-existence and redaction coverage in SC-010.
- Current-state scans identify R1-P03A as the sole active phase, R1-P03 as
  Complete, and R1-P04 as paused before Phase 0.
- No `[NEEDS CLARIFICATION]` marker or unresolved R1-P03A open question remains.
- `npm.cmd run docs:check` passed for 11 documents.
- The strict changed-document trailing-whitespace scan and `git diff --check`
  passed.
- R1-P03A `plan.md` and `tasks.md` remain absent, and the changed-path scan found
  no source, Prisma, migration, or seed path.
- This repair changed only the listed Markdown documents. Pre-existing
  repository changes outside those documents were left untouched.
- Technical planning, tasks, implementation, source or Prisma/schema changes,
  migrations, seeds, bootstrap execution, configuration changes, Git write
  actions, deployment, and production actions remain unauthorized and were not
  performed. R1-P03A `review-report.md` was created only after the independent
  reviewer returned `PASS` with zero findings.

---

## Owner MVP simplification — DEC-030 (2026-08-07)

**Decision:** Owner **DEC-030** supersedes the complex R1-P03A bootstrap and
customer-role provisioning design documented above. Prior PASS reviews and repair
iterations in this file are **historical evidence for the superseded design only**
and do not authorize implementing Ed25519 CLI bootstrap, closure tables,
authorization-use tracking, six-class bootstrap evidence, permanent closure
semantics, or customer-role eligibility inside role management.

### Simplified normative scope

| Area | DEC-030 MVP |
|---|---|
| First/additional `staff_admin` | `POST /api/v1/internal/owner/staff-admins` with `OWNER_ADMIN_API_ENABLED`, timing-safe owner secret, rate limit, atomic grant+audit, reason `owner_staff_admin_provision` |
| Ordinary role management | Authenticated staff-admin HTTPS commands; **non-customer** roles only via `RoleManagementService` |
| Schema | No new Prisma models for simplified MVP |
| R1-P04 | Does not require customer-role grants; R1-P04 uses AuthenticationPrincipal + SELF + category eligibility (no role-derived R1-P04 customer permission) |

### Removed from specification

- Ed25519 envelopes and CLI bootstrap adapter
- `StaffAdminBootstrapClosure`, `StaffAdminBootstrapAuthorizationUse`, fingerprints/CAS
- Six-class unsuccessful bootstrap evidence matrix
- Permanent bootstrap closure and customer assign/enable eligibility rules (FR-029–FR-034 superseded)

### Migration hygiene recorded

- Folder `prisma/migrations/r1_p03a_production_role_provisioning` applied on disposable DBs `cleanora_r1_p02_ci_02` and `cleanora_r1_p03_clean_proof`
- Working-tree `migration.sql` corruption (emptied) — restore original SQL, then forward drop migration for obsolete tables
- Do not casually alter checksum meaning; do not touch production `Cleanora` DB

### Artifacts rewritten

- `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `traceability.md`, `tasks.md`, `activation.md`, `implementation-summary.md`, `checklists/requirements.md`, `contracts/` (owner-staff-admins contract replaces bootstrap contract)

### Validation state

- Implementation and sequential validation are complete. The focused post-repair
  independent re-review is **PASS** (canonical verdict:
  `implementation-review-report.md`). Earlier pre-repair and specification
  review **PASS** statements remain historical evidence only.
- Prior iteration-2 specification `PASS` does not apply to superseded
  signed-envelope requirements removed by DEC-030.
- **T029 closed:** human owner approved R1-P03A as Complete on `2026-08-07`
  (`completion-report.md`). Companion status is `completed`.
- R1-P04 remains not active; planning resume requires separate explicit
  human-owner activation.
