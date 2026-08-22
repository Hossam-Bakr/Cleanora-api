# Tasks: R1-P06 Provider Verification & External Payout Destinations

**Input**: [spec.md](./spec.md), [plan.md](./plan.md), [research.md](./research.md), [data-model.md](./data-model.md), [security-design.md](./security-design.md), [migration-plan.md](./migration-plan.md), [test-strategy.md](./test-strategy.md), [ux-design.md](./ux-design.md), and [contracts](./contracts/).
**Tests**: Required by the specification, success criteria, and phase Definition of Done. Write focused tests before the corresponding implementation and establish the expected failure without weakening assertions.
**Organization**: Shared setup/foundation first, then one independently demonstrable phase for each of the 10 prioritized user stories.

## Format

`[ID] [P?] [Story] Description with exact file path`

- `[P]` means the task can run in parallel with adjacent tasks because it targets different files and has no dependency on their unfinished output.
- User-story tasks always carry `[USn]`; setup/foundation/polish tasks do not.
- No task authorizes production configuration, deployment, real external transfers, Git publication, or later-phase work.

## Phase 1: Setup and Guardrails

**Purpose**: Establish R1-P06 file boundaries, safe configuration vocabulary, and validation inventories without changing business behavior first.

- [x] T001 Record the implementation-start baseline and authorized path inventory in `specs/R1-P06-provider-verification-external-payout-destinations/implementation-summary.md`
- [x] T002 [P] Add R1-P06 synthetic fixture builders and sentinel secret constants in `tests/helpers/r1-p06-fixtures.ts`
- [x] T003 [P] Add R1-P06 safe clock, nonce, key-ring, Authentication, Customers, Configuration, Media, scanner, audit, and email test doubles in `tests/helpers/r1-p06-test-doubles.ts`
- [x] T004 [P] Add the closed R1-P06 decision-reason, verification-method, notification-template, and safe-error catalogs in `src/modules/providers/domain/provider-verification.catalog.ts`
- [x] T005 [P] Add payout key-ring/scanner environment names with no secret values or defaults to the repository configuration inventory in `.env.example`
- [x] T006 [P] Add the R1-P06 runtime OpenAPI destination and Postman collection inventory to `docs/apis/README.md`
- [x] T007 Reconcile the implementation-start validation order and evidence placeholders with the finalized repository commands in `specs/R1-P06-provider-verification-external-payout-destinations/quickstart.md`

**Checkpoint**: Synthetic evidence and safe catalog names are available; no business story is implemented.

---

## Phase 2: Foundational Blocking Work

**Purpose**: Build shared ownership-safe contracts, persistence, cryptography, concurrency, and routing foundations used by all stories.

**CRITICAL**: No user-story phase starts until the schema/contracts/configuration foundation and its focused tests pass.

- [x] T008 [P] Add failing unit tests for exact document and payout lifecycle transition tables in `tests/unit/providers/r1-p06-lifecycle-policies.test.ts`
- [x] T009 [P] Add failing unit tests for E.164/IBAN normalization and exact wallet/IBAN masks in `tests/unit/providers/r1-p06-normalization-masking.test.ts`
- [x] T010 [P] Add failing unit tests for AES-GCM envelopes, canonical AAD, HMAC domains, key-ring parsing, and fail-closed recovery in `tests/unit/providers/r1-p06-payout-crypto.test.ts`
- [x] T011 [P] Add failing contract tests for Authentication proof/capability facts, Customers legal names, Configuration country/currency facts, Media evidence facts, and Admin reveal audit gate in `tests/unit/providers/r1-p06-public-contracts.test.ts`
- [x] T012 [P] Add failing migration-inventory and SQL-safety tests for the planned R1-P06 schema in `tests/integration/database/r1-p06-migration-contract.test.ts`
- [x] T013 Add all R1-P06 enums, relations, models, indexes representable by Prisma, and opposite relations without plaintext payout columns in `prisma/schema.prisma`
- [x] T014 Create and line-review the forward-only additive SQL, partial indexes, checks, FKs, comments, and enum handling in `prisma/migrations/r1_p06_provider_verification_external_payout_destinations/migration.sql`
- [x] T015 Update migration names/table inventories/static SQL assertions/live probes for R1-P06 in `scripts/validate-clean-migration.ts`
- [x] T016 Add idempotent stable document/payout types and finalized Staff permissions without guessed bank/operator/key/policy-publication data in `prisma/seed.ts`
- [x] T017 [P] Define R1-P06 domain types, safe projections, command/result shapes, and repository ports in `src/modules/providers/domain/provider-verification.types.ts`
- [x] T018 [P] Implement exact document and payout transition guards in `src/modules/providers/domain/provider-verification.lifecycle.ts`
- [x] T019 [P] Implement E.164/IBAN normalizers, authoritative-country validation, and exact mask builders in `src/modules/providers/domain/payout-destination.policy.ts`
- [x] T020 [P] Implement strict independent key-ring loading/readiness validation with no defaults in `src/config/payout-data-keys.ts`
- [x] T021 Implement AES-256-GCM field envelopes, canonical AAD, enabled-key HMAC fingerprints, and request-memory-only decrypt in `src/modules/providers/infrastructure/payout-data-crypto.adapter.ts`
- [x] T022 Extend active identity/re-authentication/Staff step-up/capability public facts and register the three R1-P06 Staff permission codes in `src/modules/authentication/authentication.public.ts` and `src/modules/authentication/domain/authorization.catalog.ts`
- [x] T023 [P] Add the purpose-limited Provider payout legal-name reader contract in `src/modules/customers/customers.public.ts`
- [x] T024 [P] Extend active country/currency public facts needed by Provider payout policy in `src/modules/configuration/configuration.public.ts`
- [x] T025 Add purpose-specific private verification evidence reservation/status/delivery contracts in `src/modules/media/media.public.ts`
- [x] T026 Add business-neutral privileged writes and actor-serialized payout reveal audit-gate contracts in `src/modules/admin/audit.public.ts`
- [x] T027 Wire R1-P06 repositories, public adapters, key rings, scanner, clock, routes, and outbox dependencies in `src/app.ts`

