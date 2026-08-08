# Traceability — R1-P04 Customer Profiles, Preferences & Text Addresses

**Date**: 2026-08-07 (DEC-033 repair status)

**Authority**: [spec.md](./spec.md), **DEC-030**, **DEC-031**, **DEC-032**,
**DEC-033**, [plan.md](./plan.md), [tasks.md](./tasks.md) (T001–T078 historical;
T079+ repair)

| Spec ID | Requirement summary | Design artifact | Planned tasks / tests |
|---|---|---|---|
| FR-001–FR-006 | Category profiles + not-created | [data-model.md](./data-model.md), [customer-self-service.md](./contracts/customer-self-service.md) | T025–T027, T030, T032–T033, T036–T037 |
| FR-007–FR-009 | Shared protected profile image | [media-profile-image.md](./contracts/media-profile-image.md); DEC-033 Cloudinary | T026, T028, T031, T034, T036–T037; T079+ repair |
| FR-010–FR-013 | Contact-state projection | customer-self-service.md | T048, T051, T053–T054, T068 |
| FR-014–FR-018 | Language + notification prefs | data-model.md; DEC-032 full-replace PUT | T047, T049–T054 |
| FR-019–FR-027 | Text addresses, no geo/default | data-model.md; OpenAPI `countryCode`→`country_id` | T038–T043, T077 |
| FR-028–FR-032 | Authz / ownership / minimization | plan.md; DEC-030 | T005, T022, T035, T044–T046, T067 |
| FR-033 | Ordinary mutation audit (general TX) | [transaction-boundaries.md](./contracts/transaction-boundaries.md) | T009, T020, T023–T024; US1 T028/T033–T034; US2 T039/T042; US3 T049/T052; US4 T057/T060/T062 |
| FR-034 | Denial + transition audit (non-TX denials) | transaction-boundaries.md | T009, T021, T024, T029, T035, T043, T053, T057, T063 |
| FR-035 | Successful self-reads need no personal-content business audit | transaction-boundaries.md | T027–T028, T039, T048–T049, T057, T074 |
| FR-036 | Privileged write contract (no staff UI) | DEC-031 catalogs | T007, T015–T016, T061, T064 |
| FR-037–FR-041 | Privacy request foundations | privacy-processor.md; privileged-reassign; CANCELLED CHECK | T055–T067 |
| FR-042–FR-045 | Failure consistency + auth freeze | quickstart.md | T028, T039, T045, T049, T057, T068, T077 |
| FR-046–FR-048 | Processor handoff + retention | privacy-processor.md; DEC-031 env + sweep | T008, T014, T019, T056–T058, T060–T065 |
| SC-001 | Profile field matrix | customer-self-service | T025–T028, T033–T037, T069 |
| SC-002 | Ownership + forged authority | quickstart authz matrix | T029, T044, T056–T057, T067 |
| SC-003 | Verification labels | contact-state tests | T048, T051 |
| SC-004 | Address text / zero geo | address tests | T038–T039, T077 |
| SC-005 | P01–P20 cohort (≥19/20 in 5 min) | quickstart E2E | **T069, T075** (executable; fail if unmet) |
| SC-006 | Mutation atomicity | integration concurrency | T028, T039, T049, T057 |
| SC-007 | Audit redaction | audit sampling | T009, T028–T029, T039, T049, T057, T074 |
| SC-008 | 25×40 workload (≥95% in 2s) | quickstart acceptance | **T070, T071, T075** (executable; fail if unmet) |
| SC-009–SC-012 | Request-only privacy + boundaries | privacy contracts | T057, T062–T063, T068, T077 |
| SC-013–SC-016 | Lifecycle + processor/privileged | privacy contracts; DEC-031 | T055–T061, T064 |
| SC-017–SC-019 | Eligibility + peer addresses | policy + address tests | T005, T022, T039, T044–T045, T067 |

## Explicit non-trace (forbidden)

| Anti-requirement | Planning control |
|---|---|
| Customer role grant / `resource.self.*` | DEC-030; T005, T016, T077 |
| Maps / coordinates | Absent columns; OpenAPI additionalProperties false; T038–T039, T077 |
| R1-P02 contract change | Contact-state projection only; T068 |
| Staff UI / production processor | Application contracts only; capability composition-only; T064 |
| Docker / cloud media / queues | Cloudinary provider (DEC-033); hourly in-process sweep; T065, T077, T079+ |
| Temporary 501 / unfinished mounted routes | Story-gated registration; T024, T036, T043, T053, T063, T077 |
| Broader reassignment roles | DEC-031 staff_admin only; T007, T015 |
| Free-form outcomes | Closed REQUEST_FULFILLED / REQUEST_REJECTED |

## Migration ownership

| Item | Value |
|---|---|
| Proposed name | `r1_p04_customer_profiles_preferences_text_addresses` |
| Creates | customers + media tables/enums/indexes/CHECKs; Auth catalog additive rows |
| Does not edit | Any applied migration |

## Published OpenAPI path

`docs/apis/openapi/r1-p04-customer-self-service.yaml` (T072; covered by `npm run openapi:validate`)

## Phase gate

Final independent `/speckit.analyze` verdict **`CLEAN`** (2026-08-07;
planning evidence). T001–T078 historical (checked). Independent implementation
review **`CHANGES REQUIRED`**. **DEC-033 repair authorized** (T079+). Independent
implementation **re-review PENDING**. Phase **not** Complete.

## Implementation evidence links (T073)

| Task range | Evidence |
|---|---|
| T001–T024 | `implementation-summary.md`; migration + foundation modules |
| T025–T037 | `tests/integration/customers/profiles*.ts`, `profile-image.test.ts`, `us1-denial-audit.test.ts`; `src/modules/customers/profile*.ts` |
| T038–T046 | `tests/integration/customers/addresses.test.ts`, `authorization-matrix-us1-us2.test.ts`, `eligibility-retention.test.ts` |
| T047–T054 | `preferences*.ts`, `contact-state.test.ts` |
| T055–T067 | `privacy-*.ts`, `authorization-matrix-us3-us4.test.ts` |
| T068–T074 | `r1-p02-contract-freeze.test.ts`, `sc005-cohort.test.ts`, `sc008-*.ts`, `fr035-read-non-audit.test.ts`, published OpenAPI |
| T075–T078 | `implementation-summary.md` quality-gate and anti-scope evidence |
