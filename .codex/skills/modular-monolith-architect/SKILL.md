---
name: modular-monolith-architect
description: Define Cleanora modular-monolith boundaries, ownership, dependency direction, public APIs, shared-code placement, cross-module communication, and transaction ownership. Use when planning architecture or deciding where active-phase behavior and persistence belong.
---

# Modular Monolith Architect

1. Read the active phase requirements and applicable architecture rules.
2. Identify cohesive business capabilities and assign each behavior and persistence operation one owner.
3. Define inbound use cases and the smallest stable public `index.ts` or approved contract surface.
4. Direct dependencies toward public contracts; prohibit circular dependencies and cross-module repository access.
5. Choose direct application calls by default. Use internal domain/application events only when they reduce coupling and their consistency semantics are explicit.
6. Keep infrastructure behind controlled adapters and keep module-specific rules out of shared code.
7. Name the application service and transaction owner for cross-module atomic work.
8. Record invariants, dependency direction, public contracts, persistence ownership, and rejected alternatives.

Do not introduce microservice networking, service discovery, a global God service, or future-phase modules.
