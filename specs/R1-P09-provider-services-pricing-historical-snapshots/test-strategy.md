# Test Strategy: R1-P09 Provider Services and Pricing

**Status**: Planned only. No test, coverage, build, database, migration, seed,
OpenAPI, or Postman command was run during specification/planning.

## Principles

- Implement each user-story slice test-first: write the focused failing test,
  implement the minimum production behavior, then run the focused slice.
- Use unit tests for pure policy/DTO/schema/authorization behavior; repository
  integration tests for atomicity, constraints, histories, receipts, and races;
  Supertest for HTTP/auth/error boundaries; disposable PostgreSQL only for live
  migration and concurrency evidence.
- No Docker, Testcontainers, production credential, shared database, network
  service, or external repository is allowed.
- Database commands require the repository's explicit disposable-target safety
  check. Planning this gate does not authorize executing it.
- Tests assert both positive state and prohibited side effects. A rejected
  operation must prove no current row, history, receipt, readiness, or success
  audit changed.

## Phase Test Configuration

Plan `vitest.r1-p09.config.ts` with serial execution and the established
phase-specific environment registration. Planned include set:

```text
tests/unit/providers/provider-service-*.test.ts
tests/unit/modules/r1-p09-*.test.ts
tests/unit/modules/authentication/authorization-provider-services.test.ts
tests/unit/scripts/validate-r1-p09-upgrade.test.ts
tests/unit/swagger/r1-p09-*.test.ts
tests/integration/providers/provider-service-*.test.ts
tests/integration/http/provider-services-*.test.ts
tests/integration/database/r1-p09-*.test.ts
```

Coverage includes the new Provider-service vertical and touched public seams in
Providers, Catalog, Configuration, Authentication, Admin composition, route
mounts, and R1-P09 OpenAPI source. Thresholds:

| Metric | Minimum |
|---|---:|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

Planned package scripts:

```text
test:r1-p09
test:coverage:r1-p09
postman:generate:r1-p09
db:validate-r1-p09-upgrade
```

The aggregate `postman:generate` chain will append R1-P09 after R1-P08.

## User Story 1 — Configure a Provider Offering

### Unit tests

- Authorization: exact active OWNER and ADMIN allow; disabled membership,
  missing Provider-admin authority, unapproved Provider, customer, anonymous,
  and cross-Provider scope deny.
- Catalog contract: creation uses only the public reader; inactive, incomplete,
  wrong-country, unknown, and disallowed price-unit facts fail safely.
- Strict Zod: reject unknown client total/fee/tax/discount/deposit/commission/
  payable fields, caller currency, actor, approval, Provider scope, and malformed
  IDs/keys/version.
- Decimal policy: canonical integer/fraction input, trailing-zero normalization,
  scale 0 and 30, zero, negative/signs, exponent, grouping, whitespace, leading
  zeros, excess scale, max overflow, minimum below price, and exact output.
- Configuration: active default currency, country-required policy, missing key/
  country value, inactive country/currency, malformed maximum, and unsupported
  scale all fail closed.
- Duration/notes: 1/1440 boundaries; fractional/zero/1441 rejection; both notes
  absent; complete trimmed AR/EN pair; blank, one-sided, or >1000 rejection;
  no structured OQ-002 materials rule.
- DTO/redaction: no raw Prisma, contacts, receipts, stack/database details, or
  client totals.

### Repository/integration tests

- Create one disabled aggregate at version 1 plus initial retained price,
  price history, state-history receipt, and audit in one transaction.
- Approval-disabled initial price is effective; approval-required initial price
  is pending with no effective row.
- Provider/service uniqueness accepts exactly one of two concurrent creates.
- Composite FKs reject wrong Provider/service/unit/country/currency identity.
- Failure injection at price, history, receipt, and audit steps rolls back all
  four-table state.
- Same create key/hash replays original DTO after later changes; different hash
  conflicts; concurrent identical requests produce one aggregate/history.

### HTTP tests

- List/create/detail success and status codes, pagination/cursor behavior,
  replay metadata, exact response envelope, and non-enumerating cross-Provider
  denial.
