# Implementation Plan: R1-P06 Provider Verification & External Payout Destinations

**Branch**: `codex/r1-p06-provider-verification-payout-destinations` (created on 2026-08-22 for the explicitly authorized Git handoff; planning originally occurred on the observed R1-P05 checkout before Git authorization)
**Date**: 2026-08-13
**Spec**: [spec.md](./spec.md)
**Input**: Clarified R1-P06 specification with 166 functional requirements, 42 success criteria, and 12 owner-approved clarification decisions.

## Summary

R1-P06 extends the existing Providers module with two independent post-approval capabilities:

1. effective-dated Registered Company document policy, private evidence submission, immutable Staff review, derived `documentsVerified`, and protected verification-badge truth; and
2. Mobile Wallet and IBAN-first Bank Account destination registration, manual Staff verification, one explicit global primary, derived `payoutDestinationReady`, strict versioned lifecycle handling, and field-level protection of full identifiers and holder names.

Providers owns the business records, state machines, readiness projections, transactions, histories, policy catalogs, payout registries, and durable notification intents. Authentication, Customers, Configuration, Media, and Admin Audit retain their existing data ownership and are consumed only through purpose-specific public contracts. Full payout values are encrypted before persistence with AES-256-GCM, duplicate identities use a separate versioned HMAC-SHA-256 key ring, ordinary outputs are masked, and one pending destination may be revealed only through the audited Staff verification workflow. No payout execution, settlement, internal wallet, public marketplace eligibility, Docker/cloud deployment, or future-phase behavior is introduced.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node.js 24+
**Primary Dependencies**: Express 5.2, Zod 4.4, Prisma 7.9, `@prisma/adapter-pg` 7.9, PostgreSQL, Multer 2.2, Sharp 0.35, Cloudinary 2.10, Nodemailer 9, `rate-limiter-flexible` 7.1; a fail-closed document malware-scanner adapter and PDF structural validator are phase implementation dependencies selected behind Media-owned ports
**Storage**: PostgreSQL for Providers-owned policy, document, payout, history, outbox, and key-rotation metadata; Media-owned private Cloudinary objects for document bytes; externally supplied process secret configuration for key rings
**Testing**: Vitest 4.1, Supertest 7.2, Prisma-backed integration tests, isolated deterministic cryptography/media/auth/audit test doubles, clean-migration validation
**Target Platform**: Existing Cleanora modular-monolith API runtime; no new deployable service
**Project Type**: Backend modular monolith with protected Provider and Staff HTTP APIs
**Performance Goals**: bounded cursor pages (default 20, maximum 100); five-chain Provider payout cap; reveal rate no more than five accepted reveals per Staff actor in a rolling 10-minute window; bounded key-rotation batches; no external file, email, scanner, or Cloudinary I/O while a database transaction is open
**Constraints**: exact-version optimistic concurrency; matching retries idempotent; safe 409 conflicts; immutable submitted evidence/decisions/history; full payout values absent from logs, errors, audit payloads, history, and ordinary responses; accepted reveal audit commits before plaintext is returned; no default cryptographic keys; no database or product implementation during this planning run
**Scale/Scope**: one active R1 phase, one existing Providers module, two document types at launch, two payout destination types, country-scoped policy/operator/bank registries, nine payout states, and the existing two Provider readiness gates owned by R1-P06

## Constitution Check

### Pre-research gate

| Principle | Result | Evidence / design consequence |
|---|---|---|
| Standalone greenfield product | PASS | All authority comes from this repository; no other schema, service, or migration history is assumed. |
| One active phase and traceability | PASS | R1-P06 is the sole active phase and every planned artifact traces to `spec.md`, DEC-037, roadmap, and the current pointer. |
| Modular ownership | PASS | Providers owns R1-P06 business persistence; other modules expose narrow public contracts and no foreign persistence is queried directly. |
| Incremental migration | PASS | A single additive, forward-only, phase-owned migration is planned; applied migrations remain immutable. |
| Canonical truth / no invention | PASS | The 12 accepted decisions govern; UX references are non-authoritative and discrepancies are documented. |
| Backend authority and security | PASS | Identity, country, membership, legal names, versions, key IDs, lifecycle, readiness, and audit facts are server-authoritative. |
| Testing evidence | PASS | Unit, contract, integration, concurrency, clean-migration, privacy, and operational validation are specified before implementation. |
| Human control | PASS | Staff decisions, policy publication, conflict resolution, key retirement, phase completion, Git, deployment, and production actions remain human-controlled. |
| Release boundaries | PASS | No Docker/cloud work, public browsing, payout execution, stored-value wallet, or later-phase capability is planned. |
| Immutable phase migrations | PASS | No applied SQL is edited; any correction after application would require a separate forward migration. |

