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
- Historical (pre-2026-08-07): R1-P04 Phase 0 remained unauthorized until
  R1-P03A Complete
- Current: R1-P03A is Complete; R1-P04 technical planning is active under
  separate owner authorization; tasks and implementation remain unauthorized
- Premature Authentication-module R1-P04 policy helpers were removed from the
  R1-P03A tree during that phase; customer SELF policy belongs to R1-P04
  planning/implementation

---

## Technical-planning review resolution (2026-08-07)

**Historical review verdict:** `CHANGES REQUIRED` (independent technical-planning
review). That verdict remains historical evidence and is not rewritten.

**Owner decisions:** **DEC-031** (privileged reassignment authority, closed
outcome catalog, retention env + sweep).

**Current status after repair:** Phase 0/1 repairs complete; fresh independent
final technical-planning re-review **`PASS`** recorded in `review-report.md`;
`tasks.md` generated (T001–T073); Companion remains `plan` / `planned`
(`after_tasks` capture skipped). Implementation remains unauthorized.

| Finding | Decision | Evidence/Fix | Validation |
|---|---|---|---|
| BLOCKER — Privileged reassignment role mapping deferred | `accepted` | DEC-031: `staff_admin` only receives `privacy.requests.reassign`; operation `customers.privacy.requests.reassign`; reason `privacy_request_reassign`; `PRIVACY_REQUEST_REASSIGN`; deny-by-default. Documented in data-model, privileged-reassign contract, research, plan. | Scan: no “implementation detail” role map; staff_admin-only mapping present |
| MAJOR — Retention readiness/purge ambiguous | `accepted` | Env `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` only; readiness probe; read exclusion; bounded startup+hourly customers sweep; no AppConfig key/queues. | Scan: no AppConfig retention key; no “purge job or on-read” |
| MAJOR — FK ownership / delete actions ambiguous | `accepted` | Schema-ready FK table with Restrict/SetNull, opposite Prisma fields, partial unique SQL, lifecycle CHECKs; `processor_id` no FK. | data-model relation table explicit |
| MAJOR — Processor capability / outcome codes undefined | `accepted` | Capability `privacy.requests.process`; outcomes `REQUEST_FULFILLED`/`REQUEST_REJECTED` with closed legality. | processor contract + DEC-031 |
| MAJOR — Media safety / protected delivery underspecified | `accepted` | `MEDIA_STORAGE_ROOT`; opaque keys; path containment; binary GET/absence; no URL/key leakage; CAS + orphan cleanup. | media + OpenAPI + customer-self-service |
| MAJOR — Audit rollback incomplete | `accepted` | General transactional writer for ordinary FR-033; privileged writer for reassign; audit failure rolls back; denial may use non-TX writer. | transaction-boundaries.md |
| MAJOR — Quickstart missing high-risk cases | `accepted` | Expanded quickstart matrices for media, audit rollback, retention, capability, outcomes, FK/constraints. | quickstart.md |
| MINOR — Unused preference enums | `accepted` | Removed `NotificationChannel` / `OptionalNotificationCategory`; keep boolean columns. | data-model enums list |
| MINOR — countryCode vs country_id mapping | `accepted` | API `countryCode` → Configuration active Country → persist `country_id` only. | contracts + OpenAPI + data-model |
| MINOR — Optimistic concurrency incomplete | `accepted` | version starts at 1; require current; increment on success; stale conflict; image CAS. | data-model + OpenAPI + contracts |

### Files changed (technical-planning repair)

- `docs/product/decision-log.md` (DEC-031)
- `docs/product/current.md`
- R1-P04 `activation.md`, `spec.md` (status/decision prose only), `plan.md`,
  `research.md`, `data-model.md`, `quickstart.md`, `traceability.md`,
  `checklists/requirements.md`, `review-resolution.md`
- `contracts/*` (all)

### Remaining risks or decisions

- None material after DEC-031, DEC-032, and the CANCELLED CHECK tightening.
  Implementation-chosen MIME allowlist, byte cap, and sweep batch size remain
  non-product safety parameters for tasks later.