**Checkpoint**: Clean migration validation on an explicitly disposable database, shared domain tests, and all public-contract tests pass before stories.

---

## Phase 3: User Story 1 — Individual Team Has No Document Burden (Priority: P1) MVP

**Goal**: An approved Individual Team receives `documentsVerified = NOT_REQUIRED`, satisfied truth, badge `NOT_ELIGIBLE`, and no document mutation capability.

**Independent Test**: With only an approved Individual Team fixture and the R1-P06 foundation, the protected overview/readiness response shows NOT_REQUIRED/NOT_ELIGIBLE, document creation is unavailable/denied, and all R1-P05 readiness gates retain their prior meanings.

### Tests

- [x] T028 [P] [US1] Add failing unit tests for Individual Team document/readiness/badge derivation in `tests/unit/providers/us1-individual-document-exemption.test.ts`
- [x] T029 [P] [US1] Add failing protected API tests for Individual Team overview, no checklist burden, and no document mutation surface in `tests/integration/providers/r1-p06-us1-individual-exemption.test.ts`

### Implementation

- [x] T030 [P] [US1] Implement document applicability and badge derivation for Individual Teams in `src/modules/providers/domain/provider-verification.policy.ts`
- [x] T031 [US1] Extend the existing Provider readiness calculation with R1-P06 NOT_REQUIRED facts without altering the ten R1-P05 checks in `src/modules/providers/domain/provider-readiness.policy.ts`
- [x] T032 [US1] Add role-safe verification overview DTO mapping for Individual Teams in `src/modules/providers/provider-verification.dto.ts`
- [x] T033 [US1] Add the protected verification overview and requirements handlers/routes in `src/modules/providers/provider-verification.controller.ts` and `src/modules/providers/providers.routes.ts`

**Checkpoint**: US1 passes independently and does not require document policy/evidence data for Individual Teams.

---

## Phase 4: User Story 2 — Registered Company Submits Required Evidence (Priority: P1)

**Goal**: An approved Registered Company Owner/Admin can read the effective checklist, manage private DRAFT metadata/evidence, and submit only a complete READY PDF or ordered JPEG/PNG set.

**Independent Test**: Against an effective synthetic EG policy, exact Owner/Admin can submit both approved evidence formats; wrong country, invalid dates, mixed/unsafe/over-limit/non-READY evidence, inactive type, unauthorized/cross-Provider access, and `.jpg` rejection regressions fail safely.

### Tests

- [x] T034 [P] [US2] Add failing unit tests for policy requirement resolution, metadata/date rules, format exclusivity, page/order/byte aggregates, and policy snapshotting in `tests/unit/providers/us2-document-submission-policy.test.ts`
- [x] T035 [P] [US2] Add failing Media tests for signature/decode checks, `.jpg`/`.jpeg` canonical JPEG, PNG/PDF, encryption/active-content/malware rejection, orientation, metadata stripping, and receipt state in `tests/unit/media/r1-p06-verification-evidence.test.ts`
- [x] T036 [P] [US2] Add failing integration tests for Owner/Admin draft/evidence/order/submit, Media READY re-read, idempotency, exact versions, and scope isolation in `tests/integration/providers/r1-p06-us2-company-documents.test.ts`

### Implementation

