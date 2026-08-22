# R1-P06 Implementation Summary

## Implementation-start baseline

- Recorded at: `2026-08-13T14:09:13+03:00`
- Working branch observed read-only: `codex/r1-p05-postman-media-fixes`
- Authorization: implement R1-P06 tasks T001-T137 and validate the phase with focused R1-P06 evidence only.
- Prohibited actions: Git mutations, deployment, production configuration or migration, real external payout actions, destructive database operations, and future-phase behavior.
- Database rule: database-backed proof may run only against an explicitly named, verified disposable R1-P06 database or isolated schema.
- Test rule: use focused R1-P06 suites and a phase-scoped coverage command; do not invoke broad historical aggregate suites.

## Pre-existing work to preserve

The following status was present before the first R1-P06 implementation edit and is treated as human-owned unless a later R1-P06 task explicitly names the path:

```text
 M .specify/feature.json
 M docs/product/current.md
 M docs/product/decision-log.md
 M docs/product/open-questions.md
 M docs/product/roadmap.md
 M docs/product/vision.md
?? .specify/extensions/companion/scripts/__pycache__/
?? docs/design/r1-p06/
?? specs/R1-P05-provider-onboarding-profile-lifecycle/api-guide-ar-eg.md
?? specs/R1-P06-provider-verification-external-payout-destinations/
```

Specific preservation commitments:

- Do not modify `.specify/feature.json`, `docs/product/decision-log.md`, `docs/product/open-questions.md`, `docs/product/roadmap.md`, or `docs/product/vision.md` during implementation.
- Preserve `docs/design/r1-p06/`, the R1-P05 Arabic API guide, and the Companion `__pycache__` directory exactly as found.
- Defer the task-authorized `docs/product/current.md` status adjustment until T136, after all implementation and evidence gates pass.
- Preserve every existing migration; R1-P06 may add only `prisma/migrations/r1_p06_provider_verification_external_payout_destinations/migration.sql`.

## Authorized implementation path inventory

R1-P06 may add or make narrowly scoped changes only where T001-T137 require them:

- `src/modules/providers/**` for Provider-owned verification, document-policy, document-lifecycle, payout-destination, history, conflict, reveal orchestration, key rotation, projections, routes, DTOs, schemas, repositories, and services.
- Explicit public-contract or adapter changes under `src/modules/authentication/**`, `src/modules/customers/**`, `src/modules/configuration/**`, `src/modules/media/**`, and `src/modules/admin/**`.
- Runtime composition in `src/app.ts`, `src/server.ts`, and `src/config/payout-data-keys.ts`.
- Additive persistence changes in `prisma/schema.prisma`, the one R1-P06 migration directory, `prisma/seed.ts`, `scripts/validate-clean-migration.ts`, and `scripts/validate-r1-p06-upgrade.ts`.
- Focused R1-P06 fixtures and tests under the exact `tests/**` paths listed by T002-T130.
- R1-P06 API/runtime documentation and tooling in `docs/apis/**`, `src/swagger/openapi.document.ts`, `scripts/generate-r1-p06-postman.ts`, `scripts/openapi-validate.ts`, `scripts/validate-postman.ts`, `postman/Cleanora-R1-P06.postman_collection.json`, `package.json`, and `.env.example`.
- R1-P06 evidence artifacts in this feature directory, plus the final status-only update to `docs/product/current.md`.

## Evidence ledger

