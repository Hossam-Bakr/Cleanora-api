# Bug Report — Railway Prisma module-format mismatch

## Observed behavior

Railway built the application successfully, then `npm run start` crashed while
loading `dist/generated/prisma/client.js`:

```text
SyntaxError: Cannot use 'import.meta' outside a module
```

## Expected behavior

The generated Prisma Client must use the same module system as Cleanora's
compiled Node.js application.

## Reproduction

1. Generate Prisma Client without an explicit module format.
2. Compile the project with the CommonJS package and TypeScript configuration.
3. Run `node dist/server.js` or require the compiled generated client.

## Environment

- Node.js 24
- Prisma 7.9
- `package.json` module type: `commonjs`
- Railway Linux runtime

## Evidence and root cause

The `prisma-client` generator inferred ESM and generated
`fileURLToPath(import.meta.url)`. TypeScript compiled the surrounding
application as CommonJS, so Node loaded the generated client with `require()`.
`import.meta` is invalid in that context.

## Fix

Set the Prisma generator to the explicit application module format:

```prisma
moduleFormat = "cjs"
```

The existing npm `prebuild` lifecycle continues to regenerate the client on
every clean Railway build.

## Regression test

`tests/unit/tooling/ci-database-gate.test.ts` verifies that the package is
CommonJS and the Prisma generator is explicitly configured as CommonJS.

## Validation

- Prisma generation — PASS
- Production build — PASS
- Direct `require("./dist/generated/prisma/client.js")` — PASS
- Unit suite — 52 files and 206 tests PASS
- Typecheck — PASS
- Changed-file ESLint — PASS
- `git diff --check` — PASS, with existing line-ending warnings only

## Remaining risk

Railway must rebuild from a commit containing this schema-generator setting.
The next startup can still fail independently if Railway variables, database
connectivity, or migrations are incomplete.