- [x] T037 [P] [US2] Implement Media evidence validation receipt types, limits, safe failures, and processing policy in `src/modules/media/domain/provider-verification-evidence.policy.ts`
- [x] T038 [US2] Implement PDF/JPEG/PNG inspection, malware-scanner port, image normalization/metadata removal, and private Cloudinary upload flow in `src/modules/media/infrastructure/provider-verification-evidence.adapter.ts`
- [x] T039 [US2] Extend the Cloudinary adapter so validated `image/jpeg` accepts both `.jpg` and `.jpeg` and validated PDF remains private in `src/modules/media/infrastructure/cloudinary-media.adapter.ts`
- [x] T040 [US2] Implement Media evidence reservation/status/receipt/private-delivery repository behavior in `src/modules/media/infrastructure/prisma-media.repository.ts`
- [x] T041 [P] [US2] Implement effective document policy and policy-item reads in `src/modules/providers/infrastructure/prisma-provider-verification.repository.ts`
- [x] T042 [US2] Implement exact Owner/Admin document draft, evidence binding/order, complete validation, snapshot, and submission transactions in `src/modules/providers/provider-document.service.ts`
- [x] T043 [US2] Add strict document/evidence request schemas and safe DTOs in `src/modules/providers/provider-verification.schema.ts` and `src/modules/providers/provider-verification.dto.ts`
- [x] T044 [US2] Add Provider document list/detail/create/update/evidence/order/submit endpoints in `src/modules/providers/provider-verification.controller.ts` and `src/modules/providers/providers.routes.ts`

**Checkpoint**: US2 submits immutable private evidence without granting verification credit or requiring payout work.

---

## Phase 5: User Story 3 — Privileged Reviewer Decides Documents Safely (Priority: P1)

**Goal**: Only capable active Staff Admin reviews exact document versions with private Media delivery, meaningful reason, immutable decision/history/audit, and atomic verification effects.

**Independent Test**: A SUBMITTED document can be approved/rejected/replacement-requested exactly once by authorized Staff; an APPROVED version can later be invalidated; stale/competing/unauthorized/blank-reason attempts write no partial evidence.

### Tests

- [x] T045 [P] [US3] Add failing unit tests for Staff document decision authorization, legal outcomes, reason shape, and effective-pointer changes in `tests/unit/providers/us3-document-review-policy.test.ts`
- [x] T046 [P] [US3] Add failing integration tests for Staff queue/dossier/private delivery, decisions, concurrency, idempotency, audit/history, and no Provider self-review in `tests/integration/providers/r1-p06-us3-document-review.test.ts`

### Implementation

- [x] T047 [P] [US3] Enforce the registered document-review permission in the Staff review authorization path in `src/modules/authentication/authorization.policy.ts`
- [x] T048 [P] [US3] Strengthen privileged audit safe-context guards for document/payout protected keys in `src/modules/admin/audit.service.ts`
- [x] T049 [US3] Implement Staff document review queue and dossier queries with authorized Media delivery in `src/modules/providers/provider-document-review-query.service.ts`
- [x] T050 [US3] Implement approve/reject/request-replacement/approved-invalidate transactions and immutable review/history/audit writes in `src/modules/providers/provider-document-review.service.ts`
- [x] T051 [US3] Add repository locks, exact-version decision uniqueness, effective pointers, and safe history persistence in `src/modules/providers/infrastructure/prisma-provider-verification.repository.ts`
- [x] T052 [US3] Add strict Staff document decision schemas and safe dossier DTOs in `src/modules/providers/provider-verification.schema.ts` and `src/modules/providers/provider-verification.dto.ts`
- [x] T053 [US3] Add Staff document queue/dossier/decision endpoints in `src/modules/providers/provider-verification.controller.ts` and `src/modules/providers/providers.routes.ts`
- [x] T054 [US3] Add audit-input and forbidden-value regression coverage for document review in `tests/integration/admin/r1-p06-document-audit-safety.test.ts`

**Checkpoint**: US3 Staff decisions are immutable and cannot be performed by Provider members.

---

## Phase 6: User Story 4 — Replace, Renew, and Expire Evidence (Priority: P1)

**Goal**: Immutable linked document successors preserve or remove effective credit exactly according to voluntary/challenged/expired continuity rules.

**Independent Test**: Voluntary successor rejection preserves an unexpired unchallenged predecessor, approval atomically supersedes it, and expiry/Staff challenge removes credit immediately; history remains complete and no submitted row is edited/deleted.

### Tests

- [x] T055 [P] [US4] Add failing unit matrix tests for successor creation, voluntary continuity, challenged predecessor, approval supersession, rejection, expiry, and invalidation in `tests/unit/providers/us4-document-continuity.test.ts`
- [x] T056 [P] [US4] Add failing integration tests for one-successor concurrency, exact-version conflicts, immutable metadata/evidence, effective-pointer atomicity, and expiry retries in `tests/integration/providers/r1-p06-us4-document-lifecycle.test.ts`