- Strict body rejects every client-calculated monetary field and does not call
  the service.
- Currency/approval fields cannot be supplied by the caller.

## User Story 2 — Price, Configuration, and Lifecycle History

### Unit tests

- Configuration replacement changes only duration/notes and one aggregate
  version; it creates no price row.
- Price transition tables cover new pending/effective, superseding prior
  pending/effective, terminal rejected/superseded, and invalid transitions.
- Enable readiness policy requires every current DEC-051 fact; disable bypasses
  price approval but still requires exact authority/version/key/reason.
- Price and lifecycle reason validation, safe history mapping, chronological
  cursor encoding, and internal receipt-field exclusion.

### Repository/integration tests

- A price proposal inserts a new commercial row and exact price-history events;
  old commercial values remain unchanged.
- Partial unique indexes prevent two pending or two effective rows under
  concurrent writers.
- One command that supersedes multiple rows increments the aggregate once and
  stamps all event rows with the same resulting version.
- Enable/disable each append exactly one visible status transition; retries
  append none; repeated same-state action returns a stable conflict/no-op policy
  without fake history.
- Stale configuration, price, and lifecycle commands mutate nothing.
- A late identical retry returns its original safe result after newer accepted
  commands; conflicting key reuse mutates nothing.
- History append-only triggers reject every update/delete; the price trigger
  rejects delete and commercial/context rewrites while allowing only the legal
  lifecycle status/timestamp transitions; no hard-delete repository method
  exists.
- Catalog service/country/unit deactivation changes dynamic usability only;
  Provider `enabled` and status history stay unchanged; restoration requalifies.
- Provider country/default currency/max changes make incompatible effective
  rows unusable without rewriting price/status history.

### HTTP tests

- Configuration, price proposal, lifecycle, price-history, and status-history
  operations cover success, replay, version conflict, idempotency conflict,
  invalid price, enable blockers, pagination, exact scope, and redaction.
- Status-history output excludes internal creation/configuration receipt rows.
- Pending/effective are explicit only in authorized management output.

## User Story 3 — Configured Price Approval

### Unit tests

- Authentication permission exists once, is granted only to `staff_admin`, and
  preflight/transactional authorizers agree.
- Approval-required/disabled policy, approve/reject transitions, required
  reason, proposal target validation, and safe Staff DTO mapping.
- A config change never auto-transitions an existing proposal. Turning approval
  on affects future proposals; turning it off requires a new Provider proposal
  to supersede an old pending value.

### Repository/integration tests

- Approval atomically supersedes old effective, activates pending, appends both
  history events/receipt and privileged audit, and increments once.
- Rejection leaves the old effective row unchanged and retains the rejected row.
- Initial approved price becomes effective; initial rejected price leaves none.
- Two Staff writers at the same version accept one decision; the loser is stale
  or non-pending with no duplicate history/audit.
- Permission revocation, policy disable, stale version, wrong Provider/service/
  price target, replay conflict, and failure injection leave all truth unchanged.

### HTTP tests

- Pending queue, dossier, approve, and reject require the exact permission and
  return safe envelopes/pagination.
- Provider members cannot call Staff routes; other Staff roles cannot see
  pending values; revoked/inactive Staff fail closed.
- No Staff route exists or returns work for newly submitted prices in an
  approval-disabled country.

## User Story 4 — Readiness and Snapshot-Ready Facts

### Unit tests

- Every approved blocker code is emitted only for its exact condition and no
  unapproved code appears.
- One qualifying offering satisfies `servicesReady`; zero offerings, no enabled
  row, Catalog unavailable, unit unavailable, no effective price, pending-only,
  or invalid config fails appropriately.
- Readiness never calculates coverage, schedule, capacity, LIVE, final
  eligibility, or changes `eligibleForPublicBrowse=false`.
- Exact-locale note returns AR or EN only; absent pair returns null; no fallback.
- Internal DTO contains every DEC-051 field and excludes pending/rejected/
  superseded values, Staff reasons, histories, contacts, receipts, and raw rows.

