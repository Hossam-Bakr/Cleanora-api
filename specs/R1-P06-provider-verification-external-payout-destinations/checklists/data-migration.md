# Data and Migration Requirements Quality Checklist: R1-P06

**Purpose**: Reviewer gate for persistence ownership, invariants, migration safety, configuration data, and recovery requirement quality.
**Created**: 2026-08-13
**Feature**: [spec.md](../spec.md)
**Depth**: High-risk schema planning gate.

## Model Completeness

- [x] CHK001 Are stable document types, immutable effective-dated policies/items, document chains/versions/evidence/reviews/history, and derived truth all represented? [Completeness, Spec §Key Entities; Data Model]
- [x] CHK002 Are payout types/country policy/operators/banks, chains/versions, identity claims/fingerprints, decisions, primary, conflicts, history, reveal evidence, and rotation progress represented? [Completeness, Spec §Key Entities; Data Model]
- [x] CHK003 Are Media-owned validation receipts and Provider-owned evidence associations distinguished without storage-key leakage? [Ownership, Spec §FR-021–024, §FR-166; Data Model]
- [x] CHK004 Are existing Provider/outbox/Media relations extended additively without changing R1-P05 meaning? [Compatibility, Migration Plan]

## Invariant Clarity

- [x] CHK005 Are one Provider/type document chain, one effective version, linear successors, immutable submission, and no-hard-delete rules explicit? [Clarity, Spec §FR-025–029]
- [x] CHK006 Are five active payout slots, terminal-history exclusion, one open successor, one primary, and same-Provider primary ownership enforceable from the documented model? [Clarity, Spec §FR-118–135; Data Model]
- [x] CHK007 Is active duplicate uniqueness enforced across Providers under every enabled lookup key while permitting same-chain successor reuse? [Clarity, Spec §FR-099, §FR-115, §FR-161; Data Model]
- [x] CHK008 Are type-specific payout column shapes explicit enough to prohibit wallet/bank field mixing and redundant bank inputs? [Consistency, Spec §FR-089–117; Data Model]
- [x] CHK009 Are encryption envelope length/key-ID/no-plaintext constraints stated at database and application boundaries? [Completeness, Spec §FR-140–144; Data Model]

## Migration and Seed Quality

- [x] CHK010 Is the phase migration name/order, additive scope, enum caveat, and applied-migration immutability documented? [Completeness, Spec §FR-088; Migration Plan]
- [x] CHK011 Are clean-install and populated R1-P05 upgrade validation requirements both defined? [Recovery Coverage, Migration Plan]
- [x] CHK012 Are the current clean-migration validator inventories/assertions identified as required implementation updates? [Dependency, Migration Plan]
- [x] CHK013 Are allowed seed definitions separated from Staff-attributed policy publication, unknown operator/bank manifests, and prohibited key/production data? [Clarity, Migration Plan]
- [x] CHK014 Is the lack of an approved launch operator/bank manifest identified as a controlled operational prerequisite rather than filled with guessed data? [Assumption, Migration Plan]

## Concurrency and Recovery Coverage

- [x] CHK015 Are stable lock order, database constraints, exact versions, and operation-key uniqueness sufficient in the written design for competing decisions/successors/claims/primary commands? [Coverage, Transaction Boundaries]
- [x] CHK016 Are partial failure rules explicit that state, history, audit, primary, readiness, conflict, and outbox effects remain atomic? [Recovery, Spec §FR-079–081; Transaction Boundaries]
- [x] CHK017 Are policy activation, expiry processing, and key rotation bounded/resumable rather than unbounded transaction scans? [Performance/Recovery, Plan]
- [x] CHK018 Is rollback defined as application rollback/forward fix with retained evidence rather than destructive down migration or reset? [Recovery, Migration Plan]

## Traceability and Measurability

- [x] CHK019 Can each persisted entity/invariant be traced to a functional requirement or accepted key entity rather than UI mockups? [Traceability, Spec §Key Entities; Data Model]
- [x] CHK020 Are constraint, migration, seed, rotation, and plaintext-absence outcomes objectively auditable? [Measurability, Spec §SC-011, §SC-035–042; Test Strategy]

## Notes

- This checklist does not authorize a schema edit or database operation.
- Validation 2026-08-13: PASS, 20/20. The additive phase boundary, entity ownership, active-slot/claim/primary constraints, same-Provider chain reuse, conflict-case behavior, safe seed limits, validator changes, clean/upgrade evidence, and forward-fix recovery are documented without changing Prisma or a database.