### Implementation

- [x] T057 [P] [US4] Implement document successor eligibility and continuity calculations in `src/modules/providers/domain/provider-document-continuity.policy.ts`
- [x] T058 [US4] Implement Owner/Admin linked successor creation with immutable predecessor references in `src/modules/providers/provider-document.service.ts`
- [x] T059 [US4] Implement successor approval/rejection/challenge effective-pointer transactions in `src/modules/providers/provider-document-review.service.ts`
- [x] T060 [US4] Implement bounded idempotent authoritative document expiry processing in `src/modules/providers/provider-document-expiry.sweep.ts`
- [x] T061 [US4] Add one-successor/effective-version SQL repository guards and expiry cursor reads in `src/modules/providers/infrastructure/prisma-provider-verification.repository.ts`
- [x] T062 [US4] Add document successor endpoint/schema/detail/history semantics in `src/modules/providers/provider-verification.controller.ts` and `src/modules/providers/provider-verification.schema.ts`
- [x] T063 [US4] Add expiry sweep composition and safe operational scheduling entry point in `src/server.ts`

**Checkpoint**: US4 maintains correct current credit without destroying historical versions.

---

## Phase 7: User Story 5 — Understand Verification Truth and Badge (Priority: P1)

**Goal**: All protected Provider projections agree on effective document truth, blocker codes, and badge state under policy/lifecycle/operational changes.

**Independent Test**: Overview, readiness, dashboard, settings, and Staff dossier return identical current truth for Individual Teams and Companies across complete/incomplete/new-policy/expiry/challenge/suspension cases, while eligibility remains false.

### Tests

- [x] T064 [P] [US5] Add failing pure projection tests for every documentsVerified/badge/blocker matrix row in `tests/unit/providers/us5-verification-projections.test.ts`
- [x] T065 [P] [US5] Add failing integration consistency tests across overview/readiness/dashboard/settings/Staff dossier and suspension in `tests/integration/providers/r1-p06-us5-projection-consistency.test.ts`

### Implementation

- [x] T066 [P] [US5] Implement stable R1-P06 document blocker codes and badge truth in `src/modules/providers/domain/provider-verification.policy.ts`
- [x] T067 [US5] Integrate effective policy/document facts into `documentsVerified` in `src/modules/providers/domain/provider-readiness.policy.ts`
- [x] T068 [US5] Extend Provider overview/dashboard/settings projections with protected R1-P06 facts and no public/private leakage in `src/modules/providers/provider-projection.service.ts`
- [x] T069 [US5] Extend the safe Providers public readiness/badge contract without document/payout details in `src/modules/providers/providers.public.ts`
- [x] T070 [US5] Add projection API regression assertions to the R1-P06 planning/runtime contract parity suite in `tests/integration/providers/r1-p06-us5-projection-contract.test.ts`

**Checkpoint**: US5 produces one consistent truth source and never grants LIVE/public eligibility.

---

## Phase 8: User Story 6 — Register an External Payout Destination (Priority: P1)

**Goal**: Exact active Owner creates/edits/submits masked Mobile Wallet or IBAN-first Bank Account destinations from authoritative country-scoped registries without ownership evidence or external rail integration.

**Independent Test**: Owner can save and submit valid wallet/bank drafts; Admin sees only reduced masked status; unsupported/free-text/redundant/evidence/phoneVerified inputs, inactive registries, bad normalization, sixth chain, duplicate identities, stale proofs/versions, and cross-Provider scope fail safely.

### Tests

- [x] T071 [P] [US6] Add failing unit tests for type-specific fields, authoritative registries/currency, holder relationships, no-evidence/redundant-input rules, and role DTOs in `tests/unit/providers/us6-payout-draft-policy.test.ts`
- [x] T072 [P] [US6] Add failing integration tests for Owner/Admin authorization, wallet/IBAN draft/update/submit, masks, recent-auth proof, five slots, duplicates, Staff conflict queue/no-override resolution, and no rail calls in `tests/integration/providers/r1-p06-us6-payout-registration.test.ts`
- [x] T073 [P] [US6] Add failing concurrency tests for sixth active slot, same/cross-Provider fingerprint races, same-chain reuse, operation identity, and one open successor in `tests/integration/providers/r1-p06-us6-payout-concurrency.test.ts`

### Implementation

