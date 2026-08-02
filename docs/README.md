# Cleanora Documentation

The approved repository-local product pack is available under `docs/product`.
Implementation still follows the active phase pointer and may not skip phase
gates merely because future roadmap sections are visible.

## Canonical product documents

```text
docs/product/README.md
docs/product/vision.md
docs/product/decision-log.md
docs/product/open-questions.md
docs/product/roadmap.md
docs/product/current.md
docs/product/standalone-project-boundary.md
```

Precedence:

1. Locked behavior in `docs/product/vision.md`
2. Approved timing and terminology in `docs/product/decision-log.md`
3. Blocks in `docs/product/open-questions.md`
4. Delivery order in `docs/product/roadmap.md`
5. Live phase pointer in `docs/product/current.md`

## Delivery and AI collaboration

- Routing: `docs/ai/context-router.md`
- Tool ownership: `docs/ai/tool-roles.md`
- Development loop: `docs/ai/development-cycle.md`
- Spec Kit integration: `docs/ai/spec-kit-integration.md`
- Repeatable workflows: `docs/ai/workflows/`
- Phase navigation: `docs/phases/`
- Review/readiness reports: `docs/ai/reviews/`

## Engineering contracts

- Backend architecture: `docs/architecture/`
- API documentation: `docs/apis/`
- Interactive Swagger documentation: `docs/swagger/`
- API response, comments, logging, and testing standards: `docs/standards/`
- Importable API requests: `postman/`
- Safe local maintenance commands: `scripts/`

Canonical phase specifications remain under `specs/<phase>/` only when the live
pointer activates that phase.

## Current backend navigation

For implementation work, start in this order:

1. `src/routes/index.ts` — complete mounted API map
2. `src/modules/<capability>/<capability>.routes.ts`
3. the module controller
4. the module service
5. Prisma directly for simple owning-module persistence, or the module
   repository for reusable, complex, or transactional queries

`src/app.ts` configures Express without listening. `src/server.ts` is the
composition root and owns environment validation, Prisma lifecycle,
`createServer(app)`, listening, and graceful shutdown. One-line module barrels,
dynamic route registrars, and empty future modules are not part of the current
architecture.
