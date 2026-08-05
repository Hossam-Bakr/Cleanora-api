# R1-P03 Quickstart (Validation Guide)

**Purpose**: Prove R1-P03 authorization behavior after implementation.  
**Not included here**: Full service bodies, migration SQL dumps, or complete test suites (those belong to tasks/implementation).

## Prerequisites

- PostgreSQL reachable via `DATABASE_URL` / test DB URL per repository conventions
- Dependencies installed (`npm ci` or `npm install`)
- R1-P03 implementation, migration, and definition seed completed (after tasks)
- No expectation of public R1-P03 HTTP endpoints

## 1. Apply migrations chronologically

Expected migration chain includes existing applied migrations plus:

`r1_p03_roles_permissions_privileged_audit`

Validate schema/migration cleanliness with the repository scripts listed in section 5. Apply on an isolated test/development database using the approved migrate workflow. Do not edit applied migrations. Do not run production migrate without human authorization.

## 2. Seed definitions only

**File**: `prisma/seed.ts`  
**Command**:

```bash
npm run seed
npm run seed
```

Run twice to prove idempotency.

Do **not** use `npm run db:seed` (that script does not exist).

**Expect**:
- FR-002 roles/permissions/role_permissions present
- FR-026 privileged reasons present and active with one-to-one operation binding
- **No** `user_roles` rows created for production users
- Second seed run remains idempotent (no duplicate definition errors)

## 3. Unit authorization matrix

```bash
npm run test:unit
```

**Expect coverage of**:
- Multi-role effective permissions from ENABLED grants only
- Exact transition matrix (assign/enable/disable/revoke allow/reject/no-op)
- Disabled/revoked grants denied for authorization
- Immediate revocation freshness (no cache)
- Self-escalation denial
- Staff sample operations:
  `identity.staff.sample.admin|operations|support|finance`
- Ownership allow/deny
- Cross-provider denial
- Synthetic provider/worker scope allow/deny in tests
- Production-style deny when real scope records are absent
- Reason missing/unknown/inactive/unauthorized/mismatched
- No-op paths append no audit

## 4. Integration: atomic audit rollback + auth regression

```bash
npm run test:integration
```

**Expect**:
- Role assign/revoke/enable/disable via internal contract
- Audit appended only on real mutations
- Forced audit failure rolls back grant mutation
- Existing authentication journeys still pass
- Auth endpoints succeed without `customer` or `resource.self.*` grants
- OpenAPI still validates unchanged public contracts

## 5. Repository quality gates

```bash
git diff --check
npm run prisma:generate
npm run prisma:validate
npm run db:validate-clean-migration
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
npm run openapi:validate
npm run docs:check
npm run build
```

Do not add CI/CD, E2E, Docker, or Testcontainers for R1-P03.

## 6. Manual smoke (optional, local)

- Start the API with existing composition
- Confirm no new public role-management routes are mounted
- Exercise `/auth/login` or `/auth/me` without any user-role grants
- Confirm responses match frozen auth contracts

## References

- Spec: [spec.md](./spec.md)
- Plan: [plan.md](./plan.md)
- Data model: [data-model.md](./data-model.md)
- Contracts: [contracts/README.md](./contracts/README.md)
