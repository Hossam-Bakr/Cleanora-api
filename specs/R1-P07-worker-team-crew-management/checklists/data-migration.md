# Data & Migration Requirements Checklist: Worker, Team & Crew Management

**Purpose**: Validate data ownership, constraints, migration compatibility, and proof requirements
**Created**: 2026-08-22
**Feature**: [migration-plan.md](../migration-plan.md)
**Audience/Timing**: Architecture and migration reviewer before task generation

## Data Ownership and Shape

- [x] CHK001 Are all Providers-owned R1-P07 models and existing-module opposite relations enumerated? [Completeness, Data Model §Planned models]
- [x] CHK002 Are Authentication-owned identity/role/preference facts and Media-owned avatar facts kept outside Providers persistence ownership? [Consistency, Plan §Architecture and Ownership]
- [x] CHK003 Is Worker engagement distinct from profile, login-access projection, and invitation versions? [Clarity, Data Model]
- [x] CHK004 Are Team membership history and membership-level `cleans` distinct from permanent Worker attributes? [Clarity, Data Model §ProviderTeamMembership]
- [x] CHK005 Is `workersReady` explicitly derived rather than a writable persisted flag? [Boundary, Research Decision 10]

## Constraint Completeness

- [x] CHK006 Are partial unique requirements defined for current identity engagement, current Team membership, non-archived normalized Team name, and pending invitation? [Completeness, Migration Plan §SQL requiring explicit review]
- [x] CHK007 Are normalized per-Worker skill uniqueness and reuse of archived Team names specified? [Completeness, Spec §FR-057, FR-061]
- [x] CHK008 Are same-Provider membership, Escort, primary-Supervisor, active-Team-cleaner, and predecessor invariants identified as cross-row constraints? [Completeness, Data Model §Cross-row invariants]
- [x] CHK009 Are positive versions, E.164, bounded values, recipient routes, and terminal timestamps covered by check requirements? [Completeness, Migration Plan §SQL requiring explicit review]
- [x] CHK010 Are stable constraint names and safe HTTP/domain mapping required? [Clarity, Migration Plan §SQL requiring explicit review]

## Migration and Compatibility

- [x] CHK011 Is the exact future migration name specified and every existing applied migration declared immutable? [Traceability, Migration Plan]
- [x] CHK012 Is the `ProviderMember.version` default/backfill strategy explicit and semantically non-changing? [Clarity, Migration Plan §Backfill/default strategy]
- [x] CHK013 Is the decision not to infer/backfill Worker engagements from current data explicit? [Boundary, Migration Plan §Backfill/default strategy]
- [x] CHK014 Are enum, FK, table-lock, index, trigger, and PII risks documented with mitigations? [Risk Coverage, Migration Plan §Lock and compatibility risk review]
- [x] CHK015 Is forward-fix behavior defined without rollback by editing an applied migration? [Recovery, Migration Plan §Rollback and forward-fix]

## Proof Quality and Safety

- [x] CHK016 Are chronological clean-install and populated R1-P06 upgrade proofs separately defined? [Completeness, Migration Plan §Clean-install proof/Populated upgrade proof]
- [x] CHK017 Is representative R1-P06 data preservation defined for Provider, membership, User preference, Media, outbox, verification, and payout facts? [Coverage, Migration Plan §Populated R1-P06 upgrade proof]
- [x] CHK018 Are database proof targets constrained to explicit disposable isolated schemas with secrets omitted? [Security, Migration Plan §Migration construction workflow]
- [x] CHK019 Are seed expectations and the no-seed-change case documented? [Clarity, Migration Plan §Backfill/default strategy]
- [x] CHK020 Are clean/upgrade/constraint/concurrency evidence requirements measurable before phase completion? [Measurability, Test Strategy §Migration evidence]

## Notes

- Result: 20/20 requirements-quality checks satisfied.
- No migration or database command is executed by this checklist.
