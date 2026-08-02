# Backend Architecture Overview

Cleanora is one Node.js/TypeScript application, one deployable backend, one
PostgreSQL database, and one Prisma schema.

Business capabilities become isolated modules only when their owning roadmap
phase begins. Modules own behavior and persistence access and communicate
through public contracts.

`shared` and `middlewares` contain only current business-neutral behavior.
`integrations` contains current email, Google, authentication, and rate-limit
adapters. Future providers are not scaffolded before their phase.

`R1-P00` contains architecture and system health/readiness behavior only. It
contains no product module, product table, migration, Docker, cloud deployment,
maps, WebSockets, tracking, marketer, or premium implementation.

Start with:

- `modular-monolith.md`
- `source-layout.md`
- `module-boundaries.md`
- `database-prisma.md`
- `release-constraints.md`