- DEC-032 preference repair complete; CANCELLED CHECK repair complete.
- Fresh independent final technical-planning re-review verdict: **`PASS`**
  (`review-report.md`). Both focused findings RESOLVED; no new findings.
- Historical technical-planning verdict `CHANGES REQUIRED` remains historical
  evidence only and is not current.
- `tasks.md` generated (T001–T073) under explicit tasks-generation
  authorization; implementation unauthorized until separate human-owner
  authorization.
- Companion remains `currentStep=plan` / `status=planned` (`after_tasks`
  capture skipped — `python3` unavailable).

### DEC-032 preference PUT repair (2026-08-07)

**Owner decision:** DEC-032 — preference PUT is full replacement only.

| Topic | Lock |
|---|---|
| Required body | `version`, `language`, `reminders`, `promotional` |
| `language` | `AR`, `EN`, or `null` (`null` = explicit unset) |
| Booleans | `reminders.sms` / `reminders.push` / `promotional.sms` / `promotional.push` all required |
| Omitted fields | Rejected; no partial merge; no silent defaults |

**Files updated:** `docs/product/decision-log.md` (DEC-032), OpenAPI,
`customer-self-service.md`, `transaction-boundaries.md`, `research.md`,
`data-model.md`, `quickstart.md`, `traceability.md`, `review-resolution.md`,
`docs/product/current.md`.

### CANCELLED lifecycle CHECK repair (2026-08-07)

**Repair:** Tighten planned `privacy_requests` CANCELLED CHECK so cancelled
rows cannot retain processor claim metadata. Remains consistent with customer
cancel only from `PENDING` before any processor claim.

| Field | CANCELLED requirement |
|---|---|
| `cancelled_at` | IS NOT NULL |
| `terminal_at` | IS NOT NULL |
| `purge_after` | IS NOT NULL |
| `outcome_code` | IS NULL |
| `processor_id` | IS NULL |
| `processing_at` | IS NULL |

**Files updated:** `data-model.md`, `contracts/transaction-boundaries.md`,
`contracts/customer-self-service.md`, `quickstart.md`, `traceability.md`,
`review-resolution.md`, `plan.md`, `activation.md`, `docs/product/current.md`.

Historical independent technical-planning verdict `CHANGES REQUIRED` remains
historical evidence and is not rewritten. The subsequent fresh independent
final technical-planning re-review recorded in `review-report.md` returned
**`PASS`** and is the current planning-review verdict.

### Post-tasks `/speckit.analyze` repair (2026-08-07)

**Context:** Fresh post-tasks analyze returned `CHANGES REQUIRED`. That verdict
remains **historical evidence**. Technical-planning review remains `PASS`.
Tasks/planning artifacts were repaired. Final independent `/speckit.analyze`
later returned **`CLEAN`** (see section below). Implementation remains
unauthorized. Companion remains `plan`/`planned` (`python3` after_tasks skip
is non-blocking).

| Finding | Severity | Disposition | Repair |
|---|---|---|---|
| S1 — T023 501 / unfinished mounts | HIGH | accepted | Foundational T024 wires router factory only; each story mounts completed handlers at final HTTP task (T036/T043/T053/T063); no temporary 501 allowance |
| C1 — SC-005 stub | HIGH | accepted | T069 executable P01–P20 cohort asserting ≥19/20 within five minutes; T075 records evidence |
| C2 — SC-008 harness without threshold | HIGH | accepted | T070 manifest validate; T071 workload asserts leaf counts + ≥95% within two seconds and fails if missed; T075 records evidence |
| C3 — missing non-TX denial audit writer | HIGH | accepted | T009/T020/T021 split Admin general TX and safe non-TX denial writers; T023 UoW excludes non-TX denial writer |
| C4/U2 — FR-033 “later reuse” / Ensure | HIGH | accepted | Per-story concrete audit + rollback tasks (US1 T028/T033–T034; US2 T039/T042; US3 T049/T052; US4 T057/T060–T062); privacy-request.service.ts (T062) keeps controllers thin |
| O1 — MVP without US1 audit | HIGH | accepted | US1 MVP includes FR-033/034/035 for profile/image before checkpoint |
| P1 — T001/T002 both [P] | MEDIUM | accepted | Serialized T001 then T002 |
| P2 — US1\|\|US2 shared HTTP | MEDIUM | accepted | Shared routes/controller/schema/OpenAPI always serialized; parallel claim removed |
| U1 — FR-035 missing | MEDIUM | accepted | Per-story FR-035 assertions + cross-story T074 |
| U3 — OpenAPI “or equivalent” | MEDIUM | accepted | Exact path `docs/apis/openapi/r1-p04-customer-self-service.yaml` (T072) |
| C5 — privileged audit rollback | MEDIUM | accepted | T057/T061 privileged audit failure rolls back reassignment; processor unchanged |
| A1 — catalog “as required” | LOW | accepted | T015 names exact files `authorization.catalog.ts` + `authorization.types.ts` |
| D1 — FR-028/FR-029 overlap | LOW | no change | Intentional; non-blocking |

