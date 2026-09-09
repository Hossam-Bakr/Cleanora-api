<task>
Implement R1-P10 Batch A, tasks T001–T032, in D:/new_repos/Cleanora_R1 on branch codex/r1-p10-availability-capacity-textual-coverage. Read AGENTS.md, docs/ai/context-router.md, specs/R1-P10-availability-capacity-textual-coverage/{spec.md,plan.md,research.md,data-model.md,migration-plan.md,test-strategy.md,tasks.md}, contracts/, and DEC-053–DEC-060 in docs/product/decision-log.md.

Deliver the Phase 10 test boundary; additive Prisma schema and unapplied migration SQL; Egypt country-required `Africa/Cairo` seed/config transition; Staff locality/time-zone permissions and protected management; Configuration-owned City/District services, public transactional reader, routes and tests; Providers availability foundation; Provider textual coverage management/matching, routes and tests; composition/route wiring; task/evidence updates only for work actually completed.
</task>

<scope_and_ownership>
Configuration owns cities, districts and `platform.default_timezone` country resolution. Evolve the existing key; do not add a second timezone source. Providers owns availability configuration, textual coverage and its commands/history. Authentication owns permission catalog and authorization checks. Cross-module calls use only public contracts with opaque transaction factories.

Build on and preserve every pre-existing Phase 9 modification, especially src/modules/authentication/authentication.public.ts, src/modules/configuration/configuration.public.ts and related Providers files. Do not revert, reformat away, or overwrite Phase 9 behavior. Preserve all unrelated tracked/untracked files.

Implement only T001–T032. Do not implement Provider/Worker calendars, exceptions, pause, capacity, readiness, public evaluation, Swagger/Postman or final evidence beyond the foundation needed by this batch. Do not add Booking, reservation, Eligibility/Browse HTTP, maps/radius, frontend, Docker/cloud or wallets.
</scope_and_ownership>

<persistence_safety>
Incrementally update prisma/schema.prisma and create exactly prisma/migrations/r1_p10_availability_capacity_textual_coverage/migration.sql. Never edit any existing migration. Review SQL for no destructive operation. Do not connect to, inspect, create, reset, migrate or seed any database in this run. Database proofs are a later explicitly controlled batch.
</persistence_safety>

<implementation_contract>
Use current Express 5/Zod 4/Prisma 7 patterns and existing response/error envelopes. Add `@js-temporal/polyfill` because local Node 24 lacks global Temporal, but this batch need only establish the shared calendar utility foundation. Staff locality writes are versioned, idempotent, reason-bound and safely audited through catalog-driven permissions. Provider coverage replacement is versioned, UUID-idempotent, Serializable and exact Owner/Admin scoped for approved Providers in every operational state. Cross-Provider access is non-enumerating. City coverage dynamically covers active districts; inactive ancestry does not match. Localities deactivate rather than delete.

Use the exact Staff and Provider coverage paths in contracts/http-api.md. Database constraints and application validation must agree. Do not invent defaults beyond DEC-053–DEC-060. If a correct implementation requires a material product choice absent from those decisions, stop that dependent part and report it; continue independent work.
</implementation_contract>

<tests_and_verification>
Create `vitest.r1-p10.config.ts` and package scripts. Coverage include patterns must name all planned Phase 10 production behavior and changed integration seams, including unexecuted files when they exist; thresholds remain statements 80, branches 75, functions 80, lines 80. Do not exclude difficult files or weaken tests.

Before running tests, run Vitest list mode and report the exact selected files; confirm no historical-phase suite is selected. Run only Batch A Phase 10 tests or the current `npm run test:r1-p10`. Do not run full `npm test`, `test:unit`, `test:integration`, full coverage, or any historical phase test command. Do not run DB-dependent tests without an explicitly supplied disposable Phase 10 URL; report them as not run in this batch.

Run and repair: Prisma format/validate/generate, TypeScript typecheck, ESLint, build, `git diff --check`, and the non-DB Phase 10 tests. Inspect package scripts first. Do not run aggregate Postman/OpenAPI generation yet.
</tests_and_verification>

<action_safety>
Time limit: 75 minutes. Do not stage, commit, push, merge, switch branches, deploy, change phase approval/completion, consume credits, touch production/unknown databases, or delete/rewrite unrelated files/history. Leave all changes uncommitted. Do not mark tasks complete without evidence.
</action_safety>

<structured_output_contract>
End with: (1) completed and incomplete task IDs; (2) behavior implemented; (3) files changed, separating pre-existing-overlap files; (4) every command with exit code and test counts; (5) Vitest selected-file list and database-dependent tests not run; (6) migration SQL safety review; (7) coverage/config scope without claiming final coverage; (8) unresolved issues/decisions; (9) result/log paths. Do not claim model identity; relay metadata is authoritative.
</structured_output_contract>
