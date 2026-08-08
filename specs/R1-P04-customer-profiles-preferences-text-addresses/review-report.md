# Review Report — R1-P04

## Canonical current implementation verdict

**Review type:** Fresh independent final implementation re-review

**Review date:** 2026-08-08

**Canonical current verdict:** `PASS`

**Finding counts (final):**

| Severity | Count |
|---|---:|
| BLOCKER | 0 |
| MAJOR | 0 |
| MINOR (non-blocking follow-up) | 2 |

Non-blocking MINOR follow-ups (not fixed at Complete):

1. Unused eslint-disable warning in SC-008 workload harness.
2. Acceptance assertion could directly require `maxActiveLanes === 25`.

Human-owner Complete approval recorded on `2026-08-08`:

```text
I approve R1-P04 — Customer Profiles, Preferences & Text Addresses as Complete.
```

Evidence package: unit 117/530; integration 51/143; coverage 168/673
(83.03% / 77.3% / 85.98% / 84.57%); SC-008 25 concurrent lanes (ratio 0.974;
maxActiveLanes 25); live Cloudinary smoke PASS; typecheck/lint/build/docs/
openapi/prisma/`git diff --check` PASS. See `completion-report.md`.

Historical implementation `CHANGES REQUIRED` / `BLOCKED` / later
`CHANGES REQUIRED` verdicts below remain labelled historical evidence and are
not rewritten.

---

# Review Report — R1-P04 Final Technical-Planning Re-review

**Phase:** R1-P04 — Customer Profiles, Preferences & Text Addresses

**Review date:** 2026-08-07

**Review type:** Independent read-only focused final technical-planning re-review

**Canonical planning verdict (historical planning evidence; not superseded by later implementation PASS):** `PASS`

## Scope and evidence

- **Phase folder:** `specs/R1-P04-customer-profiles-preferences-text-addresses/`
- **Product / routing:** `AGENTS.md`, `CLAUDE.md`, `docs/ai/context-router.md`,
  `docs/product/current.md`, `docs/product/decision-log.md` (DEC-030, DEC-031,
  DEC-032)
- **Planning artifacts:** `spec.md`, `plan.md`, `research.md`, `data-model.md`,
  `quickstart.md`, `traceability.md`, `activation.md`, `review-resolution.md`,
  `contracts/*`, `.spec-context.json`
- **Diff:** complete tracked and untracked R1-P04 planning artifacts (docs and
  phase folder only)
- **Focus:** DEC-032 preference PUT full-replacement; CANCELLED lifecycle CHECK
  six invariants; regression against prior ten resolved planning findings

## DEC-032 preference PUT

**Status:** `RESOLVED`

PUT `/customers/preferences` is full replacement only across DEC-032, OpenAPI
`PreferencesUpdate`, behavioral contract, data model, transaction boundaries,
research, quickstart, traceability, and plan:

- Top-level required: `version`, `language`, `reminders`, `promotional`
- `language` accepts exactly `AR`, `EN`, or `null` (`null` = explicit unset)
- `reminders` and `promotional` each require `sms` and `push` booleans
- Omitted fields rejected; no partial merge; no silent defaults
- Additional fields rejected (`additionalProperties: false`)
- Version CAS intact; mandatory notification policy not weakened

## CANCELLED lifecycle CHECK

**Status:** `RESOLVED`

Planned `privacy_requests` CANCELLED CHECK requires all six invariants
(`data-model.md`, transaction-boundaries, quickstart migration case,
traceability planned DB test):

- `cancelled_at` IS NOT NULL
- `terminal_at` IS NOT NULL
- `purge_after` IS NOT NULL
- `outcome_code` IS NULL
- `processor_id` IS NULL
- `processing_at` IS NULL

Customer cancel remains PENDING-only and before any processor claim. No
contract permits PROCESSING → CANCELLED. Application transaction rules and
planned SQL constraints agree.

## Regression findings

None. No new BLOCKER, MAJOR, or MINOR findings.

Prior ten technical-planning findings remain resolved. Repairs did not reopen
customer-role / `resource.self.*` dependencies, alter DEC-030 or DEC-031,
add queues or public processor endpoints, create `tasks.md`, or change
Companion from `currentStep=plan` / `status=planned`.

## Validation

