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
- Owner decision-question contract: `docs/ai/decision-question-format.md`
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

**Live pointer:** `R1-P09 — Provider Services, Pricing & Historical Snapshots`
is the sole active phase. Specification, clarification, planning, and tasks are
complete; implementation of the protected Provider-service surface is in
progress. Protected HTTP/OpenAPI/Postman contracts live under
`docs/api/provider-services.md` and `src/swagger/r1-p09-openapi.paths.ts`.
`docs/product/current.md` is the authority for its live state and approval
boundary. R1-P08 is Complete and merged through PR #8; its Swagger, Postman,
Catalog public contract, and completion artifacts remain historical dependency
evidence. Live migration deploy gates (T079) require an owner-approved
`CLEANORA_R1_P09_DATABASE_URL` disposable target and must not run against
unknown databases.

## Current backend navigation

For implementation work, start in this order:

1. `src/server.ts` — visible process startup and shutdown ownership
2. `src/composition.ts` — construction of existing runtime dependencies
3. `src/app.ts` — Express and global middleware order
4. `src/routes/index.ts` — complete mounted API map
5. `src/modules/<capability>/<capability>.routes.ts`
6. the module controller
7. the module service
8. Prisma directly for simple owning-module persistence, or the module
   repository for reusable, complex, or transactional queries

`src/app.ts` configures Express without listening. `src/server.ts` owns the
visible environment → composition → database → app/routes → listener →
shutdown sequence, while pure listener mechanics live in
`src/server-lifecycle.ts`. One-line module barrels, dynamic route registrars,
and empty future modules are not part of the current architecture.
