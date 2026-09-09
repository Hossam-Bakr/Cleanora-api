# R1-P10 continuation prompt for Cursor with Codex delegation

Work in `D:\new_repos\Cleanora_R1`.

You are Cursor Agent. You are the primary Cleanora project manager, Spec Kit coordinator, implementation orchestrator, architecture reviewer, and quality-gate owner for the continuation of:

`R1-P10 — Availability, Capacity & Textual Coverage`

Phase directory:

`specs/R1-P10-availability-capacity-textual-coverage/`

Continue the existing work to technical commit readiness. Do not restart the phase, regenerate valid artifacts, or discard any existing work. This is a fresh continuation explicitly authorized by the owner. The five-hour window mentioned in the original September 7 prompt is historical and must not be used as a reason to stop this continuation. Record the fresh start time, work autonomously, and preserve a resumable checkpoint if an external limit prevents completion.

## Non-negotiable Git and safety boundary

- The required branch already exists and must remain checked out: `codex/r1-p10-availability-capacity-textual-coverage`.
- Confirm the branch before editing. If it differs, stop phase edits and report the mismatch.
- Do not stage, commit, push, merge, deploy, run a production migration, force-push, rewrite history, reset, clean, stash, or checkout away changes.
- The Git workflow becomes authorized only if the human later sends the exact standalone message `commit and push`. That authorization has not been given in this handoff.
- Preserve all unrelated tracked modifications and untracked files. The working tree was already heavily dirty before Phase 10.
- Never run `git reset`, `git clean`, destructive checkout/restore commands, or recursive deletion against an unverified path.
- Never use the repository `.env`, an unknown database, or any production-like database for migration/tests.
- No Docker or cloud work. No stored-value wallets. No future Browse, Eligibility, Booking, maps, coordinates, or radius behavior.

Historical preservation snapshots exist outside the repository at:

- `C:\Users\hossa\AppData\Local\Temp\cleanora-r1-p10-20260907-1849\baseline-status.txt`
- `C:\Users\hossa\AppData\Local\Temp\cleanora-r1-p10-20260907-1849\baseline.patch`
- `C:\Users\hossa\AppData\Local\Temp\cleanora-r1-p10-20260907-1849\baseline-hashes.json`

Read them before cleanup or any decision about whether a file is disposable. Create a fresh continuation snapshot outside the repository before new implementation. Treat the historical snapshot and current diff together as preservation evidence; neither alone proves ownership of every file.

## Start with the repository instructions and live phase truth

1. Read `AGENTS.md`.
2. Read `docs/ai/context-router.md`.
3. Read `docs/product/current.md` and verify R1-P10 is still the active phase.
4. Read the Phase 10 `activation.md`, `spec.md`, `plan.md`, `data-model.md`, `tasks.md`, `test-strategy.md`, contracts, and current evidence/checkpoint files. Do not load future phase specifications.
5. Inspect `git status --short`, the Phase 10 diff, and the historical baseline. Do not assume all dirty files belong to Phase 10.
6. Read the smallest applicable repository skills when reaching their step. In particular, read `.agents/skills/codex-delegate/SKILL.md` before delegating anything to Codex. Also use the repository's project-management, module-boundary, Prisma-migration, and Spec Kit convergence/reconciliation instructions where applicable.

Canonical product decisions are already approved in `docs/product/decision-log.md`. Do not ask them again:

