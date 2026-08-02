# Source Layout

```text
src/
├── app.ts
├── server.ts
├── config/
├── database/
├── middlewares/
├── modules/
├── integrations/
├── routes/
├── shared/
└── swagger/
prisma/
├── schema.prisma
└── migrations/
tests/
├── unit/
├── integration/
└── helpers/
```

`routes/index.ts` is the visible API map. Business routes remain in their
module. Generated Prisma source, `dist`, `coverage`, dependencies, caches, and
runtime data are not source and remain ignored.

Native `package.json#imports` aliases resolve TypeScript under the development
condition and compiled JavaScript by default.