No constitution violation requires a complexity exception.

## Architecture and Ownership

### Module map

| Module | R1-P06 responsibility |
|---|---|
| `providers` | Own document and payout policy catalogs, registries, chains/versions, decisions, histories, primary selection, readiness/badge derivation, conflict cases, notification intents, key-rotation progress, APIs, and transaction boundaries. |
| `media` | Own private evidence bytes, upload lifecycle, content/signature validation, malware scan, image normalization/metadata removal, PDF safety/page-count validation, Cloudinary storage keys, and signed private delivery. |
| `authentication` | Own active principal/session facts, recent Owner re-authentication proof (10 minutes), Staff payout-verification capability, Staff step-up proof (5 minutes), and fail-closed proof consumption. |
| `customers` | Supply the authoritative company legal-entity name or exact active Owner legal name through a purpose-scoped reader; Providers never queries customer tables. |
| `configuration` | Supply authoritative active country/currency facts; business-specific document policies, operator records, and bank records remain Providers-owned. |
| `admin` | Own business-neutral privileged/denial audit evidence and an atomic accepted-reveal audit/rate gate; audit records contain safe facts only. |
| composition root | Wire public contracts, repositories, cryptographic adapters, clocks, key rings, outbox worker, and Media scanner/Cloudinary adapters. |

No new domain module is justified. R1-P06 is a cohesive extension of the Providers domain completed in R1-P05.

### Providers application services

Use separate orchestration services so document and payout workflows remain independently testable:

- `ProviderDocumentPolicyService`: draft, edit, publish, resolve effective policy, and re-evaluate scope.
- `ProviderDocumentService`: create/edit draft, bind Media evidence, submit, create successor, list/detail/history.
- `ProviderDocumentReviewService`: Staff queue, dossier, approve/reject/request replacement/invalidate, expiry processing.
- `ProviderVerificationProjectionService`: `documentsVerified`, blocker codes, and protected badge truth.
- `PayoutRegistryService`: read Staff-maintained destination types, operators, banks, and country currency policy.
- `ProviderPayoutDestinationService`: create/edit masked drafts, submit, create successor, withdraw/remove, list/detail/history.
- `ProviderPayoutVerificationService`: Staff queue, audited reveal, approve/reject/request correction/replacement/invalidate, duplicate-conflict resolution.
- `ProviderPrimaryPayoutService`: first-approval initialization, explicit Owner primary change, atomic replacement on removal, and readiness derivation.
- `PayoutKeyRotationService`: bounded resumable re-encryption/re-fingerprinting, reference counts, verification, and human-approved retirement evidence.
- `ProviderNotificationOutboxWorker`: lease, render localized safe templates, deliver, retry, and store only safe failure codes.

### Public module contracts

Providers consumes only the interfaces defined in [module-public-contracts.md](./contracts/module-public-contracts.md):

- Authentication: active principal facts, recent re-authentication/step-up proof verification, Staff capability checks.
- Configuration: active country and configured currency facts.
- Customers: authoritative legal names for the selected holder relationship.
- Media: staged private document evidence, current processing status, protected delivery, cleanup request.
- Admin Audit: privileged decision writes, denied-attempt writes, and accepted reveal audit/rate gate.

Providers extends its own public readiness contract with authoritative `documentsVerified`, `payoutDestinationReady`, and badge truth without changing the ten R1-P05 completion checks or granting later-phase eligibility.

### Transaction ownership