**Files updated:** `tasks.md` (T001–T078), `quickstart.md`, `traceability.md`,
`review-resolution.md`, `plan.md`, `activation.md`, `docs/product/current.md`,
`checklists/requirements.md` (status prose only).

### Analyze-rerun N1/N2 repair (2026-08-07)

**Context:** Fresh independent post-repair `/speckit.analyze` returned
`CHANGES REQUIRED` with material MEDIUM **N1** (T017∥T019 `[P]` overlap) and
LOW **N2** (soft T046 wording). That verdict remains **historical evidence**.
Earlier post-tasks analyze `CHANGES REQUIRED` and technical-planning `PASS`
remain unchanged historical/current authorities respectively. N1/N2 repaired
in `tasks.md` only; IDs remain T001–T078. Final independent `/speckit.analyze`
later returned **`CLEAN`** (see section below). Implementation remains
unauthorized. Companion remains `plan`/`planned` (`python3` after_tasks skip
is non-blocking).

| Finding | Severity | Disposition | Repair |
|---|---|---|---|
| N1 — T017∥T019 `[P]` overlap | MEDIUM | accepted | Removed `[P]` from T019; T019 serialized after T017; Wave 3 parallel set is T014–T018 only; Parallel Opportunities updated |
| N2 — T046 soft “wiring review” | LOW | accepted | T046 is concrete US2 address denial/non-TX audit + FR-035 GET/list assertions in `authorization-matrix-us1-us2.test.ts`; runs after T043 and T044; not `[P]` |

**Files updated:** `tasks.md`, `review-resolution.md` (this section); status
alignment in `plan.md` / `activation.md` / `docs/product/current.md` only as
needed.

### Final `/speckit.analyze` CLEAN (2026-08-07)

**Context:** Final independent strictly read-only `/speckit.analyze` for
`specs/R1-P04-customer-profiles-preferences-text-addresses/` returned
**`CLEAN`**.

| Item | Result |
|---|---|
| Verdict | **CLEAN** |
| N1 | RESOLVED |
| N2 | RESOLVED |
| Earlier material findings (S1, C1–C5, O1, P1–P2, U1–U3, A1) | remain RESOLVED |
| D1 | intentional / non-actionable |
| CRITICAL / HIGH / MEDIUM | 0 / 0 / 0 |
| LOW | 1 editorial-noise item L1 (trailing editor note; removed on evidence recording) |
| FR coverage | 48/48 adequate |
| SC coverage | 19/19 adequate |
| Tasks | T001–T078, all unchecked; ready for implementation |
| Implementation | not started; awaits separate human-owner authorization |
| Companion | remains `plan`/`planned` (`after_tasks` skipped without `python3`; non-blocking; does not authorize implementation) |

Historical technical-planning `CHANGES REQUIRED` and historical post-tasks
analyze `CHANGES REQUIRED` results (including the N1/N2 rerun) remain
historical evidence only. Technical-planning review remains **`PASS`**.
DEC-030, DEC-031, and DEC-032 remain intact. R1-P04 remains the sole active
phase and is **not** Complete.

**Files updated (evidence/status only):** `tasks.md` (status/notes + L1
cleanup), `review-resolution.md` (this section), `plan.md`, `activation.md`,
`docs/product/current.md`, `checklists/requirements.md`, and aligned
status prose in `quickstart.md` / `traceability.md` as needed. No `src/`,
`tests/`, Prisma, migration, Companion, checkbox, or Complete changes.