- `DEC-053`: Staff manages one IANA time zone per country; Egypt uses `Africa/Cairo`; Providers and Workers inherit the country setting.
- `DEC-054`: schedule intervals are start-inclusive/end-exclusive; adjacency is allowed; overlaps are rejected; overnight periods use an explicit next-day flag, are positive and at most 24 hours, split at local midnight for dated exceptions, and a date exception replaces that civil date entirely; an empty exception is a holiday; Worker availability is intersected with Provider availability.
- `DEC-055`: one capacity unit is one complete Team available for the full interval; the Team must be active, contain a valid cleaner, and every current member must be active and available; Escorts add no units but must be available; unteamed Workers add no capacity; available units are `min(configured simultaneous-Team limit, available complete Teams)`; this is potential supply only and creates no Booking/reservation/busy-time guarantee.
- `DEC-056`: Staff owns localized country/city/district truth; Providers may select whole cities or individual districts only in their own country; whole-city coverage dynamically includes active and newly added districts; localities are deactivated rather than deleted; inactive country/city/district ancestry cannot match; Providers cannot create place names.
- `DEC-057`: one immediate Provider pause may have an optional end time; Owner/Admin can resume it; any overlapping evaluation is unavailable with zero capacity; expiry/resume does not alter approval, suspension, or go-live state.
- `DEC-058`: an active exact-scope Owner may manage Phase 10 settings without the global `provider_admin` capability; an active exact-scope Admin requires that enabled capability; Workers/Supervisors do not gain management access; the Provider must be approved, while operational state may be `INACTIVE`, `LIVE`, or `SUSPENDED`.
- `DEC-059`: Providers exposes narrow internal public contracts for candidate Provider IDs and one-Provider operational evaluation; management uses protected HTTP; Phase 10 exposes no customer/anonymous evaluation HTTP.
- `DEC-060`: readiness is configuration/setup readiness and remains distinct from runtime feasibility; use the exact approved coverage, availability, and capacity readiness gates from the decision/spec.

## Current verified state

The phase is on `codex/r1-p10-availability-capacity-textual-coverage`.

Tasks `T001–T032` are marked complete and Batch A currently contains:

- Phase 10 Vitest selection and coverage configuration.
- Additive Prisma schema and `prisma/migrations/r1_p10_availability_capacity_textual_coverage/migration.sql`.
- Staff country time-zone and localized City/District administration.
- Provider textual coverage management and matching foundation.
- Dedicated DEC-058 authorization policy.
- Configuration-to-Providers transaction-bound locality reader.
- UUID idempotency receipts, actor binding, safe history/audit, and conflict-safe `createMany({ skipDuplicates: true })` reservation.
- Static migration checks and Phase 10 module-boundary tests.

The last independently verified non-database results were:

- `npm run test:r1-p10`: 102 passed, 33 skipped, 0 failed; the skipped tests are explicitly guarded live-database tests.
- `npx prisma validate`: passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Scoped Phase 10 ESLint: passed.
- `git diff --check`: passed.
- `prisma/schema.prisma` ordinary diff: 284 additions and 0 deletions. Preserve that semantic additive shape; do not run `prisma format` blindly because it previously produced repository-wide formatting churn.

No approved disposable PostgreSQL target is currently available. Relevant environment variables/listeners/CLI were checked and no safe target was found. Keep database suites honestly skipped behind the explicit Phase 10 test URL guard. Complete every non-database gate first. If a safe explicitly phase-named disposable target later becomes available, use it for clean chronological install and populated R1-P09 upgrade evidence; otherwise report that evidence as missing rather than claiming success.

## Mandatory Batch A repair before T033

The green Batch A suite still has three concrete acceptance gaps found by direct code audit. Fix them before accepting Batch A or starting later behavior:

1. **Active locality ancestry on writes and matches**
   - `data-model.md` requires active ancestry for coverage writes and matches.
   - `ProviderAvailabilityService.validateSelectionsAgainstLocalities` currently validates existence and country ownership but does not reject inactive City/District/country ancestry.
   - Configuration's public locality facts currently omit enough ancestry status for a District and omit country activity for a City.
   - Extend only the narrow Configuration public fact contract needed by Providers. Keep Configuration persistence private and transaction-bound.
   - Reject a coverage replacement when the selected City's country/City is inactive, or when the selected District's country/City/District is inactive.
   - Matching must also fail for inactive country/City/District ancestry.
   - Add meaningful service and matching tests for every inactive ancestor and retain same-country checks.

