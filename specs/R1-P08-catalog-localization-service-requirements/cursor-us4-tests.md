# Cursor TDD brief — R1-P08 US4 service-media tests only

## Scope and architecture contract

Write the focused failing tests for US4 tasks T098–T105. Do **not** implement
production source in this pass, do not change schema/migrations, do not run a
database seed/migration, do not modify task/status/summary files, and preserve
all unrelated dirty work.

Read `AGENTS.md`, active R1-P08 `spec.md`, `plan.md`, `tasks.md` (US4),
`research.md` sections "Media seam" / "one Catalog-owned media association",
and `implementation-prompt.md` first. Then inspect existing Media public
contracts and Media image infrastructure.

The locked ownership boundary is:

- **Media owns** `media_files`, owner type/status, image normalization, storage
  keys, external storage I/O, cleanup, and short-lived delivery URLs.
- **Catalog owns** only the ordered `service_media_associations`, service
  version/idempotency/audit orchestration, and protected staff commands.
- Catalog reaches Media only through `media.public.ts` named ports and a
  transaction-bound public authorization seam—never Media repository/Prisma
  internals.
- No anonymous/customer Browse HTTP and no Provider coupling. Detaching an
  association never deletes or mutates the Media file.

Existing public names such as `CATALOG_SERVICE_IMAGE`, `CatalogServiceImagePort`,
and `TransactionalCatalogServiceImageAuthorizer` may already exist; test their
intended behavior rather than inventing a second contract.

## Required test intent

Create focused tests in the task-named files where appropriate:

1. **T098:** Catalog image allowed content types, byte/dimension limits,
   normalization, safe receipts, and no raw storage key/URL in receipt.
2. **T099:** Media ingest states and adapters: Catalog owner type; valid image
   reaches READY; bad MIME/size/image fails safely; receipt/read/delivery/cleanup
   never expose storage keys or credentials. Use fakes—no external storage.
3. **T100:** Catalog association uniqueness/order and detach-without-file-delete
   contracts. Any real Prisma proof must be guarded to the exact approved
   `CLEANORA_R1_P08_DATABASE_URL`; name it as guarded—not as passed.
4. **T101:** Service orchestration reserve → ingest → final READY
   reauthorization/CAS → atomic association/audit/receipt, including same-key
   resume. Test with Media and Catalog fakes only.
5. **T102/T103:** protected auth/reason/CAS/audit failure cleanup; PENDING/crash
   resume; same key/same payload replay vs same key/different payload conflict.
   Live transaction/race proofs may be explicit guarded skips.
6. **T104:** protected multipart add/reorder/remove HTTP contracts; malformed
   content returns safe envelope and no anonymous Browse is introduced.
7. **T105:** protected delivery and internal references redact uploader,
   storage key, provider payload and private URL from internal selectable
   references.

Do not fake a live Prisma/Media proof with a recording object. Make each fake
test name clear about its scope. Tests must initially fail for missing US4
implementation exports/behavior, except tests that exercise existing correct
Media code.

## Allowed files

- `tests/unit/catalog/catalog-media.policy.test.ts`
- `tests/integration/media/catalog-service-image.test.ts`
- `tests/integration/catalog/catalog-media.repository.test.ts`
- `tests/unit/catalog/catalog-media.service.test.ts`
- `tests/integration/catalog/catalog-media-compensation.test.ts`
- `tests/integration/catalog/catalog-media-idempotency.test.ts`
- `tests/integration/http/catalog-management-media.test.ts`
- `tests/unit/catalog/catalog-output-redaction.test.ts`
- `tests/integration/catalog/catalog-selectable-media.test.ts`

Only introduce a dedicated test helper under `tests/helpers/` if unavoidable;
otherwise stop and report why. Do not edit production code to make tests pass.

## Verification

Run typecheck and the new test file list. Report exact failures/pass/skip counts
and explain the missing production surface. Do not commit.