| Gate | Status | Evidence |
| --- | --- | --- |
| Prerequisites and checklist gate | PASS | SpecKit prerequisite check passed; 105/105 checklist items complete. |
| Baseline and preservation boundary | PASS | This document records the exact pre-edit status and authorized scope. |
| Prisma schema/generation | PASS | `npm run prisma:validate`, `npm run prisma:generate`, and `npm run build` exited 0 on 2026-08-14. |
| Migration static review | PASS | Focused migration-contract test and manual SQL/schema review passed; existing migrations were not edited. |
| Disposable database proof | PASS | Human-approved local target `cleanora_r1_p06_local_proof` on temporary `127.0.0.1:55432`. Clean schema `cleanora_r1_p06_proof_14416_1786669436430` and upgrade schema `cleanora_r1_p06_upgrade_proof_10676_1786669463156` each contain exactly 57 tables and 13 successful migrations. Clean apply, populated R1-P05 upgrade, fixture preservation, double-seed idempotency, live constraints, real repository five-slot rejection, and six-request reveal serialization passed. The temporary server was stopped; the installed PostgreSQL service was untouched. |
| Focused R1-P06 tests | PASS | `npm run test:r1-p06`: 36 files, 174 tests, all passing. |
| Phase-scoped coverage | PASS | `npm run test:coverage:r1-p06`: statements 85.22%, branches 75.82%, functions 86.17%, lines 88.79%; all strictly above 75%. The gate now measures the actual R1-P06 application-service layer as well as deterministic policy/security code. |
| Typecheck/lint/build | PASS | `npm run typecheck`, `npm run lint`, and `npm run build` exited 0. |
| OpenAPI/Postman/docs | PASS | OpenAPI validates 7 documents; Postman validates 74 R1-P06 requests, 37 per environment, with runtime parity; `docs:check` checked 13 documents. |
| Privacy/readiness evidence | PASS (static/synthetic) | Forbidden payout/document sentinels are absent from R1-P06 production/schema/API artifacts; key configuration, masking, reveal, audit, and leakage tests pass. Live external scanner/storage probes were not run. |
| FR/SC traceability | PASS | FR-001–FR-166 and SC-001–SC-042 are continuous and mapped below; focused/static evidence and the disposable database proof cover the phase-owned implementation boundary. |
| Final implementation review | PASS | Module-boundary and forbidden-scope review findings were remediated. The disposable database gate now passes; no open implementation blocker remains. |

## Implementation log

- `2026-08-13T14:09:13+03:00`: T001 baseline recorded before product-code, schema, migration, test, or runtime documentation changes.
- `2026-08-13`: Implemented R1-P06 document policy/evidence/lifecycle/review, payout destination/lifecycle/primary/conflict/reveal, protected-field crypto/lookup/rotation, history/audit/outbox, API contracts, and runtime composition.
- `2026-08-13`: Added durable Provider primary-state versioning so stale commands cannot restore or replace primary state after the singleton selection row is empty.
- `2026-08-13`: Added bounded policy activation history for policy-effective, verification-truth, and badge-truth changes, plus minimized denied-attempt audit across R1-P06 high-risk/cross-scope workflows.
- `2026-08-13`: Remediated the final module-layer review finding by moving verification and Staff payout query orchestration out of controllers into Provider-owned query services.
- `2026-08-14`: Hardened payout commits with transaction-bound Staff, proof, reveal, exact active Owner, Customers legal-name, registry, and exact-version rechecks; closed the first-primary, claim-reuse, evidence-scope, notification, rotation-resume, and safe-note privacy edges found during the final audit.
- `2026-08-14`: Added structural PDF parsing and expanded active-content rejection, original-byte evidence limits, exact Media receipt binding, safe payout notification payloads, denied-reveal key-version evidence, and the human-invoked bounded key-rotation runner.
- `2026-08-14`: Closed the final note-projection edge: generic payout history and privileged audit use closed reason codes, while private command notes remain bounded idempotency evidence; Staff payout decision notes reject the exact decrypted identifier and holder name.
- `2026-08-14`: Closed lifecycle and evidence-reference edges: approved payout destinations can be explicitly invalidated or replacement-requested, decision outcomes use closed compatible reason codes, and every supplied reveal reference must be accepted and bound to the exact Staff actor/version before a decision commits.
- `2026-08-14`: Hardened Provider document mutation evidence so HTTP request correlation is distinct from command identity, exact retries compare both, successor creation rechecks the closed predecessor-state set under lock, and private Media evidence-set validation crosses modules only through `media.public.ts`.
- `2026-08-14`: Made Staff document approval alone depend on currently READY evidence so unreadable evidence can still be rejected or replacement-requested, and ordered trusted controller request correlation after body spreads to prevent future input-shape drift from overriding it.
- `2026-08-14`: Completed every non-database validation gate. At that checkpoint, database proof, T131, T136, and final live quickstart closure remained intentionally incomplete.
- `2026-08-14`: Corrected the clean validator's R1-P06 inventory to all 23 phase tables, required an explicitly named R1-P06 database before connection, expanded live constraint/reveal probes, and added an executable populated R1-P05-to-R1-P06 upgrade validator. Static proof-tool tests passed at that checkpoint; neither database validator had yet been run pending exact-target approval.
- `2026-08-14`: Executed both database-proof commands only against the existing non-R1-P06 configured URL to test their pre-connection guard. Both intentionally exited 1 with `R1-P06 migration proof requires an explicitly named R1-P06 disposable database`; the upgrade command left zero `.r1-p06-upgrade-*` directories. No database connection or operation occurred. The proof runners now also require exactly one total successful history row per migration, isolate the global cross-Provider fingerprint probe from per-claim uniqueness, delete payout successors before predecessors during cleanup, and accurately report the two reviewed R1-P03A cleanup drops.
- `2026-08-14`: After explicit human approval, initialized a temporary PostgreSQL 18 cluster at `D:\new_repos\Cleanora_R1\.tmp\r1-p06-postgres-proof`, bound only to `127.0.0.1:55432`, and created only `cleanora_r1_p06_local_proof`. The first live attempts exposed and led to focused repairs for schema-aware Prisma adapter qualification, historically valid verified-business proof users, and a PostgreSQL `void` deserialization bug in the production reveal advisory-lock query. No applied migration was edited.
- `2026-08-14`: `npm run db:validate-clean-migration` then passed in `cleanora_r1_p06_proof_14416_1786669436430`; `npm run db:validate-r1-p06-upgrade` passed in `cleanora_r1_p06_upgrade_proof_10676_1786669463156`. Each successful schema has 57 exact tables and 13 successful migration rows. The upgrade fixture preserved Provider `r1p06-upgrade-provider`, Owner `r1p06-upgrade-owner`, country/profile relation, exact active OWNER membership, and `payout_primary_state_version=0`; `public` has zero product tables. The temporary server was stopped, port 55432 was closed, proof files were retained, and the separate installed PostgreSQL service remained running unchanged.