- [x] T074 [P] [US6] Implement active payout type/country-policy/operator/bank registry reads in `src/modules/providers/infrastructure/prisma-payout-registry.repository.ts`
- [x] T075 [P] [US6] Implement Customer authoritative legal-entity/Owner name adapter with no display-name fallback in `src/modules/customers/infrastructure/prisma-provider-payout-holder.reader.ts`
- [x] T076 [P] [US6] Implement Authentication recent-proof verification facts bound to actor/session/purpose/request in `src/modules/authentication/infrastructure/provider-sensitive-action-proof.verifier.ts`
- [x] T077 [US6] Implement payout chain/claim/fingerprint/version/conflict locks and persistence in `src/modules/providers/infrastructure/prisma-provider-payout.repository.ts`
- [x] T078 [US6] Implement Owner draft creation/update with normalization, complete re-entry, encryption, all-enabled-key fingerprints, exact masks, five slots, and same-Provider chain reuse in `src/modules/providers/provider-payout-destination.service.ts`
- [x] T079 [US6] Implement cross-Provider collision rollback, one safe idempotent Staff conflict case, bounded queue, and reject-or-resolve-after-incumbent-release workflow in `src/modules/providers/provider-payout-conflict.service.ts`
- [x] T080 [US6] Implement proof-bound Owner submission and derived Staff queue/outbox effect in `src/modules/providers/provider-payout-destination.service.ts`
- [x] T081 [US6] Add closed R1-P06 safe Provider email template keys and event-source relations in `src/modules/providers/provider-email-dispatcher.ts`
- [x] T082 [US6] Add strict discriminated wallet/bank draft, update, submit, and list query schemas in `src/modules/providers/provider-payout.schema.ts`
- [x] T083 [US6] Add Owner/Admin role-specific masked payout DTOs and options DTOs in `src/modules/providers/provider-payout.dto.ts`
- [x] T084 [US6] Add Provider payout options/list/detail/create/update/submit/successor endpoints in `src/modules/providers/provider-payout.controller.ts` and `src/modules/providers/providers.routes.ts`

**Checkpoint**: US6 stores no plaintext payout field, contacts no payout rail, and PENDING never satisfies readiness.

---

## Phase 9: User Story 7 — Maintain Primary Destination Readiness (Priority: P1)

**Goal**: Staff decisions, Owner primary changes/removals, and linked successors maintain at most one current approved primary and exact readiness truth.

**Independent Test**: First approval initializes primary; unrelated approval does not replace it; explicit switch, voluntary successor inheritance, Staff challenge, atomic removal replacement, last-primary acknowledgement, and no-auto-failover all match the matrix under concurrency/retry.

### Tests

- [x] T085 [P] [US7] Add failing unit tests for every payout lifecycle/primary/readiness transition and recent-auth boundary in `tests/unit/providers/us7-payout-primary-lifecycle.test.ts`
- [x] T086 [P] [US7] Add failing integration tests for Staff wallet/bank decisions, exact method/note/version/audit, first primary, successor inheritance, challenge, removal, and notifications in `tests/integration/providers/r1-p06-us7-payout-primary.test.ts`
- [x] T087 [P] [US7] Add failing concurrency tests for decision, primary, removal/replacement, successor, and matching retry races in `tests/integration/providers/r1-p06-us7-payout-primary-concurrency.test.ts`

### Implementation

- [x] T088 [P] [US7] Implement primary initialization/switch/clear/restoration eligibility and readiness rules in `src/modules/providers/domain/provider-payout-primary.policy.ts`
- [x] T089 [US7] Implement Staff approve/reject/request-changes/request-replacement/invalidate transactions with safe decision/history/audit/outbox in `src/modules/providers/provider-payout-verification.service.ts`
- [x] T090 [US7] Implement Owner proof-bound explicit primary change and atomic removal/withdrawal workflows in `src/modules/providers/provider-payout-primary.service.ts`
- [x] T091 [US7] Implement voluntary/challenged successor approval, supersession, claim release, and narrowly scoped primary inheritance in `src/modules/providers/provider-payout-verification.service.ts`
- [x] T092 [US7] Add primary singleton, exact-version, decision/history, claim-release, and stable lock-order repository operations in `src/modules/providers/infrastructure/prisma-provider-payout.repository.ts`
- [x] T093 [US7] Add strict Staff decision and Owner primary/removal schemas with meaningful safe reason validation in `src/modules/providers/provider-payout.schema.ts`
- [x] T094 [US7] Add Staff safe payout queue/dossier/decision/conflict queue/conflict resolution and Owner primary/remove endpoints in `src/modules/providers/provider-payout.controller.ts` and `src/modules/providers/providers.routes.ts`
- [x] T095 [US7] Integrate current approved primary truth into the existing readiness projection without changing later gates in `src/modules/providers/domain/provider-readiness.policy.ts`

**Checkpoint**: US7 has exactly one or zero primary and readiness agrees atomically; no automatic failover exists.

---

## Phase 10: User Story 8 — Protect Private Documents and Payout Data (Priority: P1)