Providers owns every R1-P06 business transaction. The exact boundaries and lock order are specified in [transaction-boundaries.md](./contracts/transaction-boundaries.md). Core rules:

1. authorize and validate slow/external facts before opening a transaction;
2. lock the `Provider` row first, then chain/version/primary/claim rows in stable ID order;
3. re-read application approval, membership/capability facts that can be represented transactionally, expected versions, policy/registry state, and duplicate claims;
4. write state, immutable decision/history/audit intent, readiness effect, and email outbox rows atomically;
5. commit before Media delivery, email, Cloudinary, malware scanning, or external operational action;
6. treat matching request/idempotency keys as the prior success and return 409 for stale or competing commands.

Accepted payout reveal is a deliberate two-stage security flow: authorization and decryption preparation occur without returning data; Admin Audit atomically enforces the rolling rate and commits the accepted audit; only after that commit may the controller return one non-cacheable plaintext response. Any failure returns no protected value.

## HTTP API Design

The normative surface is [provider-verification-api.md](./contracts/provider-verification-api.md) and [provider-verification-api.openapi.yaml](./contracts/provider-verification-api.openapi.yaml). All routes use `/api/v1`, strict Zod objects, the repository response envelopes, stable safe error codes, bounded cursor pagination, and no public route.

### Provider document routes

- `GET /providers/{providerId}/verification`
- `GET /providers/{providerId}/verification/document-requirements`
- `GET|POST /providers/{providerId}/verification/documents`
- `GET|PUT /providers/{providerId}/verification/documents/{documentVersionId}`
- `POST /providers/{providerId}/verification/documents/{documentVersionId}/evidence`
- `PUT /providers/{providerId}/verification/documents/{documentVersionId}/evidence-order`
- `POST /providers/{providerId}/verification/documents/{documentVersionId}/submit`
- `POST /providers/{providerId}/verification/documents/{documentVersionId}/successors`
- `GET /providers/{providerId}/verification/history`

Only active exact-Provider `OWNER` or `ADMIN` members may use these protected routes, and only after application approval. Submitted metadata/evidence is immutable.

### Staff document/policy routes

- `GET /staff/providers/verification/document-types`
- `GET|POST /staff/providers/verification/document-policies`
- `PUT /staff/providers/verification/document-policies/{policyVersionId}`
- `POST /staff/providers/verification/document-policies/{policyVersionId}/publish`
- `GET /staff/providers/verification/documents`
- `GET /staff/providers/{providerId}/verification/documents/{documentVersionId}`
- `POST /staff/providers/{providerId}/verification/documents/{documentVersionId}/decisions`

The two launch document-type definitions are configurable persisted records and
are read while authoring policy, but R1-P06 does not invent a generic type-
mutation API beyond the owner-approved policy-version workflow. Published policy
versions and review decisions are immutable. Staff evidence reads use Media-
signed private delivery and never expose storage keys.

### Provider payout routes

- `GET /providers/{providerId}/payout-destination-options`
- `GET|POST /providers/{providerId}/payout-destinations`
- `GET|PUT /providers/{providerId}/payout-destinations/{destinationVersionId}`
- `POST /providers/{providerId}/payout-destinations/{destinationVersionId}/submit`
- `POST /providers/{providerId}/payout-destinations/{destinationVersionId}/successors`
- `POST /providers/{providerId}/payout-destinations/{destinationVersionId}/remove`
- `PUT /providers/{providerId}/payout-destinations/primary`
- `GET /providers/{providerId}/payout-destination-history`

Only the active exact Owner may mutate. An active exact Admin receives the reduced masked DTO. Identifiers are write-only even for drafts; changing one requires complete re-entry. Re-authentication proof is required for submission, successor submission, primary change, withdrawal, and removal, not for masked reads or draft editing.

### Staff payout routes

- `GET /staff/providers/payout-destinations`
- `GET /staff/providers/{providerId}/payout-destinations/{destinationVersionId}` (safe dossier only)
- `POST /staff/providers/{providerId}/payout-destinations/{destinationVersionId}/reveal`
- `POST /staff/providers/{providerId}/payout-destinations/{destinationVersionId}/decisions`
- `GET /staff/providers/payout-destination-conflicts`
- `POST /staff/providers/{providerId}/payout-destination-conflicts/{conflictId}/resolve`

