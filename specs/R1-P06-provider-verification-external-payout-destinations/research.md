# Phase 0 Research — R1-P06 Provider Verification & External Payout Destinations

**Date**: 2026-08-13
**Status**: Complete for technical planning
**Authority**: [spec.md](./spec.md), DEC-037, R1-P06 roadmap, repository architecture/security/testing rules, and the existing R1-P05 implementation contracts

Each question records a technical decision, its rationale, and rejected alternatives. No item below reopens an owner-approved product decision.

## RQ-01 — Which module owns R1-P06 business behavior?

**Decision**: Extend `src/modules/providers`. Providers owns document policies and evidence associations, payout registries and destinations, state machines, Staff decisions, histories, readiness/badge projections, primary truth, duplicate claims, and notification intents.

**Rationale**: These records describe one Provider's qualification and external settlement target and directly extend the R1-P05 Provider aggregate. Keeping transaction ownership in Providers prevents split-brain readiness and allows atomic version/history/outbox updates.

**Rejected**: a new Verification module (unnecessary boundary and circular Provider readiness dependency); Configuration owning business-specific policies/registries (Configuration owns generic country/config facts, not Provider verification behavior); Media owning document metadata (Media owns files only).

## RQ-02 — When are Provider-specific capabilities available?

**Decision**: Every command first requires authoritative `Provider.applicationStatus = APPROVED`. Operational `SUSPENDED` does not block authorized remediation or Staff review. Application DRAFT, PENDING_REVIEW, CHANGES_REQUESTED, and REJECTED deny creation/submission/review/mutation.

**Rationale**: This exactly preserves the accepted timing rule while keeping application and verification workflows independent after approval.

**Rejected**: beginning document/payout work during onboarding; making operational LIVE a prerequisite; allowing R1-P06 to activate a Provider.

## RQ-03 — How is document policy represented and resolved?

**Decision**: Use Providers-owned stable document types plus immutable, effective-dated policy versions scoped by active `countryId` and `ProviderKind`. Staff edits only DRAFT versions. Publish records actor, reason, timestamp, and future/present `effectiveAt`; the current version is the latest published version with `effectiveAt <= now`. Policy items carry required/active flags and field/evidence rules.

**Rationale**: Effective dating supports deterministic re-evaluation and preserves prior meaning. Stable type codes let eligible evidence continue when the requirement remains unchanged.

**Rejected**: mutable rows with no version; JSON-only country config; copying requirements onto each Provider; automatically rewriting historical decisions.

## RQ-04 — How is document immutability and continuity implemented?

**Decision**: Separate a logical `ProviderDocumentChain` from immutable `ProviderDocumentVersion` rows. DRAFT data may change with exact version checks. Submission freezes metadata, policy snapshot, and ordered Media references. Every correction/renewal/replacement is a linked successor. The chain records the currently effective approved version when one exists.

**Rationale**: A stable chain supports one requirement over time while immutable versions preserve review evidence and risk-aware continuity.

**Rejected**: editing submitted rows; overwriting Media references; hard deletion; replacing an approved predecessor as soon as a voluntary draft is created.

## RQ-05 — How are private files uploaded and reviewed?

**Decision**: Media exposes a purpose-specific Provider-verification evidence port. It validates byte signatures and decoded content, scans malware, strips unsafe image metadata, normalizes orientation, validates safe non-encrypted/active-content-free PDFs, stores private objects, and returns opaque Media IDs/status. Providers stores only ordered associations. Staff gets short-lived signed delivery through Media.

**Rationale**: Bytes, storage lifecycle, storage keys, and delivery are already Media-owned. Opaque references let Providers enforce completeness without crossing persistence boundaries.

**Rejected**: Providers querying `media_files`; trusting filename/MIME; public Cloudinary URLs; mixing PDF and images; storing uploaded ownership evidence for payout destinations.

## RQ-06 — How does the Cloudinary adapter handle JPEG and PDF?

**Decision**: Accept `image/jpeg` after signature/decode validation regardless of `.jpg` or `.jpeg`; normalize with Sharp and upload as a private image resource. Accept validated `application/pdf` as a private authenticated/raw document resource. `image/png` is the other image type. The adapter receives validated bytes and canonical content type from Media, never caller extension authority.

**Rationale**: This directly covers the accepted `.jpg` requirement and keeps transformation/delivery appropriate to file type.

**Rejected**: extension allowlists as the security check; treating PDF as an image; public delivery; sending unscanned original image metadata to storage.

## RQ-07 — How are document truth and badge truth derived?

**Decision**: Resolve the current effective policy and test each active required type for an effective `APPROVED` version that is not expired, invalidated, challenged, or superseded. Individual Teams produce satisfied `documentsVerified = NOT_REQUIRED` and `badge = NOT_ELIGIBLE`. Approved Registered Companies produce `EARNED` exactly while all requirements are met, otherwise `NOT_EARNED`.

**Rationale**: Derivation avoids stale boolean truth. Policy changes and authoritative time expiry take effect without rewriting history.