2. **Stable accepted replay before mutable locality validation**
   - The same actor, scope, idempotency key, and fingerprint must replay the stored accepted result without another mutation/history record.
   - `replaceCoverage` currently revalidates mutable locality state before reading the command receipt. A successful command can therefore stop replaying if a locality is later deactivated.
   - Keep fresh authorization checks. Compute the exact fingerprint, reserve/read the receipt inside the same Serializable transaction, return an accepted replay immediately, and validate mutable locality facts only for a new `PROCEED` command.
   - Add a test: accept a coverage command, make the fake locality ancestry inactive, retry the identical command, receive the original safe result with `replayed: true`, and prove no additional history/mutation.

3. **Bounded whole-transaction retry for Serializable races**
   - `createMany({ skipDuplicates: true })` avoids querying an aborted transaction after P2002, but Serializable transactions can still fail with Prisma `P2034`/`P2028` or SQLSTATE `40001`/`40P01`, particularly around concurrent `ON CONFLICT` and version writes.
   - Add a small bounded retry (maximum three whole transaction attempts) for Provider availability mutation UoWs and Configuration locality mutation UoWs. Retry only recognized serialization/deadlock failures. Never retry validation, authorization, stable version conflicts, idempotency conflicts, or arbitrary dependency errors.
   - Because the whole transaction rolls back, rerun the complete callback with the same idempotency key. On exhaustion, map to the existing stable conflict error with retryable serialization details instead of leaking a generic 500.
   - Extend `isProviderAvailabilitySerializationFailure` to recognize both raw Prisma/driver failures and the already-mapped `ProviderAvailabilityError` serialization form if needed.
   - Add pure UoW/retry tests that prove success after one/two serialization failures, no retry for non-serialization errors, and stable exhaustion after three attempts. Add a DB-gated concurrent same-key test if the existing live harness can express it safely, but do not fabricate live success without a database.

After this repair, rerun the Phase 10 manifest, Phase 10 tests, Prisma validation, typecheck, build, scoped lint, module-boundary checks, and `git diff --check`. Review the actual diff; do not accept task checkboxes or delegate reports by themselves.

## Delegation model: Cursor orchestrates and Codex is the delegate

You, Cursor, own the phase continuation. You decide the dependency order, write the briefs, dispatch Codex, inspect Codex's actual changes, repair or reject bad work, rerun the gates, and make the final technical-readiness judgment. Do not ask the owner whether to continue between already-authorized batches.

Use `.agents/skills/codex-delegate/SKILL.md` and its bundled relay for substantial or high-risk work where Codex should guide or assist you. This owner message explicitly authorizes that delegation. Keep each delegation coherent and bounded; do not send the entire remainder of Phase 10 as one enormous request.

When you invoke `codex-delegate`:

- Verify `codex --version`, the executable on PATH, and authentication once at the beginning.
- Write a self-contained brief because Codex receives no Cursor conversation memory.
- Include the phase goal, exact task IDs, approved decisions, relevant file paths, permitted edit scope, out-of-scope behavior, preservation rules, real validation commands, time limit, and report contract.
- For architecture direction, module boundaries, Serializable concurrency, migration SQL, time-zone/DST semantics, capacity semantics, privacy, or adversarial review, dispatch Codex with `--read-only`. Require concrete findings, file/line references, proposed code shape, and meaningful tests. Apply only guidance you verify against the repository.
- For a bounded implementation or repair subtask, dispatch write-capable Codex without `--read-only`, restrict its permitted files, explicitly prohibit commit/push/merge/deploy/database destruction, then inspect the working tree and rerun all relevant gates yourself.
- Never let Codex's final report substitute for reading the diff. Read `result.json`, record the actual resolved model/tool metadata, inspect every touched file, and independently verify its claims.
- Do not create a delegation loop. The delegated Codex process must not invoke Cursor, `cursor-delegate`, `codex-delegate`, or any other agent. It performs only the exact task in its brief and returns control to you.
- Do not run Cursor and a write-capable Codex delegate against overlapping files at the same time. Stop your own writes while that delegate is active. Read-only Codex review may run alongside unrelated read-only inspection.
- Store relay briefs/results/logs outside the repository when possible. If a brief must temporarily live in the phase directory, classify and remove it during the final provenance-based cleanup after its useful facts have been copied into canonical evidence.
- If Codex is unavailable or unauthenticated, record the exact blocker and continue safe Cursor work that does not depend on it. Do not claim the requested delegation occurred.