Reveal accepts a meaningful reason and fresh step-up proof, returns exactly one pending version, sets `Cache-Control: no-store, private`, and never supports bulk use. Decisions accept an exact expected version, verification method, outcome, and meaningful note; actual wallet/bank lookup or transfer-start remains a manual Staff procedure outside Cleanora.

## Persistence and Migration Strategy

The proposed additive model is defined in [data-model.md](./data-model.md) and the SQL sequencing/validation in [migration-plan.md](./migration-plan.md).

The implementation phase will create exactly one new migration directory:

```text
prisma/migrations/r1_p06_provider_verification_external_payout_destinations/
  migration.sql
```

Planned changes:

- add document, payout, decision, relationship, policy, verification-method, and key-rotation enums;
- add Providers-owned document type/policy/item, document chain/version/evidence/review/history tables;
- add payout type/operator/bank registry tables;
- add payout chain/version/identity-claim/fingerprint/decision/conflict/history/primary/key-rotation tables;
- extend `MediaOwnerType` for private Provider document pages and `ProviderEmailTemplate` for safe R1-P06 events;
- add nullable R1-P06 context to the existing Provider outbox while retaining its worker semantics;
- add indexes, partial unique indexes, shape checks, positive-version checks, nonblank-reason checks, active-claim uniqueness, and immutable-history protections that Prisma cannot express;
- seed only the owner-approved baseline catalogs/policies/role capability records through the repository seed path, idempotently and after schema deployment.

There is no destructive rewrite or mandatory backfill of existing Provider rows. New readiness facts are derived: Individual Teams get `documentsVerified = NOT_REQUIRED`; Registered Companies without evidence are incomplete; all Providers without an approved active primary destination fail `payoutDestinationReady`. Applied migrations are untouched.

## Document Evidence Pipeline

1. Providers authorizes the active exact member and confirms application approval.
2. Media receives one multipart file at a time with a purpose-bound reservation.
3. Media checks byte limit, magic/signature, decoded structure, allowed format, malware result, PDF encryption/active content/page count, image decode/orientation/metadata, and per-document aggregate constraints supplied by Providers.
4. Media stores private bytes only after validation, with `image/jpeg` accepting both `.jpg` and `.jpeg`; names/extensions never establish type.
5. Providers binds returned Media references and ordered positions to a draft document version in a short transaction.
6. Submission re-reads every Media status through the public contract and succeeds only when the complete one-PDF or 1–10-image set is `READY` and within aggregate limits.
7. Staff obtains short-lived signed delivery only from the protected dossier; keys and unsigned URLs never cross the Media contract.

PDF and image formats never mix in one document version. Failed, missing, re-ordered, non-ready, or unsafe evidence yields no verification credit.

## Sensitive Payout Data and Operations

The normative design is [security-design.md](./security-design.md) and [operations-runbook.md](./operations-runbook.md).

- Encrypt wallet number, IBAN, and holder legal name independently using AES-256-GCM with a unique 96-bit random nonce and AAD containing Provider ID, destination chain/version IDs, type, field, and encryption key ID.
- Persist only ciphertext, nonce, tag, key ID, exact approved mask components, and allowed routing/status fields. Never persist plaintext or use ciphertext for equality.
- Use separate domain-separated HMAC-SHA-256 lookup fingerprints under every enabled lookup-key version. A unique active-claim index makes competing claims deterministic; cross-Provider collisions create a safe Staff conflict case and never disclose the incumbent.
- Owner DTOs may include operator/bank label, relationship, and authorized current holder name; Admin DTOs omit holder name; every identifier is masked after write.
- Staff reveal is one request, one Provider, one exact pending version, one purpose, one fresh step-up, one meaningful reason, and one response. Allowed and denied attempts create safe audit evidence.
- Four declared key-ring environment values have no defaults. Startup/readiness fail closed for malformed, weak, reused, unknown, or inconsistent key IDs.
- Rotation activates new encryption and lookup keys for writes, keeps prior keys read/compare-only, checks duplicates across all enabled lookup keys, processes bounded resumable batches, verifies zero references, and requires explicit human approval before retirement.