---

## Independent implementation review resolution (2026-08-07)

**Review verdict:** **`CHANGES REQUIRED`** (fresh independent implementation
review after T001–T078). That verdict is **current evidence** until re-review
PASS. Technical-planning **`PASS`** and final `/speckit.analyze` **`CLEAN`**
remain historical planning authorities and are not rewritten.

**Owner decision:** **DEC-033** — Cloudinary profile-image storage (always
replace). Supersedes local `MEDIA_STORAGE_ROOT` and prior local-filesystem
media directions.

**Repair status:** DEC-033 repair tasks **T079–T093** implemented and validated
on disposable proof DB. Independent implementation **re-review PENDING**. Phase
**not** Complete. No commit/push/merge/deploy/production migration performed.

### Finding dispositions

| Finding | Severity | Disposition | Evidence |
|---|---|---|---|
| SC-005 live journey is no-op placeholder | BLOCKER | accepted → repaired | Real P01–P20 DB journeys; SC-005 PASS |
| SC-008 workload synthetic | BLOCKER | accepted → repaired | Real 1,000-row runner; SC-008 PASS |
| FR-035 harness placeholder | BLOCKER | accepted → repaired | Live self-reads with audit delta zero; PASS |
| Mock tests as integration evidence | MAJOR | accepted → repaired | Mocks moved to unit; DB integration retained |
| Unit gate failures | MAJOR | accepted → repaired | OpenAPI inventory 45; Auth public contracts; no vitest imports; unit PASS |
| Profile-image CAS / OpenAPI mismatch | MAJOR | accepted → repaired | Multipart + `expectedAssociationVersion`; signed URL |
| Missing durable media cleanup | MAJOR | accepted → repaired | `MediaCleanupService` + startup/interval sweep |
| Media byte cap gap | MAJOR | accepted → repaired | Sharp + Multer + `MEDIA_IMAGE_MAX_BYTES=5242880` |
| Denial audit inside UoW | MAJOR | accepted → repaired | Denial before UoW; unit regression |
| OpenAPI `requestId` vs `privacyRequestId` | MAJOR | accepted → repaired | Canonical `privacyRequestId` |
| Profile-image HTTP shape | MAJOR | accepted → repaired | DEC-033 Multer + signed JSON |
| skipIf without DB exercise | MAJOR | accepted → repaired | Schema assert fails closed when gated |
| Configured test DB split | MAJOR | accepted → mitigated | Proof DB used for R1-P04 suites; default CI URL still R1-P02 (documented) |
| Empty `customers.service.ts` | MINOR | accepted → repaired | Removed |
| Stale routes comment | MINOR | accepted → repaired | Updated |
| Local symlink/`realpath` gap | MINOR | **superseded-by-DEC-033** | Local adapter + `MEDIA_STORAGE_ROOT` removed |

### Remaining risks or decisions

- Independent implementation re-review **BLOCKED** (2026-08-07) remains historical
  evidence. Remediations **T094–T100** implemented and validated.
- Latest independent re-review **CHANGES REQUIRED** remains historical evidence.
  Remediations **T101–T109** implemented and validated (2026-08-08). **Next gate:
  fresh independent read-only implementation re-review** (do not claim PASS
  here).
- Live Cloudinary smoke **PASS**
  (`specs/R1-P04-customer-profiles-preferences-text-addresses/cloudinary-smoke-evidence.json`).
- Proof DB for this repair: `cleanora_r1_p04_clean_proof` (old
  `cleanora_r1_p03_clean_proof` historical, unmodified).
- Migration rename:
  `r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`.
- Phase Complete remains unauthorized until fresh independent re-review PASS +
  owner approval.
- No commit/push/merge/deploy/production migration in this repair.

---

## Latest re-review CHANGES REQUIRED repair (2026-08-08)

**Review verdict:** **`CHANGES REQUIRED`** (fresh independent implementation
re-review after T094–T100). That verdict is **historical evidence** and is not
rewritten to PASS. Prior historical verdicts remain:
implementation review **`CHANGES REQUIRED`**; first re-review **`BLOCKED`**.

