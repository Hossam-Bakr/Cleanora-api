# Authentication Module Public Contract

R1-P02 is Complete. R1-P02A simplified the source layout without changing the
authentication behavior described by this contract.

## Composition entry point

The composition root imports the explicit named contract:

```ts
import {
  createAuthenticationModule,
  createAuthenticationPolicy,
} from "#modules/authentication/auth.module";
```

The module returns only its router and access-authentication middleware:

```ts
export interface AuthenticationModule {
  readonly router: Router;
  readonly authenticateAccess: RequestHandler;
}

export function createAuthenticationModule(
  dependencies: AuthenticationModuleDependencies,
): AuthenticationModule;
```

`src/routes/index.ts` mounts `router` at `/api/v1/auth`. There is no
`ModuleRegistrar`, dynamic discovery, or public `index.ts` barrel.

## Cross-module boundary

Other modules may use an explicitly approved named authentication service or
composition contract. They must never import authentication repositories,
controllers, HTTP schemas, provider payloads, credentials, token services, raw
Prisma records, or session rows.

`AuthenticationModuleDependencies` is composition-only. It is not a service
locator and does not make provider adapters public business contracts.

## Middleware behavior

`authenticateAccess` validates the JWT contract, loads the stable session
family and current user, rejects expired/revoked/mismatched/restricted state,
derives category state from the database, and attaches only the safe
`AuthenticationPrincipal` to the Express request.

## Persistence and transactions

Authentication owns its tables and transactions. Simple owning-module
persistence may use the shared Prisma client directly; reusable, complex, and
transactional operations remain in authentication repositories. No Prisma
client or transaction handle crosses the module boundary.