**Goal**: Every private surface follows the exact encryption, mask, role projection, audited one-version reveal, durable accepted limit, non-cacheable response, and key-rotation contract.

**Independent Test**: Sentinel scans find no prohibited value outside protected memory/envelopes; only qualified Staff reveals one pending version after accepted audit; six concurrent reveals return exactly five plaintext responses; missing/tampered keys/audit/proofs fail closed; rotation resumes and blocks retirement until zero references plus human approval.

### Tests

- [x] T096 [P] [US8] Add failing unit tests for safe Owner/Admin/Staff/history/audit/outbox projections and sensitive-note rejection in `tests/unit/providers/us8-sensitive-projections.test.ts`
- [x] T097 [P] [US8] Add failing integration tests for exact reveal authorization, same-actor accepted-audit linkage, no-store headers, denied audit, no bulk/reuse/terminal reveal, and forced audit/key/decrypt failures in `tests/integration/providers/r1-p06-us8-payout-reveal.test.ts`
- [x] T098 [P] [US8] Add six-request actor-serialized rolling-window reveal concurrency tests in `tests/integration/admin/r1-p06-reveal-rate-concurrency.test.ts`
- [x] T099 [P] [US8] Add end-to-end forbidden-sentinel scans across DB projections, responses, logs, errors, audit, histories, conflicts, outbox, examples, and fixtures in `tests/integration/providers/r1-p06-us8-leakage-scan.test.ts`
- [x] T100 [P] [US8] Add mixed-key bounded rotation/resume/duplicate/zero-reference/human-retirement tests in `tests/integration/providers/r1-p06-us8-key-rotation.test.ts`

### Implementation

- [x] T101 [P] [US8] Implement Staff step-up proof verification bound to exact reveal purpose/request in `src/modules/authentication/infrastructure/provider-sensitive-action-proof.verifier.ts`
- [x] T102 [US8] Implement Admin-owned per-actor serialized accepted-reveal count-and-audit plus safe denial attempts in `src/modules/admin/infrastructure/prisma-payout-reveal-audit.gate.ts`
- [x] T103 [US8] Extend audit safe-input guards and indexes for payout reveal key IDs without protected material in `src/modules/admin/audit.service.ts`
- [x] T104 [US8] Implement one-version decrypt -> committed audit gate -> no-store response orchestration and same-attempt decision binding in `src/modules/providers/provider-payout-reveal.service.ts`
- [x] T105 [US8] Implement bounded resumable re-encryption/re-fingerprinting, crypto revision, coverage verification, and approval-gated retirement in `src/modules/providers/provider-payout-key-rotation.service.ts`
- [x] T106 [US8] Implement rotation-run/reference-count repository operations without business-version changes in `src/modules/providers/infrastructure/prisma-provider-payout.repository.ts`
- [x] T107 [US8] Add reveal schemas/transient DTO/header handling and Staff reveal endpoint with response-logging bypass in `src/modules/providers/provider-payout.controller.ts` and `src/modules/providers/provider-payout.schema.ts`

**Checkpoint**: US8 proves cryptographic/privacy invariants and never substitutes mask/ciphertext on protected recovery failure.

---

## Phase 11: User Story 9 — Review Complete Audit and Domain History (Priority: P1)

**Goal**: Authorized actors receive chronological safe document/payout history, while every privileged/denied action has immutable minimized audit evidence and no protected payload.

**Independent Test**: All required accepted/denied transitions produce exactly one safe history/audit event with actor/request/version/reason/time; role/cursor boundaries and sentinel exclusions hold; retries create no duplicates.

### Tests

- [x] T108 [P] [US9] Add failing unit tests for safe document/payout history event builders and reason/mask allowlists in `tests/unit/providers/us9-history-safety.test.ts`
- [x] T109 [P] [US9] Add failing integration tests for chronological cursors, role projections, event completeness, denied attempts, idempotency, and forbidden-field absence in `tests/integration/providers/r1-p06-us9-history-audit.test.ts`

### Implementation

- [x] T110 [P] [US9] Implement append-only safe document verification history builder/query policy in `src/modules/providers/provider-verification-history.service.ts`
- [x] T111 [P] [US9] Implement append-only safe payout history builder/query policy in `src/modules/providers/provider-payout-history.service.ts`
- [x] T112 [US9] Add bounded stable-cursor history repository reads and operation-key uniqueness in `src/modules/providers/infrastructure/prisma-provider-verification.repository.ts` and `src/modules/providers/infrastructure/prisma-provider-payout.repository.ts`
- [x] T113 [US9] Integrate minimized denied-attempt audit for cross-scope/high-risk document and payout access in `src/modules/providers/provider-denial-audit.service.ts`
- [x] T114 [US9] Add role-specific verification/payout history DTOs and query schemas in `src/modules/providers/provider-verification.dto.ts` and `src/modules/providers/provider-payout.dto.ts`
- [x] T115 [US9] Add Provider verification and payout history endpoints with bounded cursors in `src/modules/providers/provider-verification.controller.ts`, `src/modules/providers/provider-payout.controller.ts`, and `src/modules/providers/providers.routes.ts`

