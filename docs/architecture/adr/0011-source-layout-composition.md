# ADR-0011 — Root composition and integration layout

- Status: Accepted
- Date: 2026-07-24

## Context

The project needs obvious root entry files while preserving modular-monolith
ownership and keeping external SDKs out of business modules.

## Decision

- `src/app.ts` builds the Express application.
- `src/server.ts` owns process startup and graceful shutdown.
- `src/routes` owns route registration only; module routes remain inside modules.
- `src/integrations` owns concrete PostgreSQL, logging, email, cache, queue,
  payment, push, SMS, and storage adapters.
- `src/background-jobs` owns process-level worker composition; job behavior
  remains inside the owning business module.
- `src/core` owns business-neutral ports, errors, HTTP helpers, and security
  contracts.

## Consequences

The requested developer-facing layout is available without creating global
business controllers, repositories, or services.
