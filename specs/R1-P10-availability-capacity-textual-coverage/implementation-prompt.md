# R1-P10 Cursor Implementation Prompt

Implement tasks.md in dependency order through bounded batches. Read spec.md, plan.md, DEC-053–DEC-060, data-model.md, contracts/, migration-plan.md and test-strategy.md. Preserve every pre-existing Phase 9/local modification and unknown file. Report exact changed files and command exit codes after each batch.

Use Configuration for localities/time zones and Providers for coverage/scheduling/capacity/pause/readiness. Use only public contracts across modules. Follow current Express/Zod response/error, authorization, idempotency, audit and Prisma UoW patterns. Do not broaden into Booking, reservations, Eligibility/Browse HTTP, maps/radius, frontend, Docker/cloud or wallets.

Never stage, commit, push, merge, deploy, alter phase approval, edit applied migrations or connect to an unknown/production database. Phase 10 tests only; never run full historical suites. A database proof may use only the explicitly authorized phase-named disposable local/test target and must record the URL safely without secrets.