Use Codex at least at these high-risk checkpoints unless an equivalent Codex result is already present and independently verified:

1. A read-only review of the three mandatory Batch A repair items, especially whole-transaction retry behavior under PostgreSQL Serializable isolation.
2. A bounded implementation or repair delegation for the Batch A gaps or a clearly isolated part of Batch B, followed by your full diff review and independent gates.
3. A read-only design/review of DEC-054 calendar normalization, DST gaps/repeated times, dated-exception midnight splitting, and Worker/Provider intersection before accepting the calendar implementation.
4. A read-only adversarial review of complete-Team capacity, module boundaries, privacy, migration SQL, public evaluation, and readiness before final convergence.

You remain responsible for every accepted result. Neither you nor delegated Codex may commit, stage, push, merge, deploy, or change owner approval state.

## Remaining implementation order

Use `tasks.md` as the exact task authority and preserve dependencies. Recommended bounded queue:

### Repair batch

Fix the three Batch A gaps above. Keep the repair narrow. Do not mark additional task IDs complete merely because foundational code was touched.

### Batch B1 — `T033–T044`

Implement and prove Provider calendars and temporary pauses:

- Half-open interval rules, adjacency, overlap rejection, explicit overnight periods, maximum 24-hour duration, local-midnight normalization, holidays, dated exception replacement, and DST gap/repeated-time behavior through the Temporal-based utility.
- Full Provider weekly schedule and exception replacement with expected version, UUID idempotency, actor binding, safe replay/history, and Serializable protection.
- Protected HTTP schemas/controller/routes and exact Provider isolation under DEC-058.
- Start/read/resume/automatic-expiry pause behavior with one unresolved pause.
- Suspension and pause block runtime evaluation without erasing configuration/readiness.

### Batch B2 — `T045–T056`

Implement and prove Worker calendars and complete-Team capacity:

- Provider-owned Worker schedule/exception replacement with Worker ownership, version/idempotency, privacy, and cross-Provider isolation.
- Effective Worker availability is the intersection of Worker and Provider availability after local-time normalization.
- Capacity rule replacement, versioning, idempotency, and concurrency.
- One unit equals a complete available Team. All current members must be active and available for the full requested interval; the Team must be active and include at least one current membership with `cleans = true`; Escorts/non-cleaners add no units but must be available; unteamed Workers add no units; foreign/inactive workforce cannot contribute.
- Prove three available Teams with a Provider limit of two returns two, incomplete Teams do not contribute, and one incomplete Team does not block another valid Team.

### Batch C — `T057–T065`

Implement and prove narrow public operational reads and readiness:

- Providers-owned candidate-ID lookup for an active textual area.
- One-Provider evaluation for textual location, UTC interval, and required complete-Team units.
- Stable blocker codes; country IANA zone; coverage/availability/capacity facts; available units; relevant versions.
- RepeatableRead snapshot consistency and transaction-bound Configuration public readers.
- Exact DEC-060 readiness facts in the existing readiness policy/projection path.
- No private Worker contacts and no other Provider's settings in projections.
- No customer/anonymous Phase 10 evaluation route.

### Documentation, proof, and convergence — `T066–T077`

- Add source OpenAPI and runtime Swagger fragments for every delivered protected management endpoint.
- Generate and validate the Phase 10 Postman collection with safe examples and usable variables.
- Add parity/safety tests and update API/Swagger/script navigation using existing repository conventions.
- Add the Phase 10 upgrade validator and meaningful unit tests.
- Run and record all non-database gates and the exact Phase 10 test/coverage selection.
- Produce honest migration evidence: live clean/upgrade proof only on an explicitly approved disposable Phase 10 database; otherwise record it as the remaining publication gate.
- Run module-boundary, authorization, privacy, SQL, and final-diff review after the last repair.
- Reconcile spec, plan, contracts, tasks, implementation, review report, evidence, and summary. Never mark a task complete without its deliverable and evidence.

