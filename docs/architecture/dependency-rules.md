# Dependency Rules

Allowed direction:

```text
app/server -> modules/public APIs
app/server -> integrations + core
routes composition -> module registrars/public APIs
module routes/controllers -> module services
module services -> own repositories + other module public APIs + core ports
module repositories -> injected centralized Prisma client
integrations -> core ports + external packages/providers
background-jobs composition -> owning module public worker contract + integrations
all -> genuinely generic shared code
```

Forbidden:

- Module-to-module internal imports
- Module-to-module repository or Prisma queries
- Core depending on a product module or concrete integration
- Shared depending on a product module
- Circular module dependencies
- Repositories orchestrating business workflows
- Global business controllers or repositories under `src/routes` or `src/core`

Native Node package import maps (`#config`, `#core`, `#generated`,
`#integrations`, `#modules`, `#routes`, and `#shared`) provide development and
emitted-code resolution without a rewrite package. Static boundary enforcement
beyond resolution and review remains Proposed in ADR-0005.
