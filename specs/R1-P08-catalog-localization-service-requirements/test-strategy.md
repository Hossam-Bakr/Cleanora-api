# R1-P08 Test and Evidence Strategy

**Status:** Planned; tests are mandatory implementation work

## Objectives

Prove the Catalog is manageable, strictly bilingual, authorization-safe,
conflict-safe, Media-boundary-safe, seedable, migration-compatible, and usable
through selectable/snapshot-ready contracts without implementing later phases.
Green compilation alone is not completion evidence.

## Test layers

### Unit policy tests

Target `tests/unit/catalog/` and keep pure policy tests independent of Prisma.

- stable-code normalization/validation;
- inactive-draft versus active completeness for categories, services, units,
  fields, and options;
- exact-locale projection and explicit no-fallback failures;
- all six field kinds with every valid constraint combination;
- every incompatible field-kind constraint, min/max inversion, select option
  count, duplicate value, and `INFORMATION` requiredness rejection;
- service activation prerequisites and selectability calculation;
- deterministic full-replacement ordering and duplicate/omitted ID rejection;
- canonical command hashing and same-key/different-payload conflicts;
- DTO mapping excludes draft, audit, uploader, storage key, and Prisma details;
- error mapping and structured-log redaction.

### Authorization and audit tests

Target Authentication catalog unit tests and Catalog service integration tests.

- exactly two new permissions and only active `staff_admin` mapping;
- protected operations declared and deny unknown operation IDs;
- exact active reason bound to `CATALOG_MANAGEMENT_WRITE`;
- positive active-admin read/write;
- independent denial for Operations, Support, Finance, provider roles, Worker,
  customer, missing grant, disabled grant, revoked grant, inactive/suspended
  principal, missing/wrong/inactive reason;
- fresh transaction recheck catches revocation between precheck and commit;
- every accepted write creates exactly one privileged audit row with actor,
  reason, target, request ID, before/after safe facts, and timestamp;
- denied/stale/invalid writes change zero Catalog rows and create no success
  audit;
- audit context rejects localized text, storage keys, URLs, binary or secret-
  shaped values.

### Repository and PostgreSQL integration tests

Use isolated phase-named PostgreSQL targets only.

- category/service create, update, lifecycle, category move/order, and version
  propagation;
- atomic service-configuration replacement across translations, units,
  fields/options, and availability;
- exact country resolution and inactive/unknown-country denial;
- service selectability across active/inactive category, service, availability,
  translation, unit, and field states;
- all unique/FK/check constraints with direct live probes;
- no hard-delete path and `Restrict` behavior for referenced identities;
- command receipts survive a new process/client and replay without a second
  write, version bump, or audit;
- same key with different hash conflicts;
- two same-version lifecycle/config/order commands produce one winner and one
  safe 409 with no partial rows;
- deterministic multi-row lock order avoids deadlock in repeated races;
- snapshot-ready read observes one service aggregate version under concurrent
  mutation.

### Media boundary tests

Use Media contract fakes for service unit tests and PostgreSQL/Media integration
for final wiring. Never use production credentials.

- valid JPEG/PNG/WebP Catalog image ingest produces a safe READY receipt and no
  storage key in the Catalog response;
- wrong MIME, oversize/corrupt image, PROCESSING/FAILED/DELETED status, wrong
  owner type, missing asset, and already-associated asset reject safely;
- final transaction rechecks Media eligibility;
- upload succeeds then CAS/auth/audit fails: no association, no service version
  change, cleanup requested;
- crash/retry around pending reservation resumes the same media ID rather than
  creating another asset;
- add/reorder/remove produces deterministic associations and versions;
- association removal does not delete or change the Media row;
- protected management delivery exposes only a short-lived safe URL/expiry and
  safe image metadata; delivery failure leaks no provider/storage detail;
- the internal reader returns stable Media references and never a delivery URL.

### HTTP contract tests

Use Supertest against composed routers.

- all management category/service/config/media routes: success plus 400, 401,
  403, 404, 409, safe 503, and unexpected 500 envelope paths as applicable;
- trusted actor derived from middleware, never body;
- management draft/detail responses never expose an anonymous/customer Browse
  route;
- standard success/failure envelopes, request ID parity, `Cache-Control` where
  applicable, and no stack/SQL/Prisma/storage leakage;
- multipart validation and safe body/file size handling for service images;
- runtime route, OpenAPI, and Postman parity proves there is no unprotected
  `/api/v1/catalog/services*` surface in R1-P08.

### Public-contract and boundary tests

- compile-time/shape tests for `CatalogDefinitionReader` and management-neutral
  DTOs;
