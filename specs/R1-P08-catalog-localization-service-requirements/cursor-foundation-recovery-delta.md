# Cursor Resume Delta — Repair Foundation, Then Continue R1-P08

Resume session `7f8ff031-46c0-46c4-844f-94dc0b56a097`. The relay process was
interrupted before it wrote `result.json`, but the working tree is authoritative
and contains your partial implementation. Do not restart or overwrite it.

Before T033, repair and re-verify T001–T032:

1. Restore all pre-existing assertions and scenarios from `HEAD` in:
   - `tests/unit/modules/authentication/authorization-catalog.test.ts`
   - `tests/unit/modules/authentication/authorization-staff-separation.test.ts`

   Your current diff replaced those entire regression suites with shorter
   R1-P08 suites, removing prior role/permission/reason/privacy/staff-separation
   coverage. That is forbidden. Reconstruct the existing test bodies from
   `git show HEAD:<path>` (read-only Git only), retain them, and add R1-P08
   assertions additively. A separate new R1-P08 Authentication test file is
   acceptable. Do not weaken, delete, skip, or broaden any existing assertion.

2. Correct the Media ownership placement for T019:
   - Remove `PrismaTransactionalCatalogServiceImageAuthorizer` and its
     Catalog-specific import from
     `src/modules/media/infrastructure/worker-avatar.adapter.ts`.
   - Implement the Catalog READY/owner/purpose read/authorization primitives in
     `src/modules/media/infrastructure/prisma-media.repository.ts`, as T019
     requires, or in a narrowly Catalog-image-specific Media adapter only if
     `prisma-media.repository.ts` remains the persistence owner.
   - Update `media-provider.factory.ts` imports/wiring accordingly.
   - Do not couple Catalog images to Worker-avatar infrastructure.
   - Verify whether T018's required `media.ports.ts` extension is actually
     needed by the frozen contract. If the task's named contract is not
     satisfied, implement it or leave T018 unchecked and report the mismatch.

3. Audit every current `[X]` from T001–T032 against its exact task text and
   files. Reopen T019 and T032 immediately while repairing. Reopen any other
   checkbox whose exact code/test/evidence is missing. Never mark a task merely
   because adjacent scaffolding exists.

4. Re-run and make green before re-checking T032:

```powershell
npm.cmd run prisma:validate
npm.cmd run prisma:generate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:r1-p08
git diff --check
```

Codex independently reran the current tree and observed:

- typecheck exit 0
- lint exit 0
- test:r1-p08: 10 files passed, 57 passed, 1 skipped
- diff check exit 0

The one skip is the explicitly guarded live PostgreSQL migration-contract suite
because no R1-P08 database target is approved. Keep it guarded and do not run
or claim it as live evidence. Record it as blocked, not as a passing database
proof. Do not introduce any additional skip/todo/quarantine.

5. After Foundation is repaired and its safe gates pass, continue from T033 in
dependency/TDD order. Preserve every rule in the original
`implementation-prompt.md`, especially:

- protected staff-management HTTP only; no anonymous/customer Browse route;
- no unknown/live database use;
- no Git staging/commit/push/branch action;
- no changes to the unrelated dirty paths;
- no independent Codex/Claude/completion tasks T153–T156;
- mark only truthful task completion.

If the resumed run cannot finish all remaining implementation tasks, stop at a
clean story checkpoint and report exact completed/open task ranges and gates.

End with the original seven-part structured report.
