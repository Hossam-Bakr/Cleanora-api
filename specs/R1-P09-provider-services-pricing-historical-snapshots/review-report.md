# Review Report — R1-P09

## Scope and evidence

- Reviewer: Codex, under the owner's review-and-fix instruction.
- Scope: the complete Phase 9 implementation, approved specification/plan/tasks,
  additive migration, touched public contracts, protected HTTP/API artifacts,
  and earlier-phase regression gates. Base: `e3383fb` on `main`.
- Existing unrelated and temporary untracked artifacts remain local.
- This report does not represent a separate Claude review or human approval.

## Findings

### [MAJOR] Empty integration bodies counted as passing behavioral evidence

- Evidence: the original `tests/integration/providers/provider-service-create.repository.test.ts:12`
  and the original concurrency, approval, lifecycle, readiness, snapshot, and
  three HTTP integration files contained empty test bodies.
- Criterion: FR-043, SC-004–SC-010, tasks T025–T026/T036–T038/T047–T048/T056/T058.
- Impact: a green total did not establish transaction atomicity, database races,
  immutability, cross-module snapshots, or actual HTTP behavior.
- Remediation: replaced the placeholders with real PostgreSQL-backed tests using
  production repositories, public readers, transactional audit, and HTTP adapters.
  Tests now assert retained state and histories and inject an audit failure.

### [MAJOR] Current policy drift did not invalidate retained prices consistently

- Evidence: `provider-service.service.ts` enablement omitted current pricing
  policy; `provider-service-query.service.ts` and `provider-service-snapshot.service.ts`
  compared currency/scale but omitted the current maximum and identity compatibility.
- Criterion: FR-012, FR-032–FR-039 and the approved current-policy test strategy.
- Impact: an offering above a reduced country maximum could remain usable or
  become enabled, and management usability could disagree with current truth.
- Remediation: one exact-decimal compatibility policy now checks country/currency
  identities, scale, amounts and current maximum for enablement, approval,
  management mapping, readiness and snapshot reads. Added live drift/restoration
  and unchanged-history regression evidence.

### [MAJOR] Provider authority was not rechecked in the committing transaction

- Evidence: `provider-service.service.ts` resolved authority from `outerIdentity`;
  management queries likewise used identity read before their transaction.
- Criterion: FR-007–FR-009, FR-043 and plan transaction authorization recheck.
- Impact: role/account changes between preflight and transaction start could
  leave stale authorization facts controlling a command or private read.
- Remediation: an Authentication-owned public transaction-bound identity reader
  is attached to the Providers UoW; Provider commands and management reads
  recheck active identity and global capability alongside exact membership.

### [MINOR] Live-test target detection accepted a Phase 9 substring anywhere in a URL

- Evidence: `tests/helpers/r1-p09-provider-services-fixtures.ts` used `includes`
  instead of the migration proof target-name validator.
- Criterion: explicit phase-named disposable test target contract.
- Remediation: the helper now uses `requireR1P09ProofDatabaseUrl` and fails closed.

### [MAJOR] Provider persistence directly joined Configuration-owned countries

- Evidence: the original `PrismaProviderServiceRepository.lockProviderScope`
  joined `countries` to resolve the profile's country code.
- Criterion: FR-005–FR-006 and the mandatory persistence ownership boundary.
- Remediation: Configuration now supplies a narrow transaction-bound country
  identity reader through its public contract. Providers only reads its own
  Provider/profile rows. Identity remains resolvable for inactive-country
  remediation; pricing validity remains a separate policy check.
- Regression: the module-boundary test rejects Configuration-owned SQL joins,
  and real Provider command/HTTP tests exercise the public reader.

### [MINOR] Canonical and Companion state remained at preparation

- Evidence: the original current pointer said implementation was not started;
  Companion remained at `tasks/ready-to-implement` despite checked task markers.
- Criterion: truthful phase/evidence handoff.
- Remediation: current pointer reflects review work; final evidence and Companion
  synchronization follow the final gate results, without marking the phase Complete.

### [MAJOR] Migration validators claimed Phase 9 constraint proof without probing it

- Evidence: `assertPostDeployState` invoked live probes only through Phase 8;
  the four Phase 9 tables were checked only for seed emptiness. The clean and
  populated-upgrade success messages nevertheless claimed Phase 9 constraints.
- Criterion: T072/T073/T079 and SC-011/SC-012 database integrity evidence.
- Remediation: both validators now invoke `probe-r1-p09-constraints.ts` with
  real writes, 28 expected SQLSTATE rejections, legal price transitions and
  exact 65-digit money verification. Every fixture is rolled back, and the clean
  integration gate asserts that the probe actually ran.

### [MINOR] Transaction conflicts could expose an internal snapshot error over HTTP

- Evidence: Prisma serialization failures map to the internal
  `PROVIDER_SERVICE_SNAPSHOT_CONFLICT`; the HTTP contract defines version conflict.
- Criterion: FR-042 and the protected HTTP error contract.
- Remediation: the HTTP mapper returns the safe 409
  `PROVIDER_SERVICE_VERSION_CONFLICT`; internal snapshot consumers retain their
  stable internal conflict. A mapper regression checks both code and status.

## Questions

No new product decision is introduced. Human phase completion and the exact Git
instruction remain separate from technical readiness.

## Tests and checks

All required gates passed. Phase 9: 168 passed; full regression: 1894 passed;
five guarded Phase 7 tests passed separately. Phase and repository coverage meet
all thresholds. Clean and populated-upgrade proofs both exercise all 28 Phase 9
constraint rejections and exact money. Build, lint, typecheck, schema, API,
Postman generation/parity and documentation checks passed. See
`implementation-evidence.md` for commands, scope and exact results.

No separate Claude review or production migration was run.

## Verdict

`PASS` — all accepted findings resolved and required technical gates passed.
Ready for the separately triggered Git workflow. Human phase completion remains
pending; Phase 9 is still active.