- reader integration tests cover exact `AR`/`EN`, no fallback, `EG`,
  inactive/unavailable omission, bounded pagination, stable ordering, and no
  duplicates without going through HTTP;
- public contract contains no Prisma/generated types or repository adapter;
- Catalog imports Authentication/Configuration/Media/Admin only through named
  public files, except root composition may import infrastructure factories;
- other modules do not import Catalog internals;
- no circular dependency, generic shared business layer, Provider offering,
  eligibility, Booking, customer-answer, or frontend code.

### Seed tests

- clean seed creates exact DEC-044 IDs/counts/content/order/lifecycle;
- service is selectable for `EG` in AR and EN after clean seed;
- double seed preserves IDs, versions, values, order, counts, and audit state;
- owner changes a seeded value/order/status, seed rerun preserves the change;
- seed creates a missing child only when its stable identity is absent and never
  silently reactivates an existing inactive row;
- seed remains neutral on OQ-002 and creates no Media/provider/Booking records.

### Migration tests

- migration SQL static guard: no drop/truncate/reset/applied-migration edit and
  exact new table/enum/index/constraint names;
- clean chronological apply of all 15 migrations;
- populated R1-P07 upgrade with before/after baseline digests;
- enum addition preserves every existing Media owner type/row;
- live malformed-row probes for codes, positions, bounds, kinds, FKs,
  uniqueness, and command status;
- clean and upgrade double-seed proof.

## Acceptance mapping

| Risk/outcome | Primary evidence |
|---|---|
| SC-001 manageable active Catalog | Staff HTTP management journey plus internal EG-selectable reader proof |
| SC-002 bilingual completeness/no fallback | Policy matrix + DB journey + exact-locale internal reader tests |
| SC-003 units/fields valid | Six-kind unit matrix + configuration integration tests |
| SC-004 disabled/unavailable denied | Selectability policy/repository/internal-reader omission tests |
| SC-005 deterministic seed | clean/double-run/preserve-owner-change seed tests |
| SC-006 concurrency atomicity | PostgreSQL same-version lifecycle/order/config races |
| SC-007 authorization/audit | full role matrix, reason matrix, atomic audit assertions |
| SC-008 Media eligibility | Media status/type/cleanup/association tests |
| SC-009 snapshot consistency | transaction-consistent definition read during mutation |
| SC-010 traceability | tasks/analyze matrices and final evidence audit |
| SC-011 migration compatibility | clean chronological and populated R1-P07 upgrade reports |
| SC-012 repository quality | complete gate suite, review, and completion report |

Every FR receives at least one exact implementation/test/evidence task in
`tasks.md`; this table is a risk-level overview, not the final traceability map.

## Coverage

- Add `vitest.r1-p08.config.ts` following the R1-P07 phase pattern and include
  Catalog plus changed Authentication/Media/Admin/composition files.
- Keep repository coverage thresholds unchanged and make phase coverage meet or
  exceed the configured per-file/global thresholds.
- Branch-heavy policies (field matrix, activation, authorization, idempotency,
  Media compensation, errors) require direct branch tests; aggregate coverage
  cannot substitute for them.
- No skipped/todo/quarantined R1-P08 tests count as evidence.

## Required non-database gates

After implementation, run and report exact exits:

```powershell
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run openapi:validate
npm.cmd run postman:validate
npm.cmd run docs:check
npm.cmd run test:unit
npm.cmd run test:r1-p08
npm.cmd run test:coverage:r1-p08
npm.cmd run test:integration
npm.cmd run test:coverage
npm.cmd audit --audit-level=high
git diff --check
```

The implementation must add the two R1-P08 package scripts before using them.
Report file/test counts and coverage percentages from actual output.

## Database safety

- Do not connect to an unknown `.env` database.
- Do not use the historical `Cleanora` database.
- Do not run reset/drop/clean against a broad or unresolved path/target.
- Require an explicit phase-named isolated target satisfying the regex in
  `migration-plan.md` before migration/seed proof.
- Release 1 tests use local PostgreSQL without Docker/Testcontainers.
- Production credentials, Cloudinary writes, deployment, and production
  migration are forbidden.

## Final evidence artifacts

Implementation must leave:

- `migration-review.md` with reviewed SQL and risk findings;
- `migration-evidence.md` with clean/upgrade/seed/constraint proof;
- `module-boundary-review.md`;
- `security-validation.md` covering authorization/audit/redaction/Media;
- `implementation-summary.md` with task/test/gate counts;
- `implementation-review-report.md` and any `review-resolution.md`;
- `completion-report.md` mapping every DoD item to evidence without marking the
  phase Complete before human approval.
