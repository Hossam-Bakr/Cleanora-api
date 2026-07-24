# ADR-0004 — Public module API through index.ts

- Status: Accepted
- Date: 2026-07-23

## Context

Unrestricted internal imports make module boundaries unenforceable.

## Decision

Every business module exposes approved contracts through its root `index.ts`. Other modules import only `#modules/<module-name>`, a native package-import mapping to that index.

## Consequences

Repositories, controllers, routes, private schemas/types, tests, and Prisma records remain internal.
