# Test Strategy and Acceptance Evidence — R1-P06

**Implementation evidence**: the focused suites and commands are implemented. All non-database gates, the disposable clean install, populated R1-P05 upgrade, double-seed idempotency, and live database constraint/reveal probes pass as recorded in `implementation-summary.md`.

## Evidence Principles

- Each FR cluster and all 42 success criteria map to at least one deterministic test or review artifact.
- Use injected clocks, nonces, key rings, Media/scanner facts, Authentication proofs, Customers names, Configuration facts, and Admin audit gates.
- Use distinctive synthetic sentinels for wallet, IBAN, holder name, ciphertext, nonce, tag, fingerprint, key, document number, and Media key; scan every forbidden sink.
- PostgreSQL-backed suites run sequentially against a shared proof DB or in parallel only with truly isolated databases.
- No real wallet/bank rail, money, production credential, Docker/Testcontainers, or cloud deployment is part of evidence.

## Unit Suites

### Document policy/lifecycle

- effective policy selection, future effective time, immutable publish, stable type continuity, newly required and retired items;
- metadata/date validation and authoritative country;
- PDF vs image-set shape, page and byte limits, order, all-READY rule;
- exact lifecycle matrix, successor continuity, expiry, invalidation, badge/readiness derivation;
- Individual Team NOT_REQUIRED/NOT_ELIGIBLE truth.

### Payout domain

- E.164 and IBAN normalization/country validation/MOD-97;
- registry-derived operator/bank and configured currency;
- nine-state transition matrix by actor;
- five active chains, terminal exclusion, one open successor;
- first-primary initialization, explicit switch, atomic removal replacement, last-primary acknowledgement, successor inheritance, Staff challenge, no auto-failover;
- 10-minute Owner re-auth boundaries and matching/stale command outcomes;
- safe reason/note validator and role-specific DTOs.

### Cryptography/privacy

- AES-GCM round trip, unique nonce, tampered tag, wrong/missing key, and every AAD dimension mismatch;
- HMAC determinism, type/country domain separation, operator independence, all-enabled-key comparison, independent keys;
- key-ring parsing for missing/malformed/weak/reused/default/inconsistent keys;
- golden mask vectors for country-code/national lengths and multiple IBAN lengths/case/spacing;
- Owner/Admin/Staff/public projections;
- logger/audit/history/outbox safe builders.

### Media

- `.jpg` and `.jpeg` both validated as `image/jpeg`, plus PNG/PDF;
- extension/MIME/signature mismatch, malformed decode, encrypted/password PDF, active content, executable, malware, oversize, page-count, mixed-format, aggregate, orientation, metadata removal, and scanner failure.

## Public-Contract Tests

- Authentication active facts, exact proof binding and age, capability denial.
- Customers legal-entity/Owner legal-name facts and missing-name outcome.
- Configuration active country/currency facts.
- Media reservation/status/receipt/private delivery/cleanup with no storage-key leakage.
- Admin decision audit, denied reveal audit, actor-serialized accepted reveal gate, and audit-input guards.
- Providers public readiness/badge output excludes all private domain data.

## PostgreSQL / Integration Suites

- every partial unique/check/FK constraint and immutable update predicate;
- one concurrent document decision, one successor, one primary, five chain slots;
- same-Provider/cross-Provider wallet duplicates independent of operator and formatted-equivalent IBAN duplicates;
- exactly one active identity claim during collision; safe conflict case and no incumbent disclosure;
- matching retry returns prior result, altered retry/stale version returns 409 with no extra history/audit/outbox;
- forced transaction failure leaves no partial state, pointer, readiness effect, conflict, audit, or email intent;
- policy publication/effective-time/readiness re-evaluation and bounded history activation;
- document upload processing/failure and submission re-read of Media READY status;
- six concurrent reveal calls produce exactly five accepted audits/responses; forced accepted-audit failure produces no plaintext;
- Staff decision method/outcome/version rules and same-actor accepted reveal reference for approval;
- notification uniqueness, safe variables, retry, and business-state independence;
- key rotation mixed-key/partial/resume/zero-reference/human-retirement behavior without business-version changes.

## API Suites

- full Owner/Admin/Staff/inactive/cross-Provider matrices;
- strict bodies, stable envelopes/error codes, bounded cursor pagination;
- application approval prerequisite and suspended remediation;
- ordinary payout outputs masked from DRAFT onward; Admin has no holder; Staff queue has no holder;
- reveal is POST, exact pending version only, `Cache-Control: no-store, private`, `Pragma: no-cache`, no bulk/export/reuse;
- `.jpg`/`.jpeg` acceptance and unsafe media responses;
- no payout ownership-evidence fields/endpoints;
- no account/branch/free-text SWIFT/operator/bank or phoneVerified requirement;
- no endpoint sets Provider LIVE/public/payable.

## Leakage Scan

For each sentinel, scan:

- success/failure bodies and headers;
- logger captures, request/response telemetry, exception causes;
- generic `audit_logs`, reveal attempts, document/payout history, decisions/conflicts;
- Provider email outbox/templates;
- database columns outside protected envelopes/allowed mask facts;
- OpenAPI/Postman examples, fixtures, snapshots, coverage output.

Expected count is zero for every prohibited raw value/material. Exact safe masks may appear only in allowlisted projections/history/notifications.

## Migration Evidence

- static SQL review and applied-migration hash preservation;
- clean chronological apply on disposable DB;
- upgrade from populated R1-P05-compatible clone;
- expected table/index/constraint/enum inventory;
- live constraint probes and seed idempotency;
- no plaintext/key-material columns and no destructive statement.

## Later Validation Command Order

```text
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
focused unit/contract/integration suites
npm run test:unit
npm run test:integration
npm run test:coverage
npm run db:validate-clean-migration   # explicit disposable isolated DB only
npm run db:validate-r1-p06-upgrade    # same approved DB, separate populated R1-P05 schema
npm run openapi:validate
npm run postman:validate
npm run docs:check
npm run build
```

Commands that touch a database require explicit safe-target configuration and are not part of this documentation run.

## Requirement Traceability Clusters

| Requirements | Primary evidence |
|---|---|
| FR-001–009, 070–074 | identity/application/membership/cross-module contract and API authorization tests |
| FR-010–018 | policy model/publication/effective-date tests |
| FR-019–042 | Media/document lifecycle/review/badge tests |
| FR-043–050 | readiness projection compatibility tests |
| FR-051–064 | type/boundary/Owner/Admin/primary baseline tests |
| FR-065–088 | privacy/audit/version/transaction/deferred-scope tests |
| FR-089–103 | wallet schema/manual verification/dedup/mask tests |
| FR-104–117 | IBAN schema/manual verification/dedup/mask tests |
| FR-118–139 | lifecycle/cardinality/primary/reauth/outbox tests |
| FR-140–166 | crypto/reveal/key config/rotation/leakage tests |

## Completion Evidence Package

The later implementation summary must cite exact commands/results, migration name/hash review, test counts, OpenAPI/Postman parity, safe config/readiness evidence, leakage-scan result, unresolved environment limits, and confirmation that no payout/settlement or future-phase behavior was introduced.
