# Backend Architecture Overview

Cleanora is one Node.js/TypeScript application, one deployable backend, one
PostgreSQL database, and one Prisma schema.

Business capabilities become isolated modules only when their owning roadmap
phase begins. Modules own behavior and persistence access and communicate
through public contracts.

`core` supplies business-neutral ports and cross-cutting contracts.
`integrations` supplies controlled adapters for PostgreSQL, cache, queues,
notifications, email, payments, object storage, security tooling, and logging.

`R1-P00` contains architecture and system health/readiness behavior only. It
contains no product module, product table, migration, Docker, cloud deployment,
maps, WebSockets, tracking, marketer, or premium implementation.

Start with:

- `modular-monolith.md`
- `source-layout.md`
- `module-boundaries.md`
- `database-prisma.md`
- `release-constraints.md`
