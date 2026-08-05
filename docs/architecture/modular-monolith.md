# Modular Monolith

Cleanora is one Node.js process, one deployment unit, one PostgreSQL database,
and one Prisma schema.

## Navigation

Start at `src/server.ts` to follow the process from environment validation to
runtime composition, Express creation, route mounting, listening, and graceful
shutdown. The normal reading path is:

```text
server.ts
  -> composition.ts
  -> app.ts
  -> routes/index.ts
  -> module route -> controller -> service -> Prisma/repository
```

`composition.ts` constructs existing adapters and module routers without
starting the process or containing business rules. `app.ts` creates Express,
registers global middleware, directly mounts the explicit public-route map,
and adds the 404 and error handlers last. `routes/index.ts` is that route-group
map. Pure listener and shutdown mechanics live in `server-lifecycle.ts`.

## Module rule

A business module owns its HTTP handlers, rules, and persistence access. Prefer
four to seven meaningful files. Colocate single-use types. Repositories are
optional for simple CRUD and need no one-implementation interface.

Modules may call one named service from another module when a synchronous
result is required. They must not import another module's repositories.
`shared` stays business-neutral. Circular imports, route auto-discovery,
decorators, DI containers, and placeholder modules are prohibited.

External adapters have timeouts and explicit errors. Optional providers do not
crash startup; required database or invalid environment failures do.
PostgreSQL is authoritative for critical state.

## Later capabilities

- Socket.IO attaches to the `httpServer` in `server.ts`. Redis is not required
  now; add its Socket.IO adapter only when multiple instances require it.
- Notifications become their own module when scheduled. Optional delivery can
  follow committed events and must not block unrelated operations.
- Paymob becomes a dedicated payments module. Webhooks require HMAC
  verification, idempotency, duplicate handling, explicit states, and database
  transactions.
- Background jobs get a process composition entry only when a real durable job
  exists. Do not reintroduce queue placeholders.

No microservices, Redis, queues, notifications, payments, or sockets are
implemented by the structure-simplification phase.