## Readiness, Badge, and Lifecycle Truth

- `documentsVerified`: `NOT_REQUIRED` and satisfied for `INDIVIDUAL_TEAM`; for `REGISTERED_COMPANY`, satisfied only while each active required type in the current effective country/kind policy has an effective approved unexpired/unchallenged document version.
- badge: `NOT_ELIGIBLE` for Individual Teams; `EARNED` exactly when an approved Registered Company has satisfied document truth; otherwise `NOT_EARNED`. Suspension does not rewrite the badge.
- `payoutDestinationReady`: satisfied only when the Provider primary reference identifies a current active `APPROVED` destination version.
- Neither gate makes a Provider `LIVE`, publicly browseable, payable, or finally marketplace eligible.

The complete document and payout state matrices appear in [data-model.md](./data-model.md). State changes are exact-versioned and every accepted change writes immutable safe history. Voluntary successor review preserves an unchallenged predecessor; Staff challenge removes readiness immediately. First payout approval becomes primary only when no primary exists; later unrelated approvals never auto-promote. Staff invalidation clears a challenged primary without automatic failover.

## Authorization, Privacy, Audit, and Failure Semantics

- Recheck active identity, application approval, exact membership, Staff role/capability, proof age, country, registry activity, and target version server-side.
- Provider document authority is `OWNER|ADMIN`; Provider payout mutation is `OWNER` only; payout Admin reads use a deliberately smaller DTO.
- Cross-Provider reads/mutations fail closed with the same safe not-found/forbidden shape.
- Meaningful reasons are trimmed, length-bounded, and required for Staff decisions, policy publication, conflict resolution, key retirement, reveal, and destructive Owner payout operations.
- Audit/history use allowlisted before/after state codes, IDs, versions, safe masks when expressly allowed, request IDs, actor IDs, and key IDs. They exclude plaintext, ciphertext, nonce, tag, fingerprints, storage keys, signed URLs, raw proofs, tokens, and arbitrary request bodies.
- Standard responses use 400 validation, 401 unauthenticated/stale proof, 403 inactive or unauthorized capability, safe 404 scoped resource, 409 stale/state/cardinality/duplicate conflict, 413 upload size, 415 unsupported media, 422 unsafe/invalid evidence or normalized identifier, 429 reveal rate, and 503 fail-closed key/scanner/audit dependency errors.

## Testing Strategy

The complete evidence matrix is [test-strategy.md](./test-strategy.md). Minimum gates include:

- unit tests for policy resolution, both lifecycle matrices, effective-version continuity, badge/readiness, masking, normalization, AAD construction, encryption envelopes, HMAC domain separation, key-ring parsing, rotation, and DTO redaction;
- public-contract tests for Authentication proof/capability facts, Customers legal-name facts, Configuration country/currency facts, Media state/delivery, and Admin accepted-reveal audit/rate semantics;
- repository integration tests for every partial unique/check constraint, five-chain concurrency, one-successor concurrency, one-primary concurrency, active fingerprint claim collision, decision idempotency, and outbox uniqueness;
- API tests for Owner/Admin/Staff matrices, strict bodies, safe errors, pagination, non-cacheable reveal, no bulk reveal, masked outputs from draft onward, and `.jpg`/`.jpeg` `image/jpeg` acceptance;
- document tests for PDF/image exclusivity, page/byte aggregates, file signatures, malformed/encrypted/active PDF rejection, metadata stripping, malware fail-closed behavior, and non-READY submission denial;
- full privacy scans of logs, errors, audit, histories, fixtures, snapshots, OpenAPI examples, and notification payloads;
- migration validation on a disposable clean database plus upgrade from the current R1-P05 schema, SQL review, seed idempotency, Prisma validation/generation, typecheck, lint, tests, coverage, OpenAPI validation, Postman validation, and `docs:check`.

Database-backed suites must run in bounded, non-overlapping waves against the shared proof database.

