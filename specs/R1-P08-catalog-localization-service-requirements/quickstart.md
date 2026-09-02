# R1-P08 Implementation Validation Quickstart

**Purpose:** Runnable validation guide after `speckit-implement`; this planning
artifact does not authorize an unknown database, production action, or Git
operation.

## 1. Preconditions

- Current branch is `r1-p08-catalog-localization-service-requirements`.
- `.specify/feature.json` points to the R1-P08 feature directory.
- Node.js is 24+ and dependencies are already installed.
- No unrelated dirty-worktree path is staged, reset, restored, cleaned, or
  overwritten.
- For database proof, the human has approved an isolated local PostgreSQL target
  matching the R1-P08 safety regex in `migration-plan.md`. Never use an unknown
  `.env` database or the historical `Cleanora` database.

## 2. Static and contract validation

```powershell
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run openapi:validate
npm.cmd run postman:validate
npm.cmd run docs:check
git diff --check
```

Expected:

- every command exits 0;
- runtime OpenAPI includes every R1-P08 operation in
  `contracts/catalog-api.openapi.yaml` with matching method/path/schema;
- generated Postman examples validate against runtime Zod schemas;
- no Prisma model leaks through module public contracts or HTTP DTOs.

## 3. Focused automated evidence

```powershell
npm.cmd run test:unit
npm.cmd run test:r1-p08
npm.cmd run test:coverage:r1-p08
```

Expected:

- no skipped/todo R1-P08 test;
- field-kind, localization, lifecycle, authorization, audit, idempotency,
  concurrency, Media compensation, error/redaction, and DTO branches pass;
- phase coverage meets all configured thresholds.

## 4. Clean migration and seed proof

With the approved clean target supplied through the repository's guarded test
environment:

```powershell
npm.cmd run db:validate-clean-migration
npm.cmd run seed
npm.cmd run seed
```

Expected after both seed runs:

- 15 migrations applied chronologically, last is
  `r1_p08_catalog_localization_service_requirements`;
- one `HOME_CLEANING` category and one `STANDARD_HOME_CLEANING` service;
- exactly two service units, five service fields, and one available `EG` row;
- stable IDs/versions/content/order/count digest after run two;
- no Media, Provider offering/price, Booking, answer, or future-phase row;
- live constraints reject invalid codes, duplicates, positions, field-kind
  columns, bounds, FKs, and malformed idempotency state.

## 5. Populated R1-P07 upgrade proof

Use a different approved phase-named target:

```powershell
npm.cmd run db:validate-r1-p08-upgrade
```

Expected:

- all representative R1-P07 baseline digests remain equal;
- R1-P08 migration is appended once;
- prior Media owner types/rows remain valid;
- only active `staff_admin` receives the two Catalog permissions;
- the new Egypt Catalog is complete/selectable and seed run two is a no-op.

## 6. Staff management journey

Use a test-created active `staff_admin` access token and reason
`catalog_management_change`. Do not use a real production account.

1. Create an inactive category with a stable code and incomplete bilingual
   content. Expect 201 and version 1.
2. Attempt activation while one locale is missing. Expect safe 400 and no
   version/audit change.
3. Replace complete AR/EN content with expected version 1, then activate with
   the returned version. Expect one version increment per accepted command and
   one privileged audit per command.
4. Create an inactive service under the category.
5. Replace its complete configuration in one PUT: exactly AR/EN translations,
   at least one active unit, a valid field graph, and `EG` availability.
6. Activate the service. Verify protected management detail includes current
   version and full configuration.
7. Retry one accepted request with the same idempotency key/payload. Verify no
   second row/version/audit. Reuse the key with a changed payload and expect 409.
8. Submit two concurrent commands with the same expected version. Verify one
   winner, one 409, and no partial ordering/config/audit.

## 7. Internal selectable localization journey

Invoke the composition-injected `CatalogDefinitionReader` in its integration
test harness for the seeded service; R1-P08 deliberately exposes no anonymous
or customer Catalog Browse HTTP route.

- `listSelectable({ countryCode: "EG", locale: "EN" })` returns English only;
- `listSelectable({ countryCode: "EG", locale: "AR" })` returns Arabic only;
- `getSnapshotReadyDefinition` for `STANDARD_HOME_CLEANING` returns one
  aggregate `serviceVersion`, two units, five ordered fields, stable Media
  references, and no management/audit fields;
- unsupported locale, inactive country, missing requested locale, inactive
  service, inactive category, or unavailable `EG` never falls back or leaks a
  draft;
- runtime routes, OpenAPI, and Postman contain no unprotected
  `/api/v1/catalog/services*` operation; R1-P12 owns that later Browse surface;
- changing the live service later does not mutate a previously copied fixture
  of the earlier definition.

## 8. Service image journey

With a test image and a Media fake/local adapter:

1. Upload one JPEG/PNG/WebP through the staff service-media endpoint using the
   current service version.
2. Verify Media owns the READY file and Catalog owns one ordered association.
3. Verify protected management delivery output has only a short-lived URL and
   expiry with no storage key/uploader, while the internal reader has stable
   Media references and no delivery URL.
4. Reorder two images and verify one service version increment.
5. Remove one association and prove the Media row/status is unchanged.
6. Force Media failure, final CAS conflict, and audit failure; prove no partial
   association/version/success audit and cleanup is requested.
7. Retry a pending upload with the same payload/key and prove the same reserved
   Media ID is resumed.

## 9. Full repository gates

```powershell
npm.cmd run test:integration
npm.cmd run test:coverage
npm.cmd audit --audit-level=high
```

Record exact test-file/test counts, coverage percentages, audit result, and
exit codes. A focused green suite does not replace these gates.

## 10. Completion boundary

Before requesting owner completion approval, verify:

- every task is checked with real evidence;
- every FR and build-verifiable SC maps to implementation/test/evidence;
- migration review/evidence, security validation, module-boundary review,
  implementation summary, independent review, and finding resolution are
  current;
- Companion shows implementation complete but the phase is not marked Complete
  without the owner's explicit completion approval;
- no staging, commit, push, merge, deployment, production migration, or
  destructive action occurred unless separately and exactly authorized.