### Integration/consistency tests

- Dynamic readiness updates after offering, price, approval, lifecycle,
  Configuration, Provider-country, and Catalog changes without a persisted
  readiness column or false status history.
- Snapshot AVAILABLE output combines one stable Provider version/effective price
  with one complete current Catalog definition.
- Disabled, wrong-country, unsupported-locale, Catalog-unavailable, unit-
  unavailable, missing-config, invalid-price, pending-only, and nonmatching
  service cases collapse to `UNAVAILABLE`.
- One repeatable-read transaction returns mutually consistent Provider,
  Catalog, and Configuration facts; injected retryable snapshot/serialization
  failures retry the whole transaction and a third failure returns stable
  `CONFLICT`; no mixed versions return.
- A copied plain DTO remains unchanged after later Catalog/Provider mutation.
- Persistence spies prove the reader creates no Booking, customer-answer,
  booking-price, or snapshot row.

## Cross-Cutting Suites

### Architecture and ownership

- Providers imports Catalog, Configuration, Authentication, and Admin only from
  their public contract files.
- No Pricing/Offerings/ProviderServices/Booking/Browse/generic Workflow module.
- Catalog never imports or stores Provider price types.
- Repositories contain persistence only; services orchestrate; controllers/
  routes remain thin.
- Prisma/table guard allows exactly the four R1-P09 models/tables and rejects
  future-phase names.

### Audit, privacy, and errors

- Every accepted command and Staff decision writes one allowlisted Admin audit
  atomically with state/history.
- Logs, errors, DTOs, OpenAPI examples, Postman examples, histories, and receipt
  JSON pass forbidden-marker scans for tokens, secrets, private contacts,
  internal URLs, raw Prisma, and stack traces.
- Failure mapping distinguishes validation, forbidden, Provider/Catalog/config/
  approval state, version, idempotency, snapshot conflict, and unexpected
  dependency errors without leaking target existence.

### OpenAPI and Postman

- Exactly the 11 planned protected operations exist in route/OpenAPI/Postman
  parity.
- Bodies remain strict, security schemes are required, decimal fields are
  strings, and success/error/replay examples match runtime DTOs.
- Negative surface tests prove no anonymous/customer Browse, Provider Details,
  Booking, price-calculation, or public pending-price route.
- Generated collection is deterministic and the aggregate generator/validator
  remains green.

### Migration

See [migration-plan.md](./migration-plan.md) for clean install, populated
upgrade, live constraints, exact table/history, decimal, immutability,
idempotent redeploy, and destructive-SQL tests.

## FR/SC Coverage Map

| Evidence group | Requirements / outcomes |
|---|---|
| Ownership/Catalog public contract | FR-001–FR-006, FR-044–FR-046; SC-001, SC-011 |
| Authorization/isolation | FR-007–FR-010, FR-031; SC-003 |
| Offering/decimal/config validation | FR-011–FR-017, FR-042–FR-043; SC-001–SC-002, SC-007 |
| Current state/history/concurrency/replay | FR-018–FR-027, FR-041–FR-043; SC-004–SC-006 |
| Approval | FR-028–FR-032; SC-008 |
| Readiness/snapshot | FR-033–FR-040; SC-009–SC-010 |
| Tasks/evidence traceability | FR-046 and all FR/SC rows; SC-012 |

## Planned Quality-Gate Order — Not Executed

After all story tasks are implemented, run in this order on an approved local
environment:

1. `npm run test:r1-p09`
2. `npm run test:coverage:r1-p09`
3. `npm run prisma:validate`
4. `npm run db:validate-clean-migration` against the explicit disposable target
5. `npm run db:validate-r1-p09-upgrade` against the explicit disposable target
6. `npm run postman:generate:r1-p09`
7. `npm run openapi:validate`
8. `npm run postman:validate`
9. `npm run docs:check`
10. `npm run lint`
11. `npm run typecheck`
12. `npm test`
13. `npm run test:coverage`
14. `npm run build`

Generated Postman drift is checked after generation. Database validators must
record the approved disposable target and may never run against production.
