# Business Modules

Create only modules owned by the active phase. Each module owns its behavior and table access and exposes approved contracts through its root `index.ts`.

Other modules may import only `#modules/<module-name>`. It resolves to the module's public `index.ts`. They must not import repositories, controllers, routes, private schemas/types, tests, or Prisma implementations.

See `docs/architecture/module-template.md` before scaffolding a module.