## Validation Evidence

| Command / check | Result |
| --- | --- |
| `npm run test:r1-p06` | PASS — 36 files, 174 tests. |
| `npm run test:coverage:r1-p06` | PASS — 85.22% statements, 75.82% branches, 86.17% functions, 88.79% lines across the phase application-service and deterministic policy/security scope. |
| Directly impacted audit/media/composition/dashboard tests | PASS — an earlier 6-file/35-test bounded rerun passed; the final 36-file/174-test phase suite supersedes it. |
| `npm run prisma:validate` | PASS — schema valid. |
| `npm run prisma:generate` | PASS — Prisma Client 7.9.0 generated. |
| Static R1-P06 migration contract | PASS — included in the focused suite. |
| `npm run typecheck` | PASS. |
| `npm run lint` | PASS. |
| `npm run build` | PASS. |
| `npm run openapi:validate` | PASS — R1-P01 through R1-P06 and runtime aggregate validated. |
| `npm run postman:validate` | PASS — 74 R1-P06 requests, 37 per environment, runtime parity true. |
| `npm run docs:check` | PASS — 13 documents checked on 2026-08-14. |
| `npm run db:validate-clean-migration` with current non-R1-P06 `.env` target | EXPECTED FAIL-CLOSED — exit 1 at the explicit R1-P06 database-name guard, before connection. This is guard evidence, not migration proof. |
| `npm run db:validate-r1-p06-upgrade` with current non-R1-P06 `.env` target | EXPECTED FAIL-CLOSED — exit 1 at the same pre-connection guard; zero proof temporary directories before and after. This is guard evidence, not upgrade proof. |
| `npm run db:validate-clean-migration` with the approved disposable R1-P06 target | PASS — exact chronological apply in `cleanora_r1_p06_proof_14416_1786669436430`; 57 tables, 13 successful migrations, double-seed idempotency, and live R1-P05/R1-P06 probes. |
| `npm run db:validate-r1-p06-upgrade` with the approved disposable R1-P06 target | PASS — exact R1-P01-through-R1-P05 baseline, populated Provider fixture, R1-P06 deploy, preserved relations, 57 tables, 13 successful migrations, double-seed idempotency, and live probes in `cleanora_r1_p06_upgrade_proof_10676_1786669463156`. |
| Requirement continuity | PASS — 166/166 FRs, 42/42 SCs, and 137/137 task identifiers present with no gaps. |
| Requirements checklists | PASS — 105/105 checked across API/domain, data/migration, requirements, security, and UX/accessibility. |
| Contradiction scan | PASS — no positive requirement for payout ownership evidence, phone verification, prefix-inferred/free-text operators, payout execution, stored value, automatic failover, or Provider-side full identifier reveal. Matches are explicit prohibitions or rejected alternatives. |
| Forbidden-sentinel scan | PASS for runtime/schema/API/Postman artifacts — IBAN, holder-name, document-number, and key sentinels absent. The synthetic wallet appears only in the security-design masking example and pre-existing generic Authentication phone-format examples, never in a runtime R1-P06 response/audit/history/outbox artifact. |
| Disposable clean/upgrade migration and DB constraint probes | PASS — explicitly approved temporary local target; successful schemas and counts recorded above; temporary server stopped afterward. |