**Rejected**: persisted manually toggled verification flags; letting suspension erase document truth; granting a badge to Individual Teams; allowing the badge to imply public eligibility.

## RQ-08 — How are payout destinations modeled?

**Decision**: Separate logical chains, immutable versions, encrypted field envelopes, identity claims/fingerprints, decisions, history, and Provider primary selection. DRAFT is editable and identifiers are write-only after each accepted write; PENDING and later details are immutable. Successors create new versions.

**Rationale**: The model supports nine states, voluntary continuity, Staff challenge, exact-version conflicts, encryption rotation, and one global primary without editing history.

**Rejected**: one mutable payout row; storing a generic JSON details object; separate wallet/bank aggregates with divergent lifecycle logic; creating an internal wallet/balance.

## RQ-09 — How are wallet and IBAN identifiers normalized?

**Decision**: Normalize wallet input to E.164 after confirming its country calling code is compatible with the Provider's authoritative country. Normalize IBAN by Unicode-safe ASCII validation, removing permitted spaces, uppercasing, validating country length and MOD-97, and confirming its country prefix matches the Provider country. Operator and bank are resolved only from active country-scoped registries. `EG` Bank Account accepts configured `EGP`.

**Rationale**: Canonical input is required before HMAC, mask, and duplicate enforcement.

**Rejected**: inferring wallet operator from prefix; accepting bank/operator names as free text; separate domestic account/branch/SWIFT inputs when IBAN and registry suffice; matching the wallet to Authentication phone.

## RQ-10 — How is duplicate identity enforced without deterministic encryption?

**Decision**: Compute domain-separated HMAC-SHA-256 under every enabled lookup-key version. Persist fingerprints only in protected lookup rows linked to an identity claim. Active claims have unique `(lookupKeyId, fingerprint)` indexes. A same-chain successor may reuse a claim; a changed value creates a new claim. Released claims remain searchable within their Provider so reuse continues the original chain rather than creating a duplicate chain. A cross-Provider collision creates a safe idempotent conflict case without creating a second active claim or exposing the incumbent. Staff resolves the case by rejecting the candidate or using the ordinary audited invalidation/release flow before Owner retry; no uniqueness bypass exists.

**Rationale**: HMAC supports equality without reversible or enumerable plaintext. Multiple fingerprints preserve uniqueness during rotation.

**Rejected**: ciphertext equality; raw hashes vulnerable to enumeration; operatorCode in wallet identity; Provider-scoped uniqueness only; an administrative force override that allows concurrent claims.

## RQ-11 — What is the cryptographic envelope?

**Decision**: Independently encrypt each identifier and holder legal name with AES-256-GCM, a cryptographically random 96-bit nonce, a 128-bit tag, and AAD over Provider ID, chain ID, version ID/number, type, field name, and encryption key ID. Store ciphertext/nonce/tag/key ID in explicit columns and safe mask components separately.

**Rationale**: Per-field envelopes allow narrow reveal, field-specific AAD, bounded rotation, and corruption/failure isolation.

**Rejected**: application-wide database plaintext; one nonce per destination; deterministic encryption; keys stored in PostgreSQL; encrypted JSON blobs that hide field/version references.

## RQ-12 — How do key configuration and rotation work?

**Decision**: Parse the four owner-approved environment settings into independent versioned key rings with no defaults. Require decoded keys of at least 32 bytes, exactly one active key per ring, different key material across purposes, and availability of every persisted referenced key. New writes use active IDs; reads compare/decrypt with retained IDs. A Provider-owned rotation run tracks bounded batches, cursors, counts, safe errors, verification, and human approval. Retirement is blocked until zero references are proven.

**Rationale**: This makes rotation resumable and operationally auditable while cloud secret management remains deferred.

**Rejected**: silent defaults; deriving HMAC from the encryption key; unbounded one-shot rewrites; deleting old keys immediately; returning stored ciphertext/mask on decrypt failure.

## RQ-13 — How is full-value reveal authorized and audited?

**Decision**: Only an active Staff Admin with explicit payout-verification capability may reveal one exact PENDING_VERIFICATION version. Authentication validates a step-up proof no older than five minutes and binds it to actor/session. The request includes one meaningful reason and purpose. Admin Audit enforces at most five accepted reveals in the rolling 10-minute actor window and commits safe accepted audit before response. The response is single-use in effect and `no-store`; no grant token is persisted or reusable.

**Rationale**: A request-scoped grant is sufficient and avoids a new bearer secret. Audit-before-return is a hard transaction boundary.

**Rejected**: Owner/Admin reveal; revealing approved/terminal destinations; bulk export; reusable grant tokens; rate limiting only in memory; asynchronous accepted audit.

## RQ-14 — How is the global primary maintained?

**Decision**: Store one versioned `ProviderPrimaryPayoutDestination` row per Provider. First approval initializes it only if absent. Later unrelated approvals do not change it. Owner changes and primary removal lock Provider, primary, and involved destination rows and update history/outbox atomically. Successor approval inherits primary only from its linked predecessor. Staff challenge clears primary immediately and never promotes another destination.

