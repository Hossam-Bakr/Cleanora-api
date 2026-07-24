# Implement Current Phase

1. Confirm exactly one active phase and complete phase artifacts.
2. Read only applicable rules and tasks.
3. Implement tasks in dependency order, staying inside scope.
4. Keep controllers thin, workflows in application services/use cases, and persistence in owning repositories.
5. Expose cross-module behavior through public contracts.
6. For database changes, use `prisma-phase-migration`.
7. Add unit, integration, authorization, idempotency, and migration tests as applicable.
8. Update `implementation-summary.md` with files, decisions, deviations, migrations, and checks.
9. Run discovered repository checks and report actual results.
10. Do not commit or push.
