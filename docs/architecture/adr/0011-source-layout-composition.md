# ADR-0011 — Root composition and integration layout

- Status: Amended by R1-P02A
- Date: 2026-07-24
- Amended: 2026-07-30

## Decision

- `app.ts` builds Express without listening.
- `server.ts` owns environment, database, `createServer(app)`, listening, and
  graceful shutdown.
- `routes/index.ts` explicitly mounts every active route group.
- `database` owns the single Prisma client and lifecycle.
- `middlewares` and `shared` own small current cross-cutting behavior.
- `integrations` contains only current provider adapters.
- Future jobs and providers are added only when a real phase needs them.

The layout stays readable without global business controllers or dynamic
composition abstractions.
