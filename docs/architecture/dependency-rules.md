# Dependency Rules

Allowed direction:

```text
server -> app + database + current integrations
app -> global middleware + central routes
central routes -> module routers
module route -> controller -> service -> own repository/database
current provider adapters -> the module contract they implement
all -> genuinely generic shared code
```

Forbidden: dynamic route discovery, DI containers, circular module imports,
cross-module repository access, business code in `shared`, and global business
controllers under `routes`.

Native package-import aliases cover `config`, `database`, `generated`,
`integrations`, `middlewares`, `modules`, `routes`, and `shared`.
