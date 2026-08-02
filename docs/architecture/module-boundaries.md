# Module Boundaries

- A module owns its business rules and persistence access.
- Routes call controllers; controllers call services; services call Prisma or
  a useful repository.
- A module may import one named service from another module, never its
  repository or private HTTP files.
- Controllers translate HTTP input/output and contain no major business logic.
- Repositories group reusable or transactional Prisma operations. Do not create
  an interface for one implementation.
- `shared` is business-neutral and must not import modules.
- Cross-module transactions have one explicit owner.
- Circular dependencies and one-line public barrel files are prohibited.
