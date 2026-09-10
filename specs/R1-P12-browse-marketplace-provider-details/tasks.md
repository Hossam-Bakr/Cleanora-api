# Tasks: R1-P12 — Browse Marketplace & Provider Details

**Input**: [spec.md](./spec.md), [plan.md](./plan.md)  
**Status**: Implemented — fresh Codex review PASS; not Complete

## Phase 1 — Foundation

- [x] T001 Create `src/modules/bookings/` skeleton (routes/controller/service/schemas/public; no empty barrels) — FR-001, FR-013
- [x] T002 Add optional-auth middleware in authentication (or shared approved location) and wire for browse router — FR-001
- [x] T003 Extend Configuration public locality reader with active city/district list projections — FR-015, FR-013
- [x] T004 Implement Providers contact-free preview with signed logo/cover/gallery URLs — FR-005, FR-003
- [x] T005 Add crew-summary HTTP DTO mapper from booking-safe team facts **without Worker IDs** — FR-005, FR-003
- [x] T006 Mount browse router in composition + `routes/index.ts` — FR-001
- [x] T007 Add `vitest.r1-p12.config.ts` + `npm run test:coverage:r1-p12` script — SC-005
- [x] T008 Author OpenAPI fragment `docs/apis/openapi/r1-p12-browse-marketplace.yaml` and merge into swagger document — FR-014

## Phase 2 — Catalog & locality HTTP

- [x] T009 `GET /browse/services` + tests — FR-004, US2
- [x] T010 `GET /browse/services/:serviceId` + tests — FR-004, US2
- [x] T011 `GET /browse/countries/:countryCode/cities` + tests — FR-015
- [x] T012 `GET /browse/countries/:countryCode/cities/:cityId/districts` + tests — FR-015
- [x] T013 Reject geo extras on browse schemas (coordinates/radius) — FR-009

## Phase 3 — Eligible list

- [x] T014 Browse list service calls composition `getStandardBrowseCandidates` only — FR-002, US1
- [x] T015 Enrich list cards with contact-free names/media thumbs — FR-003, FR-005
- [x] T016 Sort price asc → providerId → teamId — FR-006
- [x] T017 Apply `maxPriceAmount` and `q` after eligibility — FR-008, US4
- [x] T018 Cursor pagination bound to evaluation fingerprint — FR-007, US4
- [x] T019 Integration: ineligible never appears; empty set 200 — SC-001, US1
- [x] T020 Integration: guest no-auth happy path — SC-002
- [x] T021 Unit: invalid cursor / fingerprint mismatch → validation error — FR-007

## Phase 4 — Provider detail

- [x] T022 Detail re-evaluates eligibility and requires candidate membership — FR-002, FR-005
- [x] T023 Detail returns profile, gallery, price facts, crew aggregates, `bookingPrerequisites` — FR-005, FR-011, US3, US5
- [x] T024 Privacy tests for forbidden markers on list+detail JSON — FR-003, SC-003
- [x] T025 Ratings absent/null — no fabricated scores — FR-012
- [x] T026 Non-enumerating not-found for ineligible detail targets — US3

## Phase 5 — Artifacts & gates

- [x] T027 Postman collection + `npm run postman:validate` — FR-014, SC-004
- [x] T028 `npm run openapi:validate` — SC-004
- [x] T029 Phase unit/integration suites green for P12 scope
- [x] T030 `npm run test:coverage:r1-p12` meets 80/75/80/80 — SC-005
- [x] T031 `npm run typecheck` + build + docs:check for intended tree
- [x] T032 Module-boundary review artifact — SC-006, FR-013
- [x] T033 Migration evidence NOT_APPLICABLE (or proofs if schema added) — SC-007
- [x] T034 Implementation summary + gate log in phase artifacts
- [x] T035 Codex final review; repair BLOCKER/MAJOR; re-review if required — fresh Codex review **PASS** on 2026-09-10; DEC-087 retained as historical substitution record
- [x] T036 Record READY_FOR_OWNER_REVIEW in progress/handoff (no mark-complete)

## Traceability

| AC / FR | Tasks |
|---|---|
| US1 / FR-001–002 / SC-001–002 | T014–T020 |
| US2 / FR-004 | T009–T010 |
| US3 / FR-005 / FR-003 | T004–T005, T022–T026 |
| US4 / FR-006–008 | T016–T018, T021 |
| US5 / FR-011 | T023, T033 |
| FR-015 | T003, T011–T012 |
| FR-014 / SC-004 | T008, T027–T028 |
| SC-005–007 | T007, T030–T033 |
