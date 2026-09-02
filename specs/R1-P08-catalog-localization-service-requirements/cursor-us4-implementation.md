# Cursor implementation brief — R1-P08 US4 bounded service-media implementation

## Authority and scope

Implement the US4 production surface required to make the existing T098–T105
tests pass, while preserving the locked Media/Catalog architecture. Read
`AGENTS.md`, `docs/product/current.md`, R1-P08 `spec.md`, `plan.md`, `tasks.md`
(US4), `research.md`, `implementation-prompt.md`, and all US4 test files before
editing.

This is a bounded implementation slice. Do not modify `tasks.md`,
`implementation-summary.md`, `.spec-context.json`, schema/migrations, seed,
unrelated docs, or unrelated dirty work. Do not run migrations, database seed,
or connect to any database. Do not commit.

## Locked architecture

- **Media owns** `media_files`, owner type/status, normalizing images, storage
  keys/I/O, cleanup, and short-lived delivery URLs. Implement/use named
  `media.public.ts` ports only from Catalog.
- **Catalog owns** `service_media_associations`, their deterministic order,
  service version/idempotency/audit orchestration, and protected staff commands.
- Catalog must not import a Media repository, Media Prisma model, or Media
  infrastructure file. Media must not own `serviceId`/display order.
- Detaching only deletes the Catalog association; it never deletes/mutates the
  Media-owned file. No Provider coupling and no anonymous/customer Browse HTTP.
- Existing migration/schema already contain the phase relation/owner type. Do
  not edit them.

## Required behaviors

1. **T106–T107 Media:** Add Catalog service-image limits (JPEG/PNG/WebP,
   max 5 MiB, max edge 1200) and normalization/storage/receipt/READY/delivery/
   cleanup implementation reusing safe existing image infrastructure. Add the
   narrow factory/wiring and transaction-bound READY+owner-type+uploader
   authorization. Receipts/public safe views must never expose storage keys,
   provider payloads, credentials, or unbounded delivery URLs.
2. **T108–T110 Catalog persistence/service:** add association lock/list/add,
   exact full reorder, and remove operations. Use deterministic locking and
   temporary nonnegative order parking where uniqueness requires it. Upload
   orchestration is: reserve/replay receipt in a short Catalog transaction →
   external Media ingest outside the long transaction → final transaction with
   management reauth, expected service version, transaction-bound READY owner
   verification, association/version/audit/receipt. Same key/same payload
   resumes/replays one media ID; same key/different payload conflicts; failure
   after external ingestion requests Media cleanup and leaves no association or
   completed Catalog receipt.
3. **T111–T112 HTTP:** protected staff multipart add, reorder, remove commands
   with strict parser/limits and safe envelopes. Keep static routes correctly
   ordered. No public Catalog Browse route.
4. **T113/T105 safe projection:** protected management may request a short-lived
   delivery presentation from the Media port. Internal selectability/snapshot
   output exposes only stable READY association references (`associationId`,
   `mediaId`, content type, dimensions, displayOrder), never delivery URL or
   storage/uploader/provider data.
   The existing US4 red test asks `getSnapshotReadyDefinition` for a media-safe
   definition. Implement only the minimum consistent read needed to satisfy
   that existing internal contract and media redaction; do not add HTTP, booking
   persistence, or wider US5 behavior beyond that test-required projection.
5. **T114–T116:** protected runtime OpenAPI + Postman generator additions;
   safe dependency error mapping/cleanup log fields/audit redaction.

## Expected production file scope

Use only files that are strictly necessary from this list:

- `src/modules/media/media.public.ts`
- `src/modules/media/domain/media.types.ts`
- `src/modules/media/infrastructure/catalog-service-image.adapter.ts` (new)
- `src/modules/media/infrastructure/prisma-media.repository.ts`
- `src/modules/media/infrastructure/media-provider.factory.ts`
- `src/composition.ts`
- `src/modules/catalog/catalog-media.policy.ts` (new)
- `src/modules/catalog/catalog.errors.ts`
- `src/modules/catalog/catalog.repository.ts`
- `src/modules/catalog/catalog.service.ts`
- `src/modules/catalog/catalog.schema.ts`
- `src/modules/catalog/catalog.controller.ts`
- `src/modules/catalog/catalog.routes.ts`
- `src/modules/catalog/catalog-media.multer.ts` only if existing middleware
  cannot enforce the needed limits
- `src/modules/catalog/catalog.public.ts`
- `src/swagger/r1-p08-openapi.paths.ts`
- `scripts/generate-r1-p08-postman.ts`

If another file is essential, stop and report its exact path/reason. Never edit
the US4 tests merely to lower their intended guarantee; only correct a test if
it contradicts the active spec, and report it first.

## Important review conditions

- Use the same error/redaction conventions as existing Catalog and Media code.
- Do not treat a fake repository as a PostgreSQL proof; retained guarded DB/race
  test skips must be reported as skips, not successes.
- Ensure audit data has aggregate IDs/counts/version/state only; no raw Media
  receipt, storage key, uploader, signed URL, request body/image bytes, or
  idempotency key.
- Preserve the US2 frozen configuration contract: availability stays separate;
  Media is its own command surface.
- The Catalog public contract must remain free of Prisma rows/raw Media fields.

## Verification

Run safe local checks:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run openapi:validate
npm.cmd run test:r1-p08 -- tests/unit/catalog/catalog-media.policy.test.ts tests/integration/media/catalog-service-image.test.ts tests/integration/catalog/catalog-media.repository.test.ts tests/unit/catalog/catalog-media.service.test.ts tests/integration/catalog/catalog-media-compensation.test.ts tests/integration/catalog/catalog-media-idempotency.test.ts tests/integration/http/catalog-management-media.test.ts tests/unit/catalog/catalog-output-redaction.test.ts tests/integration/catalog/catalog-selectable-media.test.ts
```

Report files changed; exact pass/fail/skip counts; architecture evidence; live
DB proof still deferred; and any blocked concern. Do not commit.