**Checkpoint**: US9 history is complete and safe, with no full private/envelope/fingerprint values.

---

## Phase 12: User Story 10 — Manage Configurable Verification Policy (Priority: P2)

**Goal**: Active capable Staff maintains draft/published immutable country/kind document policies and current truth re-evaluates all approved Providers without unbounded publication transactions.

**Independent Test**: Staff can create/edit/publish a valid draft with meaningful reason; published rows/items are immutable; future/effective policy selection, new/retired requirements, eligible evidence continuity, bounded activation history, retries, and unauthorized/conflicting publications behave deterministically.

### Tests

- [x] T116 [P] [US10] Add failing unit tests for policy draft/publish rules, effective ordering, immutable items, stable type continuity, and scope re-evaluation in `tests/unit/providers/us10-document-policy-management.test.ts`
- [x] T117 [P] [US10] Add failing integration tests for Staff policy endpoints, authorization/reason/version/idempotency, publication concurrency, immutable rows, and bounded activation in `tests/integration/providers/r1-p06-us10-policy-management.test.ts`

### Implementation

- [x] T118 [P] [US10] Implement policy draft/publish/effective-date validation and current-version selection in `src/modules/providers/domain/provider-document-policy.policy.ts`
- [x] T119 [US10] Implement Staff policy list/create/replace/publish transactions and the human-invoked active-Staff/reason/effective-time EG baseline bootstrap in `src/modules/providers/provider-document-policy.service.ts` and `scripts/bootstrap-r1-p06-policy.ts`
- [x] T120 [US10] Implement policy repositories, one-draft/effective-time indexes, immutable update predicates, and activation cursor persistence in `src/modules/providers/infrastructure/prisma-provider-verification.repository.ts`
- [x] T121 [US10] Implement bounded resumable affected-Provider verification/badge history activation in `src/modules/providers/provider-policy-activation.sweep.ts`
- [x] T122 [US10] Add strict policy/type/item schemas and safe Staff DTOs in `src/modules/providers/provider-verification.schema.ts` and `src/modules/providers/provider-verification.dto.ts`
- [x] T123 [US10] Add Staff policy/type read and policy draft/update/publish endpoints in `src/modules/providers/provider-verification.controller.ts` and `src/modules/providers/providers.routes.ts`
- [x] T124 [US10] Add activation sweep composition and safe operational entry point in `src/server.ts`

**Checkpoint**: US10 changes current requirements predictably while preserving every historical policy/submission/decision meaning.

---

## Phase 13: Polish, Contract Parity, and Phase Gates

**Purpose**: Close cross-story security, documentation, migration, contract, performance, and evidence gates without adding scope.

- [x] T125 [P] Add the implemented R1-P06 OpenAPI document with synthetic safe examples in `docs/apis/openapi/r1-p06-provider-verification-external-payout-destinations.yaml`
- [x] T126 Integrate the R1-P06 OpenAPI document into the runtime aggregate in `src/swagger/openapi.document.ts`
- [x] T127 [P] Add the R1-P06 Postman generator with synthetic values and no secrets in `scripts/generate-r1-p06-postman.ts`
- [x] T128 Generate and validate the R1-P06 collection in `postman/Cleanora-R1-P06.postman_collection.json`
- [x] T129 Update OpenAPI/Postman inventories and generation scripts in `package.json`, `scripts/openapi-validate.ts`, and `scripts/validate-postman.ts`
- [x] T130 [P] Add bounded list/index query-plan and review-queue performance evidence in `tests/integration/providers/r1-p06-performance.test.ts`
- [x] T131 Run and record Prisma validation/generation, SQL review, disposable clean/upgrade migration validation, and constraint probes in `specs/R1-P06-provider-verification-external-payout-destinations/implementation-summary.md`
- [x] T132 Run and record focused tests, unit/integration/coverage, typecheck, lint, build, OpenAPI, Postman, and docs gates in `specs/R1-P06-provider-verification-external-payout-destinations/implementation-summary.md`
- [x] T133 Run and record the forbidden-sentinel privacy scan plus key/scanner/audit readiness evidence in `specs/R1-P06-provider-verification-external-payout-destinations/implementation-summary.md`
- [x] T134 Review the complete implementation diff for module-boundary, future-phase, payout-execution, stored-value, Docker/cloud, and destructive-scope violations and record findings in `specs/R1-P06-provider-verification-external-payout-destinations/implementation-review-report.md`
- [x] T135 Reconcile runtime API/DTO/state evidence with every FR/SC and record the traceability matrix in `specs/R1-P06-provider-verification-external-payout-destinations/implementation-summary.md`
- [x] T136 Update `docs/product/current.md` to request human validation only after every task/evidence gate passes; do not mark R1-P06 Complete without explicit owner approval
- [x] T137 Perform the documented implementation quickstart acceptance journeys and record truthful results/limitations in `specs/R1-P06-provider-verification-external-payout-destinations/completion-report.md`