## Static Migration and Security Review

- One additive phase migration exists at `prisma/migrations/r1_p06_provider_verification_external_payout_destinations/migration.sql`; no applied migration was edited.
- Enum creation precedes dependent tables; Provider, Country, Currency, User, Media, and outbox relations use explicit foreign keys and restrictive lifecycle behavior.
- Unique/partial indexes cover policy drafts/effective ordering, document and payout operation keys, one open successor, active lookup-fingerprint claims, one open conflict, reveal-operation identity, and one global Provider primary.
- Check constraints cover versions, lifecycle timestamps, type-specific payout shape, reason length, protected envelope metadata, fingerprints, rotation counters, and retirement prerequisites.
- No recoverable plaintext payout identifier or holder-name column exists. Persistence contains ciphertext envelopes, non-secret key IDs, safe suffix/mask facts, routing registry references, lifecycle facts, and HMAC lookup fingerprints.
- New writes require externally supplied independent encryption and lookup key rings. Startup/readiness rejects missing, malformed, reused, inactive, or historically unavailable keys. Rotation is reachable only through the explicit `r1-p06:payout-key-rotation` human-operated runner; it never edits key configuration or automatically retires a key.
- Mobile Wallet and Bank Account verification remain manual Staff procedures. No rail client, transfer command, money movement, settlement, stored-value wallet, or payout execution was introduced.

## FR Traceability