**Rationale**: A separate row gives one enforceable global reference across both destination types and an independent expected version.

**Rejected**: `isPrimary` booleans on multiple versions; type-specific primaries; automatic failover; allowing PENDING as primary.

## RQ-15 — How are lifecycle concurrency and retries handled?

**Decision**: Every command carries `expectedVersion` and `idempotencyKey`/request identity. Commands lock Provider first and then chain/version/primary/claim rows in stable order. Immutable history and decisions have unique operation keys. Matching retries return the prior result; stale expected versions, nonmatching retries, second open successors, sixth active chains, competing decisions, and primary races return safe 409 without partial writes.

**Rationale**: Database serialization plus optimistic versioning makes outcomes deterministic across processes.

**Rejected**: in-memory locks; last-write-wins; idempotency based only on HTTP request ID; external I/O in transactions.

## RQ-16 — How are notifications made durable?

**Decision**: Extend the existing Providers email outbox with R1-P06 template codes and a nullable reference to R1-P06 history. The business transaction inserts one unique intent per required event. A worker leases rows, renders a localized safe template, sends after commit, and retries with bounded backoff. Payload derivation uses only type, exact mask, safe status/reason, locale, and target active Owner.

**Rationale**: R1-P05 already established a Provider outbox and recipient relationship. Reuse avoids a second dispatcher while preserving independent event identity.

**Rejected**: synchronous email inside transactions; arbitrary JSON payloads containing request bodies; rolling back business state when delivery fails; sending sensitive holder/identifier values.

## RQ-17 — What is the Staff review queue?

**Decision**: Derive document and payout queues from indexed PENDING/SUBMITTED versions plus unresolved conflict records. Submission writes immutable history and outbox atomically; no external queue service is introduced. Cursor order is oldest eligible submission then stable ID.

**Rationale**: PostgreSQL is already authoritative and sufficient for the phase scale; an additional broker/deployable is not justified.

**Rejected**: an untracked UI-only list; an external queue dependency; storing actual transfer attempts or settlement work.

## RQ-18 — How are legal-name comparisons supported?

**Decision**: Providers asks Customers for the authoritative current legal name selected by `PROVIDER_LEGAL_ENTITY` or `PROVIDER_OWNER`, with the exact Owner user ID already resolved by Providers. The Staff dossier displays the authoritative comparison name and holder name only inside the verification purpose. Cleanora records the Staff outcome/note, not an automated fuzzy match score.

**Rationale**: The accepted workflow is manual and Customers owns applicant/identity profile facts.

**Rejected**: copying Customer rows into Providers; caller-supplied authoritative names; automated wallet/bank API or name-matching engine.

## RQ-19 — Which operational dependencies fail readiness?

**Decision**: API readiness fails closed if payout key rings are missing/malformed/inconsistent or if a persisted referenced key is unavailable. Document submission/review paths fail closed when the configured malware scanner cannot provide a clean result; unrelated API health may remain available with a degraded dependency code. Cloudinary/email failures remain post-commit lifecycle/delivery failures according to their existing adapters.

**Rationale**: Protected values cannot be safely accepted without keys, and unsafe/unscanned evidence cannot earn verification.

**Rejected**: accepting plaintext while keys are down; treating scanner timeout as clean; global application crash for recoverable email delivery failures.

## RQ-20 — What migration strategy preserves the existing product?

**Decision**: Add one forward-only R1-P06 migration after the current R1-P05 migration. Add tables/enums/nullable relations first, then constraints/indexes/FKs. There is no existing R1-P06 data backfill. Seed catalogs idempotently through the seed path, not migration SQL, except enum/schema definitions. Validate clean install and upgrade from the current schema on disposable databases.

**Rationale**: This follows DEC-014 and the migration constitution while keeping environment-specific reference data visible and repeatable.

**Rejected**: editing R1-P05 SQL; `db push`; destructive reset; placing secrets or ciphertext in seeds; production migration during implementation.

## RQ-21 — How do the UX references influence the design?

**Decision**: Use them for information architecture and state visibility only. Apply canonical authority corrections documented in [ux-design.md](./ux-design.md). Backend capability DTOs and state codes drive controls; the images do not define authorization, fields, masks, routes, or readiness semantics.

**Rationale**: Several legacy images show Provider Admin payout mutation, extra bank fields, create-time primary selection, and other conflicts.

**Rejected**: copying endpoint labels or form fields from images without reconciliation.

## RQ-22 — What remains explicitly deferred?

**Decision**: Defer payout execution/settlement/reconciliation, internal balances, card/InstaPay destinations, public browse/badge presentation, workers/services/coverage/availability, marketplace eligibility, payout schedule, cloud secret manager, Docker/cloud deployment, and all future R1 phases.

**Rationale**: These are explicit phase/release boundaries.

## Research Completion

All technical unknowns needed for planning have a repository-consistent decision. No unresolved planning marker remains. Implementation is not authorized by this artifact.
