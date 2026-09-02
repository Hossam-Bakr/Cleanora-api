# R1-P08 US4 — Correct receipt identity before association

You are correcting one concrete implementation-review finding in the active R1-P08 US4 worktree. Follow `AGENTS.md`, the active R1-P08 specification, and the existing US4 tests. Do not touch unrelated dirty work.

## Finding to fix

`CatalogService.uploadServiceMedia` reserves a stable `mediaFileId`, sends it to `CatalogServiceImagePort.ingest`, validates the returned safe receipt, then transactionally authorizes `ingestReceipt.mediaFileId` but inserts `reservedMediaFileId` into the Catalog association. The public Media contract explicitly says Catalog reserves the stable identity before ingest; a non-matching receipt therefore must never be accepted.

## Required bounded change

1. After the existing safe-receipt validation and before finalization, require the receipt's `mediaFileId` to equal the reserved ID. If not, fail with the existing Catalog validation error class/code used for an invalid media receipt.
2. On that rejected path, do not run transaction-bound authorization, do not insert an association, do not complete the command receipt, and request cleanup only for the originally reserved ID. Never request cleanup for the foreign ID supplied in the receipt.
3. Add a targeted regression test in the existing US4 service/idempotency/compensation test area. The test must use a fake Media port returning a syntactically safe READY receipt with a different ID and prove the behavior above.
4. Preserve existing US4 behavior, module ownership, external APIs, schema/migrations/seeds, and task/status artifacts. No commits, database connections, migrations, or seed execution.

## Verification

Run and report:

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:r1-p08 -- tests/unit/catalog/catalog-media.service.test.ts tests/integration/catalog/catalog-media-compensation.test.ts tests/integration/catalog/catalog-media-idempotency.test.ts
```

Stop after this bounded correction and report files changed plus raw results.
