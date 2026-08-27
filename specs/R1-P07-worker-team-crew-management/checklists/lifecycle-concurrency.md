# Lifecycle & Concurrency Requirements Checklist: Worker, Team & Crew Management

**Purpose**: Validate lifecycle, exact-version, idempotency, atomicity, and race requirements
**Created**: 2026-08-22
**Feature**: [spec.md](../spec.md)
**Audience/Timing**: Author and reviewer before task generation

## Lifecycle Completeness

- [x] CHK001 Are all allowed and forbidden Worker lifecycle transitions, actors, controls, and terminal behavior specified? [Completeness, Spec §Worker operational lifecycle]
- [x] CHK002 Are invitation/access transitions separated from Worker operational status and terminal invitation-version outcomes preserved? [Completeness, Spec §Login-access lifecycle, FR-013–FR-020]
- [x] CHK003 Are all Team transitions, activation invariants, archive effects, and terminal behavior specified? [Completeness, Spec §Team lifecycle, FR-060–FR-068]
- [x] CHK004 Are removal, self-leave, and linked rehire differentiated with retained history and shared-identity behavior? [Completeness, Spec §FR-007–FR-009, FR-047–FR-049]
- [x] CHK005 Are primary-Supervisor invalidation causes and Team-validity consequences exhaustive? [Completeness, Spec §FR-064–FR-066]

## Atomicity and Failure Coverage

- [x] CHK006 Is the primary-Supervisor final-cleaner attempt explicitly rejected before any state or side effect? [Clarity, Spec §FR-051, DEC-039]
- [x] CHK007 Is the confirmed Owner/Admin final-cleaner atomic set defined for membership/Worker, Team, separate history, audit, readiness, command result, and notification effects? [Completeness, Transaction Boundaries §Command-specific atomic sets]
- [x] CHK008 Are cancellation, invalid input, stale version, competing command, transaction failure, and external-delivery failure outcomes distinguished? [Coverage, Spec §FR-051, FR-078, FR-086]
- [x] CHK009 Are Worker deactivation/removal/departure impacts on Team, membership, Supervisor, access, and readiness defined? [Coverage, Spec §FR-047–FR-051, FR-074–FR-075]
- [x] CHK010 Is Team archive behavior explicit that memberships end while Worker lifecycle stays unchanged? [Clarity, Spec §FR-067–FR-068]

## Concurrency and Idempotency Clarity

- [x] CHK011 Is `expectedVersion` ownership defined for every aggregate a command can mutate? [Clarity, Transaction Boundaries §Version ownership]
- [x] CHK012 Is matching-key/same-fingerprint replay distinguished from same-key/different-fingerprint conflict? [Clarity, Data Model §ProviderWorkforceCommand]
- [x] CHK013 Is the fixed cross-aggregate lock order documented and consistent with transaction ownership? [Consistency, Plan §Transaction and Lock Strategy]
- [x] CHK014 Are invitation accept/resend/revoke/expiry race winners and zero-partial-state outcomes specified? [Coverage, Spec §Edge Cases, FR-020]
- [x] CHK015 Are cross-Provider current-engagement and one-current-Team-membership races backed by application and database requirements? [Coverage, Data Model §Cross-row invariants]

## Domain Invariants and Measurability

- [x] CHK016 Is Escort `cleans=false`, invalid `cleans=true`, and type-change ordering unambiguous? [Clarity, Spec §FR-056, DEC-039]
- [x] CHK017 Is `workersReady` derived eligibility complete and independent of Team membership? [Completeness, Spec §FR-070–FR-075]
- [x] CHK018 Can valid/invalid lifecycle compliance be measured across 100% of tested transitions? [Measurability, Spec §SC-004]
- [x] CHK019 Can atomic last-cleaner and stale/competing outcomes be measured without accepting partial side effects? [Measurability, Spec §SC-008, SC-011]
- [x] CHK020 Can idempotent replay be measured across state, history, audit, readiness, and notification effects? [Measurability, Spec §SC-010]

## Notes

- Result: 20/20 requirements-quality checks satisfied.
- The lock order and version ownership remove implementation-order ambiguity.
