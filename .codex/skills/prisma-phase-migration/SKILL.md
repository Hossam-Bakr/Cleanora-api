---
name: prisma-phase-migration
description: Plan, create, review, and validate incremental Cleanora Prisma schema changes and phase-owned migrations. Use whenever an active phase adds or changes persisted data, relations, indexes, constraints, enums, seeds, or backfills.
---

# Prisma Phase Migration

1. Inspect the current `prisma/schema.prisma` and complete migration history.
2. Identify only active-phase new and changed module-owned models.
3. Document relations, constraints, indexes, defaults, backfills, data risk, compatibility, and forward-fix strategy.
4. Update the centralized Prisma schema incrementally.
5. Create a clearly named phase-owned migration using the repository's discovered scripts.
6. Review generated SQL before applying it; never edit an applied migration.
7. Update seeds when required and keep historical/financial records safe and decimal-correct.
8. Regenerate Prisma Client, validate the schema, apply on a clean test database, and run database and compatibility tests.
9. Report models, migration name, SQL risks, validation commands/results, and unresolved decisions.

Never create future-release models early or depend on another schema.