| Check | Result |
|---|---|
| `npm run docs:check` | PASS — `{"ok":true,"checked":11}` |
| `npm run openapi:validate` (published docs) | PASS |
| Targeted P04 planning OpenAPI validate | PASS |
| `npm run prisma:validate` | PASS |
| `git diff --check` | PASS |
| Targeted preference full-replace scan | PASS |
| Targeted CANCELLED six-invariant scan | PASS |
| Companion `plan` / `planned`; `tasks.md` absent | PASS |

Implementation tests, migrations, builds, and state-changing commands were
not run (read-only review boundary).

## Boundary confirmation

The independent re-review was read-only. It did not edit or create files, did
not generate `tasks.md`, did not implement code, did not edit Prisma schema or
create/apply migrations, and did not commit, push, merge, or deploy. This
report records the completed review result after that review concluded.

## Verdict

`PASS`

Both focused findings are RESOLVED, no new unresolved findings remain, no
material product decision is missing, and Phase 0/1 planning artifacts are
ready for tasks generation pending separate human-owner authorization.

## Current handoff status

> **Historical planning handoff (2026-08-07).** Superseded by implementation
> Complete on `2026-08-08`. Preserved as planning evidence only.

- R1-P04 was the sole active phase (planning)
- Phase 0/1 technical planning is complete
- Phase 0/1 technical-planning review verdict: `PASS`
- `tasks.md` generated (T001–T073) under tasks-generation authorization
- Implementation remained unauthorized until separate human-owner authorization
- Companion remained `currentStep=plan` / `status=planned` (`after_tasks`
  capture skipped — `python3` unavailable)

This PASS did **not** start implementation. Tasks generation was separately
authorized; implementation was not.

---

## Historical evidence — Independent Specification Re-Review (2026-08-06)

> **Historical artifact.** The section below records the 2026-08-06 specification
> re-review `PASS`. It is not the current technical-planning review. Later
> handoff prose about R1-P03A planning state and R1-P04 pause is historical;
> R1-P03A is Complete and R1-P04 planning was separately activated on
> 2026-08-07. Preserved as evidence only; not rewritten.

**Review date:** 2026-08-06

**Review type:** Independent read-only specification re-review

**Historical verdict:** `PASS`

### Finding counts

| Severity | Count |
|---|---:|
| BLOCKER | 0 |
| MAJOR | 0 |
| MINOR | 0 |

No review finding or owner product decision remained open at specification
closure.

### Artifacts reviewed

- `spec.md`
- `checklists/requirements.md`
- `review-resolution.md`
- `activation.md`
- `docs/product/current.md`

### Verification evidence

- FR-028 actor-specific authorization is coherent across customer `SELF`
  operations, trusted processor claim/resolution, and privileged reassignment.
  Processor and privileged operations preserve the customer as request owner.
- Privacy-processor claim, resolution, reassignment, concurrency, and terminal
  transitions are coherent.
- SC-008 uses exactly 25 automated execution lanes with exactly 40 interactions
  per lane, totaling exactly 1,000 interactions. One canonical 1,000-row
  manifest fixes caller context, target ownership, operation, expected outcome,
  execution lane, and measurement slot while prepared fixtures remain unchanged
  during measurement.
- SC-005 fixes category holdings and one applicable-profile assignment for
  P01–P20. The journeys total 6 Individual, 7 Company, and 7 Engineer, with one
  profile created per participant and the repeatable 19-of-20 threshold intact.
- FR-001–FR-048 and SC-001–SC-019 are unique and contiguous.
- The specification quality checklist is 16/16.
- `npm.cmd run docs:check` passed with `ok: true` for 11 documents.
- At that time, `plan.md` and `tasks.md` were absent.

### Historical handoff prose (2026-08-06)

R1-P04 specification preparation is complete. That PASS did not itself
authorize planning. After the review concluded, the human owner explicitly
authorized R1-P04 technical planning only. A later planning attempt stopped
before Phase 0 at the authorization-provisioning gate. The owner subsequently
approved pausing R1-P04 and using the then-not-active prerequisite path
`R1-P03A — Production Role Provisioning`. Those sequencing facts are
historical; R1-P03A is now Complete and R1-P04 technical planning has since
completed under separate owner authorization.

---

## Historical evidence — Technical-planning `CHANGES REQUIRED` (pre-repair)

> **Historical artifact.** An independent technical-planning review returned
> `CHANGES REQUIRED` before DEC-031 / DEC-032 / CANCELLED CHECK repairs. That
> verdict and its finding table remain historical evidence in
> `review-resolution.md` (section “Technical-planning review resolution”) and
> are **not rewritten** here. Repairs closed those findings; the fresh current
> verdict above is `PASS`.
