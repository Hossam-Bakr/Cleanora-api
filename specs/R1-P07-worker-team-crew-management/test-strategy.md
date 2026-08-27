# R1-P07 Test Strategy

## Objectives

Prove the 88 functional requirements, 14 success criteria, lifecycle matrices,
DEC-038/DEC-039 decisions, module boundaries, database compatibility, and safe
HTTP contract. Tests are part of future implementation tasks; none are run or
created as product tests during planning.

## Test layers

### Unit — `tests/unit/providers/`

- Worker and Team transition policies, terminal-state denial, completeness,
  readiness eligibility, normalization, skill deduplication.
- All five closed reason catalogs; cross-catalog rejection; removal and `OTHER`
  note meaning/length.
- Supervisor action allowlist, full-phone projection selection, Escort
  `cleans=false`, cleaner counts, primary-Supervisor eligibility.
- Notification locale resolver: invitation version, valid preference, accepted
  invitation fallback, final `AR`; locale included in idempotency meaning.
- Invitation proof HMAC domain/input canonicalization, expiry, version mismatch,
  constant-time invalid result, and redaction.
- Safe history/audit/outbox fact allowlists and forbidden phone/token/credential
  markers.
- DTO mappers for Owner/Admin/self/Supervisor/public/booking-safe projections.

### Integration — Providers/PostgreSQL

- Create Worker before identity; accept new/existing identity; Customer role
  preserved; cross-Provider current identity race has one winner.
- Resend/expire/revoke/accept races; only latest valid invitation wins; no
  partial User role/access/Worker state.
- Worker lifecycle matrix, rehire predecessor, self-leave, removal, access
  revocation, Admin membership independence.
- Team lifecycle, normalized name reuse rules, single current membership,
  movement history, archive effects.
- Supervisor scope/read/write, assignment invalidation, phone access loss.
- Supervisor final-cleaner command conflicts; Owner/Admin confirmed change
  commits membership+Team+history atomically; cancel/stale/competing changes zero.
- Escort `cleans=true` rejection and type-change ordering.
- `workersReady` truth after every qualifying and disqualifying source change;
  Team membership not required; no auto-promotion.
- Matching idempotent replay and mismatched fingerprint conflict for every
  command family.
- Fixed-lock concurrency waves for lifecycle, invitations, memberships, Teams,
  Supervisor assignment, Admin authority, and readiness.
- Transactional audit/outbox failure rolls back accepted truth; SMTP delivery
  failure after commit does not.

Database-backed suites run in bounded sequential groups against isolated test
schemas; no two proof suites share a mutable database concurrently.

### Integration — Authentication public contract

- Categoryless new Worker onboarding chooses own password and verifies fixed
  invitation email.
- Existing user signs in/accepts without password change.
- Worker and Provider-Supervisor global roles reconcile without affecting
  Customer or unrelated Provider roles.
- Provider Admin role reflects only explicit active memberships.
- Recent-auth proof purpose/actor/session/provider/worker/request/age/one-use
  binding; transaction-bound consumed-proof recheck.
- `UserPreferences.language` read returns only supported locale/null.

### Integration — Media public contract

- JPEG, PNG, WebP accepted at/below 5 MiB; `.jpg` and `.jpeg` map to JPEG.
- Oversized, malformed, mismatched, animated/unsafe where disallowed, and
  metadata/orientation cases.
- Output is WebP, private/authenticated, and longest edge ≤1200px.
- Cloudinary contract fake proves I/O occurs outside Providers transactions.
- READY receipt ownership/CAS, stale association conflict, replacement cleanup,
  signed private delivery, and storage-key omission.

### HTTP — Supertest `tests/integration/http/provider-workforce*.test.ts`

- Every OpenAPI operation, request validation, status, success/failure envelope,
  request ID, pagination, no-store private headers, and stable error codes.
- Actor matrix for Owner/Admin/Supervisor/self/Worker/Customer/cross-Provider.
- All independently detectable Zod field issues returned together.
- Role-specific DTO snapshots prove phone presence/absence and forbidden-field
  absence.
- Invitation proof/password/OTP never appears in body/error/logger capture.
- 409 for stale/competing/uniqueness/final-cleaner/re-auth conflicts.
- Matching idempotency retry returns the original accepted result.

## Migration evidence

- `npm run prisma:validate`, `npm run prisma:generate`.
- Future R1-P07 clean-migration validator against explicitly approved disposable
  isolated target, with chronological 14-migration proof.
- Future populated R1-P06 upgrade validator preserving Provider, membership,
  media, document, payout, history, outbox, and User preference facts.
- Constraint tests for partial unique indexes, check constraints, deferred
  triggers, and restrict-delete semantics.
- Existing migration contents/hashes remain unchanged.

## Contract and documentation evidence

- Parse/validate `contracts/provider-workforce-api.openapi.yaml` as OpenAPI 3.1.
- Add runtime fragments only during implementation, then require design/runtime
  operation parity.
- Add R1-P07 Postman generator and validator; generated collection operation IDs
  match OpenAPI exactly and contains no real credentials/tokens.
- `npm run docs:check`, `git diff --check`, JSON/YAML parsing, FR/SC/task mapping,
  and module-boundary import scan.

## Coverage policy

Add `vitest.r1-p07.config.ts` based on the phase-scoped R1-P06 pattern. It must
include all R1-P07 Providers code plus modified Authentication/Media/Admin public
adapters, use repository threshold policy, and supplement metrics with explicit
invariant tests. Coverage cannot replace lifecycle, authorization, concurrency,
migration, or privacy evidence.

## Requirement-to-evidence classes

| Requirement group | Primary evidence |
|---|---|
| FR-001–FR-020 | Provider/Auth integration + invitation HTTP |
| FR-021–FR-032 | unit DTO/privacy + Media integration + HTTP |
| FR-033–FR-041 | authorization matrix integration + proof tests |
| FR-042–FR-051 | lifecycle/atomic concurrency integration |
| FR-052–FR-069 | policy + Team/membership database integration |
| FR-070–FR-075 | readiness projection integration |
| FR-076–FR-088 | idempotency/concurrency/history/outbox/privacy/HTTP |
| SC-001–SC-002 | deterministic journey timing harness excluding email delivery |
| SC-003–SC-014 | focused negative, concurrency, privacy, audit, and failure tests |

The detailed `tasks.md` must explicitly attach every FR and SC to one or more
test/implementation/evidence tasks.

## Required regression gates

- Full unit and integration suites, typecheck, lint, build.
- Existing R1-P05/R1-P06 focused tests and OpenAPI/Postman validators.
- Existing provider email dispatcher behavior.
- Customers/Authentication profile-image behavior reused by Worker avatar.
- Module-boundary scan: Providers has no private Authentication/Media/Admin
  imports and `shared` contains no workforce business rules.

## Forbidden test behavior

- No production credentials, live SMTP email, live Cloudinary mutation, Docker,
  or Testcontainers.
- No shared historical/production database.
- No assertion that logs/audit/history contain a raw phone, invitation proof,
  password, OTP, cookie, token, or storage key.
- No test-order dependence or concurrent writers against one proof schema.