| Requirements | Implementation evidence | Verification evidence |
| --- | --- | --- |
| FR-001–FR-009 | Existing Provider identity/lifecycle is preserved; `ProviderDocumentService`, `ProviderVerificationQueryService`, and verification policy derive post-approval behavior without changing application approval. | US1/US2/US5 focused tests. |
| FR-010–FR-018 | Stable document types and immutable effective-dated policy versions in Prisma, policy domain/service/repository, and human-invoked EG bootstrap. | US10 unit/integration tests, schema/migration contract. |
| FR-019–FR-029 | Provider document service, Media public port, evidence adapter/policy, immutable linked document versions, complete PDF or image-set evidence. JPEG and JPG are canonicalized as `image/jpeg`. | US2 and Media evidence tests; migration contract. |
| FR-030–FR-042 | Staff document review/query services, exact-version decisions, continuity policy, expiry sweep, derived verification/badge truth, and immutable history. | US3–US5 tests and policy-activation test. |
| FR-043–FR-050 | Existing readiness/dashboard projections consume derived `documentsVerified` and approved-primary payout readiness without altering later gates or public/LIVE eligibility. | US1/US5 projection and directly impacted dashboard tests. |
| FR-051–FR-064 | Closed two-type payout catalog, external-destination-only model, exact Owner mutation, primary policy, and Authentication-owned recent proof verification. | US6/US7 tests, public-contract tests, OpenAPI. |
| FR-065–FR-082 | Masked DTO/history boundaries, public contracts, Staff capability checks, minimized denial audit, exact versions, idempotency, concurrency controls, immutable history, and atomic repository transactions. | US8/US9, concurrency, leakage, audit, and impacted privileged-audit tests. |
| FR-083–FR-088 | No worker/service/pricing/coverage/final-eligibility/payment/payout-execution scope; one additive R1-P06 migration only. | Forbidden-scope scan, static SQL review, implementation review. |
| FR-089–FR-103 | Country-authoritative E.164 wallet, registry-selected operator, authoritative holder relationship/name, no phone match/verification, no evidence upload, pending submission, manual Staff check, dedup independent of operator, masking, and approved-primary readiness. | US6/US7/US8 tests, OpenAPI/Postman, payout policy and registry code. |
| FR-104–FR-117 | EG/EGP IBAN-first bank draft, registry bank, normalized IBAN, no ownership document, pending submission, manual Staff beneficiary check, dedup, masking, and approved-primary readiness. | US6/US7/US8 tests, OpenAPI/Postman, payout policy and registry code. |
| FR-118–FR-139 | Five-chain limit, one successor, closed lifecycle, immutable submitted values, voluntary/challenged continuity, durable monotonic primary-state version, explicit primary replacement/last-primary acknowledgement, recent proof, safe durable outbox, and asynchronous delivery. | US7 lifecycle/concurrency/primary tests, migration indexes, repository transaction review. |
| FR-140–FR-149 | AES-256-GCM with unique nonce/AAD, separate HMAC-SHA-256 lookup keys, write-only identifiers, role projections, exact wallet/IBAN masks, and all-or-omitted holder name. | Crypto, masking, DTO security-contract, leakage tests; schema inspection. |
| FR-150–FR-157 | One pending-version Staff reveal, capability + five-minute proof + purpose grant, no bulk reveal, no-store response, accepted/denied pre-return audit, and atomic five-per-ten-minute limit. | US8 reveal and six-request concurrency tests, Admin audit gate, OpenAPI. |
| FR-158–FR-166 | Four declared key-ring settings, fail-closed readiness, overlap-aware new writes/dedup, bounded resumable rotation, zero-reference plus human retirement approval, protected recovery failure, and Media-owned evidence bytes. | Key configuration/crypto/rotation/security-contract tests, readiness composition, schema/migration review. |

## SC Traceability

| Success criteria | Evidence and result |
| --- | --- |
| SC-001–SC-006 | US1–US5, denial-audit, history-safety, leakage, and projection tests pass; private/cross-scope behavior is fail-closed. |
| SC-007–SC-013 | Closed payout type schemas, no-execution scan, exact history/outbox/audit paths, concurrency suites, safe errors, and Provider/Staff projections pass. |
| SC-014–SC-021 | Policy authorization/concurrency/effective selection, complete evidence, document lifecycle, verification truth, and badge matrix tests pass; all material clarifications are closed. |
| SC-022–SC-025 | Wallet Owner draft, pending/manual Staff verification, country+E.164 dedup, retry/concurrency, masking, and approved-primary readiness tests pass. |
| SC-026–SC-029 | Bank Owner draft, pending/manual Staff verification, normalized-IBAN dedup, retry/concurrency, masking, and approved-primary readiness tests pass. |
| SC-030–SC-034 | Cardinality/successor/terminal transitions, voluntary and challenged continuity, durable primary-state concurrency, recent proof, and safe outbox behavior pass focused tests/static constraints. |
| SC-035–SC-042 | Protected persistence shape, domain-separated lookup, role masking, purpose-bound reveal, audit, startup/readiness key validation, rotation/retirement, and recovery-failure tests pass; the disposable database also proved envelope/fingerprint constraints and real advisory-lock reveal serialization. |

## Final Handoff Gate

Every implementation and evidence gate now passes, including T131's explicitly
approved disposable clean-install and populated R1-P05-upgrade proofs. T136
updated `docs/product/current.md` to request human validation, and the
implementation Companion hook recorded `implemented` with 137/137 tasks. On
2026-08-14, the human owner explicitly approved R1-P06 as Complete and the
terminal Companion hook recorded `completed`. Git actions, deployment,
production configuration or migration, real payout-channel operations,
destructive database operations, and R1-P07 activation remain unauthorized.