**Repair status:** Remediations **T101–T109** implemented and validated on
disposable proof DB `cleanora_r1_p04_clean_proof`. Old proof DB
`cleanora_r1_p03_clean_proof` left unmodified. Live Cloudinary smoke **PASS**
(`cloudinary-smoke-evidence.json`). Phase **In Progress** — **not** Complete
(historical wording at that remediation checkpoint; superseded by Complete
2026-08-08).
No commit/push/merge/deploy/production migration performed.

### Finding dispositions

| Finding | Disposition | Evidence/repair |
|---|---|---|
| Existence oracle (cross-customer address/privacy) | accepted → repaired | T101 — equivalent denials; denial audit after TX; OpenAPI + tests |
| Migration order / lexical rename | accepted → repaired | T102 — `r1_p04_customer_profiles_preferences_text_addresses_02_cloudinary_profile_image_storage`; new proof DB; idempotent deploy |
| Test DB fail-closed gate | accepted → repaired | T103 — unsafe configs rejected; `.env.example` + unit tests |
| Isolation flakes (OTP/seed-drift/coverage `.tmp`) | accepted → repaired | T104 — root-cause fixes; honest first post-fix integration/coverage attempt |
| SC-008 media leaf matrix | accepted → repaired | T105 — exact 5 auth / 5 add / 5 replace / 5 remove with fake non-network media |
| Smoke evidence | accepted → repaired | T106 — live smoke PASS; artifact `cloudinary-smoke-evidence.json`; no residue |
| `media.public` infrastructure leak | accepted → repaired | T107 — public facade infrastructure-free; pending-upload factory composition-owned |
| Status drift | accepted → repaired | T108 — status/evidence surfaces aligned; historical verdicts preserved; not Complete |

**Next gate:** fresh independent read-only implementation re-review. Do not claim
Complete, commit, or push.

> **Supersession (2026-08-08):** Historical next-gate wording. Fresh independent
> final implementation re-review returned **`PASS`**; human owner approved
> Complete. See Owner Complete approval section.
---

## Convergence-audit remediations T110–T112 (2026-08-08)

| Finding | Disposition | Evidence/repair |
|---|---|---|
| DEC-033 contract/data-model doc drift (obsolete migration name; `MEDIA_STORAGE_ROOT` delivery wording) | accepted → repaired | T110 — contracts + data-model aligned; `r1-p04-dec033-contract-docs.test.ts` |
| Privileged-reason seed delete-then-create P2002 under full suite | accepted → repaired | T111 — transactional upsert-by-code + bounded P2002/P2034 retry |
| Coverage/integration pool exhaustion from seed competing Prisma/pg pool; OTP 500; coverage `.tmp` ENOENT | accepted → repaired | T112 — shared client reuse; standalone max-1 pool; `clean-coverage.cjs` pre-clean once |

**Validation after T112 (first broad attempt):** unit 113/500 PASS; integration 50/141 PASS; coverage 163/641 PASS (thresholds met). Phase **In Progress** — **not** Complete (historical wording; superseded by Complete 2026-08-08). Next gate remains fresh independent read-only implementation re-review (historical).

---

## Final re-review repair T113–T117 (2026-08-08)

**Historical review verdict:** **`CHANGES REQUIRED`** (fresh independent final
re-review). Not rewritten to PASS.

### Finding dispositions

| Finding | Disposition | Evidence/repair |
|---|---|---|
| MAJOR — Cloudinary smoke evidence hardcoded | accepted → repaired | T114 — `StoredMediaReference` upload metadata + `MediaRemoveResult.destroyResult`; smoke copies adapter returns; live smoke PASS (`cloudinary-smoke-evidence.json` 2026-08-08T09:01:07Z) |
| MAJOR — Missing customers audit-failure rollback integration | accepted → repaired | T115 — `customers-audit-rollback.test.ts` (preferences + privileged reassignment); real Prisma UoW |
| MINOR — Coverage `.tmp` vs whole-directory cleanup wording | accepted → repaired | T116 — `clean-coverage.cjs` repo-root guard; unit test |
| MINOR — DEC-033 normative doc scan too narrow | accepted → repaired | T116 — 8 normative surfaces in `r1-p04-dec033-contract-docs.test.ts` |
| MINOR — Sharp metadata strip not asserted | accepted → repaired | T116 — EXIF/orientation strip test in `sharp-profile-image.processor.test.ts` |
| Incident — `/tmp` env override + `.env` fallback → `Cleanora` migrate | accepted → recorded + prevented | T113 — `r1-p04-database-command.cjs`; `docs/ai/incidents/r1-p04-cleanora-database-incident.md`; no further `Cleanora` writes |

