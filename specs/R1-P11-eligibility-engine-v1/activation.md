# R1-P11 Activation — Eligibility Engine V1

Date: 2026-09-09
Status: Active — sole active phase; preparation through completion authorized.
Authority: Owner phase-specific override for R1-P11 only (this activation), plus
DEC-062 (recorded in the decision log).

## Owner authorization (phase-specific override)

The human owner explicitly authorized, for R1-P11 only:

- Creation of local feature branch `codex/r1-p11-eligibility-engine-v1`.
- Phase activation, specification, clarification, planning, implementation,
  testing, review, repair, and completion.
- Codex as project manager, product decision-maker, architecture authority,
  reviewer, and completion approver under delegated owner authority.
- Cursor as implementer for tasks assigned or approved by Codex.
- Codex to choose its reasoned recommended option for every in-scope product or
  technical decision without asking the human.
- Automatic progression through phase gates once their actual requirements pass.
- Codex to approve and record phase completion once all required evidence passes.

Existing locked product constraints remain binding (no wallets, no Docker/cloud
until Release 3, modular monolith boundaries, one active phase). This authorization
does **not** authorize staging, commits, pushes, merges, deployments, production
migrations, destructive operations on existing user data, or activation of P12.
The exact-message `commit and push` rule remains in force and authorizes only
validation, staging of intended files, one conventional commit, and a safe
feature-branch push when the human sends that exact message. It does **not**
authorize merge, deployment, production migration, force-push, or history rewriting.

## Readiness

R1-P10 is Complete under DEC-061. Local checkout
`codex/r1-p10-availability-capacity-textual-coverage` at `38f3efa` contains the
completed P10 implementation plus preserved inherited dirty-tree work from
earlier phases. Feature branch `codex/r1-p11-eligibility-engine-v1` was created
from that verified baseline without discarding or stashing work.

Canonical vision, decisions, open questions, and roadmap are repository-local.
No current canonical open question blocks activation of this roadmap section.

### Codex PM-01 readiness confirmation

Codex project-management review (thread
`01a0860b-6c46-7c61-bab3-478a2a8c5efc`) confirmed activation **READY** for
Cursor to prepare specification and implementation plan artifacts. That verdict
is **not** implementation-readiness or phase-completion approval. Durable record:
`pm-preparation-report.md`. Delegated decisions DEC-063–DEC-078 were issued under
DEC-062 and recorded in `docs/product/decision-log.md`.

## Approved roadmap scope

Reusable eligibility domain for standard Browse and future Recommended.

Inputs: Service; Provider service price; Provider verified/live status; Textual
coverage; Date/time; Provider schedule; Worker/team capacity; Crew preference;
Worker genders; Escort/non-cleaner rule; Configured performance gate when data
exists.

Outputs: Eligible provider/team candidates; Machine-readable exclusion reasons;
Deterministic result metadata; Sorting inputs for standard Browse.

Tables: primarily reads earlier tables; `eligibility_rule_versions`;
`eligibility_evaluations`; `eligibility_candidate_results`.

Browse-integration criterion: define and test the smallest honest P11
integration contract so Browse can use this engine later without duplicating
filters; do not implement full P12 Browse marketplace.
**DoD interpretation (DEC-072):** P11 supplies and proves the Browse-use
application contract; P12 mounts the marketplace consumer.

## Execution boundary

R1-P11 is the sole active phase in `docs/product/current.md`. Out of scope:
stored-value wallets; Docker/cloud; Release 3 geographic behavior; full Browse
HTTP marketplace (P12); Booking; payment; unrelated future phases.

## Role assignment

| Role | Actor |
|---|---|
| Project manager / product decisions / architecture / review / completion | Codex (delegated owner authority) |
| Implementation, tests, repository edits | Cursor |
| Staging / commit / push | Human only via exact message `commit and push` (does **not** include merge or deploy) |
| Merge / deploy / production migration | Human only via separate explicit authorization — **not** implied by `commit and push` or by DEC-062 |

## Baseline

- Starting revision: `38f3efa080a4ffd71f24fd83b2ab800662558b30`
- Source branch: `codex/r1-p10-availability-capacity-textual-coverage`
- Feature branch: `codex/r1-p11-eligibility-engine-v1`
- Baseline snapshot: `C:\Users\hossa\AppData\Local\Temp\cleanora-r1-p11-20260909-145603\`
  (`baseline-status.txt`, `baseline.patch`, `baseline-head.txt`,
  `baseline-branch.txt`, `baseline-untracked.txt`)
- Inherited tracked modifications and untracked files are preserved.
- See `baseline-boundary.md` for write allowlists and pre-write hash procedure.

## Next

Preparation artifacts written under this feature directory. Next gate: Codex
preparation review, then implementation Batch A per `implementation-prompt.md`.
