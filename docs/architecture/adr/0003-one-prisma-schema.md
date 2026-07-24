# ADR-0003 — One Prisma schema with module ownership

- Status: Accepted
- Date: 2026-07-23

## Context

Cleanora uses one PostgreSQL database while modules must not query each other's tables directly.

## Decision

Keep all persistence models in `prisma/schema.prisma`. Document the owning module/phase for each introduced model and restrict queries to its repository.

## Consequences

There are no duplicate ORM classes or per-module Prisma clients. Phase-owned migrations evolve one history incrementally.
