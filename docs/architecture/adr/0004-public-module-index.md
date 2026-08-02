# ADR-0004 — Direct named module contracts

- Status: Amended by R1-P02A
- Date: 2026-07-23
- Amended: 2026-07-30

## Decision

Modules expose named service or composition files. One-line `index.ts` barrels
are not required. Other modules may import one explicit public service but not
repositories or private HTTP code.

## Consequences

Routes, repositories, schemas, tests, and raw Prisma records stay owned by
their module. Import paths state the actual file being used.
