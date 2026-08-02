# R1-P02A — Technical Plan

## Target structure

```text
src/
├── app.ts
├── server.ts
├── config/
├── database/
├── middlewares/
├── routes/
├── modules/
├── integrations/
├── shared/
└── swagger/
```

## Decisions

- Keep authentication's domain policies and repositories separate where they
  protect real security and transaction responsibilities, but move its normal
  HTTP/application path to the module root.
- Replace `ModuleRegistrar` with explicit router dependencies mounted in
  `routes/index.ts`.
- Move generic HTTP/error/logging concerns out of `core` into `middlewares`
  and `shared`; move Prisma lifecycle/access into `database`.
- Replace Pino/Pino HTTP with Morgan plus a small console application logger
  that keeps recursive secret redaction.
- Delete future-only cache, queue, notification, payment, and background-job
  placeholders. Document their future placement in one architecture section.
- Preserve the existing Prisma schema and all applied migrations byte-for-byte.

## Verification

Run the requested baseline before edits and the complete final gate after
imports and tests are migrated. Do not weaken assertions, coverage settings,
strict TypeScript, or security behavior.

