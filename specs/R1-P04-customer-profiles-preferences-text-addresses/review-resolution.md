# Review Resolution — R1-P04 Customer Profiles, Preferences & Text Addresses

## Resolution summary

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| BLOCKER — Customer `SELF` authorization conflicts with privacy-processor authorization | `accepted` | Split FR-028 by actor and operation family. Customer self-service keeps explicit permission, `SELF`, active-identity, and verified-category rules. Processor claim/resolution now requires trusted processor identity and capability without customer `SELF` or customer eligibility. Privileged reassignment now requires an authenticated privileged actor, dedicated R1-P03 permission, and approved reason without customer `SELF` or customer eligibility. All policies preserve the customer as request owner. FR-029, FR-030, FR-040, acceptance scenarios, authorization summaries, SC-002, SC-016, and SC-017 were aligned. | Structural scan finds no remaining universal `SELF` rule. FR-001–FR-048 remain unique and contiguous. |
| MAJOR — SC-008 workload is measurable but not repeatable | `accepted/resolved` | The accepted owner decision replaces customer identities as the concurrency unit with exactly 25 automated execution lanes. Each lane executes exactly 40 interactions during the 10-minute window from one canonical 1,000-row scenario manifest that fixes caller context, target ownership, operation, expected outcome, lane, and measurement slot while prepared state remains unchanged. | `spec.md` marks MAJOR-02 resolved; 25 × 40 = exactly 1,000, the manifest covers the approved caller contexts, and all leaf counts, exclusions, and the 95%-within-two-seconds target remain intact. |
| MINOR — SC-005 measurement population is undefined | `accepted/resolved` | The accepted owner decision fixes category holdings and one applicable-profile assignment for every participant P01–P20 and requires repeated runs to use the same assignments. | `spec.md` marks MINOR-01 resolved; the fixed journeys total 6 Individual + 7 Company + 7 Engineer = 20 while preserving the 19-of-20 threshold. |
| MAJOR — Checklist readiness assessment is inaccurate | `accepted/resolved` | Revalidated the three reset items against the resolved SC-008 and SC-005 criteria and restored requirements clarity, success-criterion measurability, and measurable-outcome readiness to passing. | Checklist revalidation is 13/16 → 16/16 with no unchecked item. |
| MINOR — Supporting phase summaries lag corrected scope and clarification state | `accepted/resolved` | Updated `activation.md` and `docs/product/current.md` to record both owner decisions as integrated and validated, remove stale clarification-required state, and retain fresh independent re-review as the next gate. | Both summaries state that R1-P04 is ready for fresh independent specification re-review and that planning remains unauthorized pending review passage and separate owner direction. |
| MINOR — Clarification history says “at least 1,000” while SC-008 says exactly 1,000 | `accepted` | Replaced the stale historical wording with “exactly 1,000” to match the later owner-approved normative criterion. | Search finds no remaining “at least 1,000” workload statement. |
| MINOR — Operational `TBD` values remain in the current phase pointer | `accepted` | Replaced branch placeholders with “Not created — specification only” and owner placeholders with “Not assigned — specification only,” without inventing assignments. | The active phase table contains no `TBD` value. |

## Files changed

- `specs/R1-P04-customer-profiles-preferences-text-addresses/spec.md`
- `specs/R1-P04-customer-profiles-preferences-text-addresses/checklists/requirements.md`
- `specs/R1-P04-customer-profiles-preferences-text-addresses/activation.md`
- `specs/R1-P04-customer-profiles-preferences-text-addresses/review-resolution.md`
- `docs/product/current.md`

## Regression coverage

- Customer self-service authorization is covered by the narrowed User Story 5 scenarios plus SC-002 and SC-017.
- Trusted processor claim/resolution and privileged reassignment authorization are covered by User Story 4 scenarios 10 and 14 plus SC-002 and SC-016.
- FR-029 rejects authority derived from client-supplied roles, permissions, capabilities, processor identifiers, categories, owners, or scope.
- SC-008 fixes every leaf-level count in the 1,000-interaction matrix and now fixes the repeatable 25-lane execution and canonical-manifest model.
- SC-005 fixes every P01–P20 category holding and single applicable-profile assignment, including the 6/7/7 journey distribution.
- These are specification-only fixes, so no runtime regression test was added or executed.

## Remaining risks or decisions

- No specification review finding or owner product decision remains open in R1-P04.
- Owner **DEC-030** removes the customer-role authorization-provisioning blocker;
  R1-P04 pauses for R1-P03A Complete sequencing only.
- R1-P03A (owner MVP) must be implemented and owner-approved before R1-P04 Phase 0.
- Tasks, implementation, schema or migration changes, and production actions remain unauthorized for R1-P04.

## Historical specification-closure checks

- FR-001–FR-048: complete, unique, and contiguous.
- SC-001–SC-019: complete, unique, and contiguous.
- Specification quality checklist: 16/16 passing with no unchecked item.
- SC-008 execution model: exactly 25 lanes × 40 interactions = 1,000, using one canonical 1,000-row manifest.
- SC-005 assignment model: 6 Individual + 7 Company + 7 Engineer journeys = 20 fixed P01–P20 assignments.
- Closure-artifact scan: no owner decision, review finding, or stale clarification-required state remains open.
- `npm.cmd run docs:check`: passed (`ok: true`, 11 documents checked).
- Trailing-whitespace scan: passed for the five R1-P04 closure artifacts.
- `git diff --check`: passed.
- At the time of specification closure, `plan.md` and `tasks.md` were absent. A later planning attempt created only the blocked pre-research gate record in `plan.md`; `tasks.md` remains absent.

---

## DEC-030 authorization alignment (2026-08-07)

**Decision:** Owner DEC-030 supersedes the R1-P03A complex bootstrap design and
removes the R1-P04 **authorization-provisioning blocker** that required customer-role
grants before technical planning could proceed.

| Topic | DEC-030 alignment |
|---|---|
| R1-P04 customer authorization | Trusted `AuthenticationPrincipal` facts + `SELF` + FR-028 category eligibility (no customer role; no `resource.self.*` or other role-derived R1-P04 customer permission) |
| Historical `customer` role grant | Does not affect R1-P04 eligibility |
| R1-P03A scope | Owner staff-admin API + non-customer staff role commands only — no customer-role workflow |
| R1-P04 pause reason | Phase sequencing until R1-P03A Complete — **not** missing customer grants |

> **Supersession note (2026-08-07 repair):** Earlier rows in this file that say
> customer self-service “keeps explicit permission” or “R1-P04 permissions”
> record historical review evidence from before the owner clarified that R1-P04
> customer authorization is principal + SELF + category eligibility only. Those
> historical statements are superseded by the table above and by FR-028 / SC-017
> in `spec.md`. Do not reintroduce role-derived customer permissions for
> Release 1 self-service.

### Files updated

- `spec.md` — status, FR-028, FR-045, authorization expectations, SC-017, product decision section
- `plan.md` — replaced blocked gate narrative with DEC-030 posture
- `activation.md` — pause reason and DEC-030 authorization note
- `checklists/requirements.md` — DEC-030 notes
- `review-resolution.md` — this section

### Validation state

- R1-P04 specification quality remains 16/16; product requirements aligned to DEC-030
- R1-P04 implementation and Phase 0 research remain unauthorized
- R1-P04 resumes planning after R1-P03A owner-approved Complete
- Premature Authentication-module R1-P04 policy helpers were removed from the
  active R1-P03A tree; R1-P04 remains paused