## Test and quality rules

The owner's explicit test scope is Phase 10 only. Do not run the entire historical unit, integration, end-to-end, or coverage suite.

Before expensive tests, run list mode and inspect the resolved file set:

`node --require ./scripts/register-env.cjs ./node_modules/vitest/vitest.mjs list --config vitest.r1-p10.config.ts`

Required Phase 10 commands include, after inspecting their scripts:

- `npm run test:r1-p10`
- `npm run test:coverage:r1-p10`
- `npx prisma validate`
- `npm run prisma:generate`
- `npm run typecheck`
- scoped ESLint for Phase 10 production/tests and changed integration seams
- `npm run build`
- Phase 10 OpenAPI, Swagger, Postman, documentation, migration-validator, and module-boundary checks added by the tasks
- `git diff --check`

Required measured coverage over every Phase 10 production file and relevant changed integration seam, including unexecuted files:

- Statements: at least 80%
- Branches: at least 75%
- Functions: at least 80%
- Lines: at least 80%

Do not lower thresholds, remove difficult files from include patterns, add ignore comments, delete meaningful tests, or add empty assertions to inflate coverage. Repair real gaps. Record all four final metrics and the exact include scope. State explicitly that the full historical regression/coverage suites were not run.

Use meaningful tests for invalid input, version conflicts, idempotent replay, cross-actor key reuse, concurrent transactions, inactive ancestry, authorization/isolation, DST and overnight boundaries, exception precedence, pause boundaries, capacity completeness, privacy, readiness/runtime separation, and stable public blockers.

Do not treat skipped live-database tests as passed. Report passed, failed, and skipped counts separately.

## Migration and schema rules

- Keep the schema incremental and the migration owned by R1-P10.
- Never edit any earlier migration.
- Review SQL directly after every schema-affecting change.
- Preserve the deterministic PostgreSQL-core `md5` backfill ID; do not introduce `gen_random_uuid()` or an undeclared extension.
- Preserve ordering: add `country_configs.version`, backfill active country time zones including Egypt `Africa/Cairo`, then switch `platform.default_timezone` to `COUNTRY_REQUIRED`.
- Preserve all earlier data/contracts. No destructive reset.
- Avoid broad `prisma format` churn. If format is required, first prove its diff is semantic and restore any unrelated formatting change.
- Live validation requires an explicitly phase-named disposable target such as `cleanora_r1_p10_*_test` or `*_proof` and separate owner/environment authorization. A missing target is evidence still required, not permission to use another database.

## End-of-phase working-tree cleanup

The owner wants the repository working directory cleaned after the phase is technically complete. Cleanup is part of this continuation, but it must be provenance-based and must happen only after final evidence has captured all useful information.

Follow this exact cleanup protocol:

1. Inventory every tracked modification and untracked path with `git status --short`, compare against the historical baseline and fresh continuation snapshot, and classify each item as:
   - canonical Phase 10 deliverable;
   - temporary Phase 10/delegation artifact;
   - pre-existing or unrelated user work;
   - uncertain provenance.
