# Module Boundaries

- A module owns its business decisions and repositories.
- Other modules import only `#modules/<module-name>`.
- The root `index.ts` exports approved contracts and use cases, never controllers, repositories, route internals, tests, or raw Prisma records.
- Controllers translate validated HTTP input/output.
- Services/use cases own workflows and authorization-sensitive orchestration.
- Repositories own Prisma queries and persistence mapping.
- Cross-module workflows and transactions have one documented application-service owner.
- Shared code must remain business-neutral.

Boundary changes require architecture review and an ADR when they alter dependency direction.