## UX and Reference Reconciliation

[ux-design.md](./ux-design.md) converts the nine attached images and seven repository v2 references into backend-owned states, capabilities, accessible behaviors, and page-to-API mappings. The images are visual aids only. Canonical corrections include:

- only Owner mutates payout destinations; Admin has masked status read only;
- bank entry is IBAN-first and does not ask for separate account number, branch, or free-text SWIFT/BIC;
- operator/bank values come from active country-scoped registries and are never inferred/free text;
- pending destinations cannot be primary and a create-time checkbox cannot bypass lifecycle rules;
- document and payout work proceed independently after application approval;
- exact masks follow the clarified wallet/IBAN rules;
- Company metadata includes all five required fields plus optional expiry;
- no ownership-evidence upload exists for wallet or bank destinations;
- R1-P06-ready does not mean Provider `LIVE`, public, payable, or phase Complete.

## Project Structure

### Documentation

```text
specs/R1-P06-provider-verification-external-payout-destinations/
|-- activation.md
|-- spec.md
|-- plan.md
|-- research.md
|-- data-model.md
|-- migration-plan.md
|-- security-design.md
|-- ux-design.md
|-- test-strategy.md
|-- operations-runbook.md
|-- quickstart.md
|-- contracts/
|   |-- README.md
|   |-- module-public-contracts.md
|   |-- provider-verification-api.md
|   |-- provider-verification-api.openapi.yaml
|   `-- transaction-boundaries.md
|-- checklists/
|   `-- [requirements plus focused planning checklists]
|-- tasks.md                    # created only by speckit-tasks
`-- implementation-prompt.md    # created only after analyze is clean
```

### Expected implementation placement

```text
src/
|-- config/
|   `-- payout-data-keys.ts
|-- modules/
|   |-- authentication/     # authentication.public.ts plus proof/capability adapters
|   |-- customers/          # customers.public.ts plus legal-name reader adapter
|   |-- media/
|   |   |-- [verification evidence service/schema/public additions]
|   |   |-- infrastructure/
|   |   `-- domain/
|   |-- admin/
|   `-- providers/
|       |-- [R1-P06 services/controllers/schemas/dtos/routes]
|       |-- domain/
|       |-- infrastructure/
|       `-- providers.public.ts
|-- routes/
`-- server.ts

prisma/
|-- schema.prisma
|-- migrations/r1_p06_provider_verification_external_payout_destinations/
`-- seed.ts

tests/
|-- unit/providers/
|-- unit/media/
|-- integration/providers/
|-- integration/media/
|-- integration/admin/
`-- helpers/
```

**Structure Decision**: extend the existing modular-monolith folders; do not create a new deployable, payout executor, ledger, wallet service, or generic shared business layer.

## Post-design Constitution Re-check

All ten pre-research gates remain PASS after the data, API, security, UX, migration, test, and operations designs:

- ownership remains explicit and cross-module reads use public contracts;
- transactions are Providers-owned, short, versioned, and free of external I/O;
- the migration is additive and phase-owned;
- privacy, audit-before-reveal, key fail-closed behavior, and immutable evidence are designed as acceptance gates;
- no R1-P07+, payout-execution, stored-value, Docker/cloud, Git, deployment, or production work enters scope;
- Staff and human approvals remain authoritative and are never replaced by automation.

## Complexity Tracking

No constitutional exception is required. The number of tables is driven by immutable versioning, policy effective dating, independent cryptographic lookup/encryption rotation, active-claim conflict handling, and durable audit/history/outbox evidence; collapsing these concepts would weaken explicit accepted requirements.

## Phase Outputs

This `speckit-plan` stage produces `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, API/public-contract/transaction artifacts, plus the phase-owned migration, security, UX, test, and operations designs. It does not create `tasks.md`, edit Prisma, create a migration, implement code/tests, run a database, or perform Git actions.

## Next Gate

Run the mandatory Companion after-plan hook, then focused specification-quality checklists. Only after those pass may `speckit-tasks` create `tasks.md`; after the mandatory after-tasks hook, run `speckit-analyze` and remediate documentation until clean. Stop before implementation.
