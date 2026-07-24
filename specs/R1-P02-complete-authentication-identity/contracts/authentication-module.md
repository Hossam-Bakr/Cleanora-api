# Authentication Module Public Contract

## Public entry point

Other modules may import only `#modules/authentication`. The root entry point exports safe authentication behavior and types; it never exports Prisma, repositories, controllers, provider payloads, token services, credentials, or raw session records.

```ts
export type AccountCategory =
  | INDIVIDUAL
  | COMPANY
  | ENGINEER
  | PROVIDER_OWNER
  | WORKER;

export type UserStatus = ACTIVE | SUSPENDED | BANNED;

export interface AuthenticationPrincipal {
  readonly userId: string;
  readonly sessionId: string;
  readonly accountCategories: readonly AccountCategory[];
  readonly verifiedCategories: readonly AccountCategory[];
  readonly pendingCategories: readonly AccountCategory[];
  readonly status: UserStatus;
  readonly verificationOnly: boolean;
}

export interface AuthenticationModule {
  readonly moduleRegistrar: ModuleRegistrar;
  readonly authenticateAccess: RequestHandler;
}

export function createAuthenticationModule(
  dependencies: AuthenticationModuleDependencies
): AuthenticationModule;
```

`AuthenticationModuleDependencies` is composition-only and may reference business-neutral ports and module-owned provider ports. It is not a cross-module service locator.

## Middleware behavior

`authenticateAccess` validates the pinned JWT contract, loads the stable session family and current user, rejects expired/revoked/mismatched/restricted state, derives category state from the database, and attaches only `AuthenticationPrincipal` to the Express request.

Verification-only principals may call only auth verification, safe current-user, recovery, and logout routes. Later modules receive no permission or role claim from R1-P02.

## Consumed public contracts

- configuration: `#modules/configuration` for typed non-secret policies;
- audit: `#modules/admin` for selected high-impact mutation-attempt evidence;
- logging and rate limiting: business-neutral `Logger` and `RateLimiterPort`;
- database: controlled process-wide accessor inside auth repositories only;
- email: existing `EmailPort`, wrapped by auth-owned delivery behavior.

Authentication application services own every R1-P02 transaction. A module-private transaction context is passed to auth repositories. No Prisma client or transaction handle crosses `index.ts`.

