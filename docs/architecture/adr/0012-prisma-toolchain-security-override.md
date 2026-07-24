# ADR-0012 — Prisma toolchain security override

- Status: Accepted
- Date: 2026-07-24

## Context

Prisma 7.9.0 depends on `@prisma/dev`, which pinned `find-my-way` 9.6.0.
That version is affected by GHSA-c96f-x56v-gq3h. Downgrading Prisma to 7.8.0
reintroduced separate moderate Hono server advisories.

## Decision

- Keep `prisma`, `@prisma/client`, and `@prisma/adapter-pg` aligned at 7.9.0.
- Override only the transitive `@prisma/dev` dependency from
  `find-my-way` 9.6.0 to the patched compatible 9.7.0 release.
- Keep the override visible in `package.json`.
- Run `npm audit`, Prisma generate/validate, typecheck, build, and tests after
  dependency changes.
- Remove the override when a later aligned Prisma release includes a patched
  transitive dependency.

## Consequences

The installed dependency graph reports zero known npm vulnerabilities while
retaining the current Prisma API. The override is tooling-only and does not
enter the deployed business runtime.
