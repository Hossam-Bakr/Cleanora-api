# Modular Monolith

Cleanora is a single process and deployment unit with cohesive business modules.

Each module:

- Owns its rules, use cases, and table access.
- Exposes a narrow API from `index.ts`.
- Keeps HTTP, application workflow, and persistence responsibilities distinct.
- Maps persistence records into stable contracts when crossing a boundary.

Modules call public contracts in-process. Internal events are optional and local; they do not imply a broker or eventual consistency. PostgreSQL is authoritative. Redis, queues, notification providers, and Paymob are replaceable adapters.

Prohibited patterns include microservice networking, service discovery, cross-module repository access, a global service/repository folder, circular dependencies, and module-specific rules in `shared/`.