**Final implementation checkpoint**: all 137 tasks and checklists complete, no forbidden scope, all required evidence recorded, and human owner decides whether the phase is complete. Implementation does not authorize Git, deployment, production migration/configuration, or R1-P07.

---

## Dependencies and Execution Order

### Phase Dependencies

- Phase 1 Setup has no product dependency.
- Phase 2 Foundation depends on Setup and blocks every story.
- US1 can complete after Foundation.
- US2 depends on Foundation and the effective policy fixtures; it does not depend on US1 behavior.
- US3 depends on US2's submitted document capability.
- US4 depends on US2 and US3 document version/review foundations.
- US5 depends on US1–US4 truth producers.
- US6 depends on Foundation only and may proceed in parallel with US1–US5 after shared migration/contracts stabilize.
- US7 depends on US6 destination drafts/submission.
- US8 depends on US6–US7 protected persistence/review and Foundation crypto/audit contracts.
- US9 depends on document and payout history producers from US2–US8.
- US10 depends on the US2 policy model but may proceed alongside US3/US4 once repository contracts stabilize.
- Polish depends on all 10 desired story checkpoints.

### User Story Graph

```text
Foundation
|-- US1 --------------------\
|-- US2 -> US3 -> US4 -> US5 +--> US9 --> Polish
|          \-> US10 --------/
`-- US6 -> US7 -> US8 ------/
```

### Within Each Story

1. Add focused failing tests and establish the expected gap.
2. Implement domain policy/value objects.
3. Implement repository/public adapters and transaction service.
4. Implement schemas/DTOs/controllers/routes.
5. Run the story's independent tests and all previously completed story regressions.

## Parallel Opportunities

- T002–T006 target independent fixture/catalog/docs files.
- T008–T012 can be authored in parallel; T017–T020 can follow in parallel after their expected failures are established.
- US1 and US6 domain work can proceed in parallel after Foundation because document exemption and payout registration touch different services.
- In US2, Media policy/adapter work can proceed alongside Providers policy/repository work after the public Media contract is stable.
- US3 audit/catalog work can proceed alongside review query/service tests.
- US5 projection work and US10 policy-management work can proceed alongside the payout US7/US8 branch after shared repositories stabilize.
- OpenAPI, Postman generator, performance evidence, and review documentation can be prepared in parallel only after runtime route/DTO names are final.

## Parallel Execution Examples

### US2

```text
T034 document-policy unit tests
T035 Media evidence unit tests
T036 Provider document integration tests
```

After those tests establish failures:

```text
T037 Media evidence policy
T041 Providers policy repository reads
```

### US6

```text
T071 payout draft policy tests
T072 payout registration integration tests
T073 payout concurrency tests
```

After contracts stabilize:

```text
T074 payout registry repository
T075 Customers legal-name adapter
T076 Authentication recent-proof verifier
```

### US8

```text
T096 safe-projection unit tests
T097 reveal integration tests
T098 reveal concurrency tests
T099 leakage scan
T100 rotation tests
```

## Implementation Strategy

### MVP First

The smallest demonstrable increment is Foundation + US1: it proves the R1-P06 readiness extension is backward-compatible and that Individual Teams gain no document burden. It is not the phase Definition of Done and must not be deployed/declared complete alone.

### Incremental Delivery

1. Foundation + US1 exemption.
2. US2–US5 complete the full document/policy/badge branch.
3. US6–US8 complete payout registration/primary/security.
4. US9 closes safe history/audit across both branches.
5. US10 closes Staff policy maintenance/effective re-evaluation.
6. Polish closes migration/API/Postman/privacy/performance/evidence gates.

### Safety Stops

Stop and escalate rather than invent behavior if implementation discovers an absent authoritative operator/bank manifest, incompatible legal-name fact, unsafe scanner/storage limitation, key-ring inconsistency, migration target ambiguity, or product requirement conflict. Never bypass uniqueness, audit-before-reveal, secret validation, Media ownership, or exact Provider membership.

## Format Validation

All implementation entries use `- [ ] Tnnn [P?] [USn?] description with exact path`; task IDs are continuous T001–T137, story labels appear only in story phases, and each story contains independent test criteria plus test-first tasks.