### T117 validation (closed via T118–T120)

Initial T117 attempt blocked on SC-008 sequential harness defect (not DB refresh).
T118 implemented true 25 concurrent lanes; T119 fixed coverage ENOENT root cause
(`clean-coverage` unit test deleted `coverage/` mid-run); T120 completed broad
gates. Attempt log: `.validation-t118/attempt-history.txt`. Timing evidence:
`.validation-t118/sc008-timing.json`.

**Owner decisions outstanding:** `Cleanora` recovery (separate incident). Whether
`Cleanora` is local-dev-only or shared/important remains an owner classification
— this repair did not reconnect to it.

Phase **In Progress** — **not** Complete. Status:
`READY_FOR_ANOTHER_FRESH_INDEPENDENT_FINAL_REVIEW`. No commit/push/merge/deploy/
production migration.

> **Supersession (2026-08-08):** The In Progress / re-review-pending wording
> above is historical. Fresh independent final implementation re-review later
> returned **`PASS`**, and the human owner approved R1-P04 as **Complete**. See
> the Owner Complete approval section at the end of this file.


---

## SC-008 concurrent-lane harness repair T118–T120 (2026-08-08)

| Finding | Disposition | Evidence/repair |
|---|---|---|
| SC-008 serialized 1,000 ops in `for...of` instead of 25 concurrent lanes | accepted → repaired | T118 — `tests/helpers/sc008-lane-executor.ts`; per-lane isolated runtime; start barrier; `Promise.all` of 25 workers |
| Host→Neon cannot open 25 simultaneous TCP connections (ETIMEDOUT/ENETUNREACH) | accepted → mitigated (measured) | Pool sized to measured stable capacity (15) while keeping 25 concurrent JS lane workers; direct URL + IPv4 preference for interactive TX |
| Coverage `.tmp` ENOENT during `test:coverage` | accepted → repaired | T119 — `clean-coverage.test.ts` now uses `resolveCoverageDirectory` only; never deletes during Vitest |

### Final broad gates (T120)

| Gate | Result |
|---|---|
| SC-008 isolated | **PASS** — elapsedMs **37735**; maxActiveLanes **25**; ≤2s ratio **0.976**; media 5/5/5/5 |
| Focused matrix (FR-030 … FR-035 + T113–T116) | **PASS** |
| typecheck / lint / build / docs / openapi / prisma | **PASS** |
| `test:unit` | **117 files / 530 tests PASS** |
| `test:integration` | **51 files / 143 tests PASS** |
| `test:coverage` | **168 files / 673 tests PASS**; stmts 83.03%, branches 77.3%, funcs 85.98%, lines 84.57% |
| `git diff --check` | **PASS** |

**Phase closure:** Fresh independent final implementation re-review returned
**`PASS`** (2026-08-08). Human owner approved Complete with the exact phrase
recorded in `completion-report.md`. Historical `CHANGES REQUIRED` / `BLOCKED`
verdicts remain labelled historical evidence. Two non-blocking MINOR follow-ups
are recorded (unused SC-008 eslint-disable; acceptance could assert
`maxActiveLanes === 25`). The accidental historical migration of database
`Cleanora` remains a **separate unresolved operational incident** and was not
authorized or accessed by Complete approval.

---

## Owner Complete approval (2026-08-08)

```text
I approve R1-P04 — Customer Profiles, Preferences & Text Addresses as Complete.
```

R1-P04 Status = **Complete**. No commit/push/merge/deploy/next-phase activation
was authorized or performed by this administrative closure.
