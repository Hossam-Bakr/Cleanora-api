# Source Layout

```text
src/
├── background-jobs/ # Process-level worker composition
├── config/          # Validated environment and constants
├── core/            # Business-neutral ports, errors, HTTP, and security
├── generated/       # Ignored Prisma-generated client
├── integrations/    # Concrete external-service and database adapters
├── modules/         # Phase-owned business capabilities
├── routes/          # Application-level route registration only
├── shared/          # Business-neutral types, utilities, and testing support
├── app.ts           # Express composition root
├── index.ts         # Programmatic exports
└── server.ts        # Process startup and graceful shutdown
prisma/              # One schema, migrations, and seed entry
scripts/             # Safe local inspection and maintenance commands
tests/
├── unit/
├── integration/
├── e2e/
└── helpers/
```

Business controllers and routes remain inside their owning module.
`src/routes` must not become a global business layer.

Generated output goes to `dist/`, never `src/`. Prisma-generated source is
ignored and regenerated after schema changes.

Internal imports use native `package.json#imports` aliases. The `development`
condition targets TypeScript source; the default condition targets emitted
JavaScript. Development commands must enable the `development` condition.