2. Keep all canonical deliverables: approved spec/plan/research/data model/tasks/contracts/checklists, activation, implementation/migration evidence, final review/summary, Prisma schema and Phase 10 migration, production code, Phase 10 tests/config, OpenAPI/Swagger, generated Phase 10 Postman collection/generator, validators, and required navigation/docs.
3. Remove only confirmed temporary Phase 10/delegation artifacts after their useful facts are copied into canonical evidence. Expected candidates include:
   - `specs/R1-P10-availability-capacity-textual-coverage/cursor-batch-a-brief.md`
   - `specs/R1-P10-availability-capacity-textual-coverage/cursor-batch-a-repair-brief.md`
   - `specs/R1-P10-availability-capacity-textual-coverage/cursor-batch-a-final-repair-brief.md`
   - later `codex-*-brief.md` or `cursor-*-brief.md` files created only for delegation;
   - `specs/R1-P10-availability-capacity-textual-coverage/implementation-prompt.md` if fully superseded by canonical final evidence;
   - `specs/R1-P10-availability-capacity-textual-coverage/checkpoint.md` only if a final implementation summary/evidence fully supersedes it and no workflow requires it;
   - this `cursor-continuation-and-codex-delegation-prompt.md` after the continuation is complete;
   - `.tmp-r1p10-*`, Phase 10-only scratch manifests, relay logs accidentally written inside the repository, temporary test output directories, and regenerable `coverage/r1-p10` output after metrics are recorded, when none is a required tracked artifact.
4. Preserve known pre-existing/unrelated paths unless direct evidence proves they are safe and redundant. This includes P08/P09 modifications and artifacts, `.tmp-rerun-fails.txt`, `.tmp-test-run/`, `scripts/tmp-*` files, the P09 frontend guide, duplicate Postman working directories, `code-security.datadog.yaml`, `.agents/skills/**`, and `skills-lock.json`. Do not assume their names make them disposable; many existed before Phase 10.
5. Treat uncertain provenance as user work and preserve it. Report it instead of deleting it.
6. On Windows, resolve every deletion target to an absolute path and verify it remains within `D:\new_repos\Cleanora_R1` before removal. Use one PowerShell flow with literal paths or a patch-based file deletion. Never enumerate in one shell and pass paths to another shell for deletion. Never recursively delete a computed/unverified target.
7. After cleanup, rerun `git status --short`, compare it with both snapshots, search for dangling references to removed handoff files, rerun the affected Phase 10 gates, and list every removed path in the final implementation summary.

Do not delete canonical evidence merely to make `git status` shorter. The goal is a reviewable working tree containing required Phase 10 deliverables plus preserved unrelated owner work.

## Progress, evidence, and report contract

After each accepted batch, update a concise repository-local checkpoint with:

- accepted task IDs;
- remaining task IDs;
- important decisions already applied;
- Codex delegation session/result locations;
- actual changed files;
- exact command results and exit codes;
- live-database skips/blockers;
- next action.

Never write secrets into evidence.

For every Codex delegation, require a report containing:

- resolved tool/model identity from relay metadata;
- changed files;
- behavior implemented;
- tests added/changed;
- commands and exit codes;
- pass/fail/skip counts;
- coverage metrics and include scope when applicable;
- unresolved risks/blockers;
- result/log paths;
- explicit confirmation that no commit/push/merge/deploy/database destruction occurred.

Treat every report as a claim. Inspect the working tree and rerun the relevant commands independently.

Final output must report:

- readiness status;
- delivered Phase 10 behavior;
- accepted task IDs and any incomplete task IDs;
- Codex delegation summary and verified resolved models;
- every `codex-delegate` use and what guidance/implementation you accepted or rejected;
- exact verification commands and results;
- test pass/fail/skip counts;
- all four coverage metrics and measured scope;
- Swagger/OpenAPI and Postman paths;
- schema/migration changes and live validation evidence or exact missing proof;
- architecture/security/privacy/review findings and resolutions;
- every temporary path removed and every uncertain/unrelated path intentionally preserved;
- remaining owner/publication gates;
- elapsed time and a resumable checkpoint if unfinished.

Use this sentence only if the evidence truly supports it:

`Phase 10 is technically ready for commit and push; awaiting owner approval/publication.`

Do not claim technical readiness while the three mandatory Batch A gaps, tasks `T033–T077`, required coverage, final documentation, or blocking review findings remain unresolved. Do not ask whether to continue between already-authorized batches. Start now by verifying the branch/current phase and preservation snapshots, reading `codex-delegate/SKILL.md`, checking Codex CLI/authentication, and dispatching a read-only Codex review of the Serializable retry design. Then send Codex a bounded repair/implementation brief, inspect its work yourself, and continue the remaining batches.
