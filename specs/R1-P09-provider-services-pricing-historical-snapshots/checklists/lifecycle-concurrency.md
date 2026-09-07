# Lifecycle and Concurrency Requirements Checklist: R1-P09

**Purpose**: Validate that offering, price, approval, history, retry, and race semantics are deterministic and mutually consistent.
**Created**: 2026-09-05
**Feature**: [spec.md](../spec.md)

**Note**: This checklist tests the written requirements, not an implementation. Checked items were evaluated during the planning analysis.

## Lifecycle Clarity

- [x] CHK001 Is the creation transition defined as expected version 0 to a disabled aggregate at version 1, with enablement as a separate command? [Clarity, Spec §US1 and FR-018, Data Model §State Transitions]
- [x] CHK002 Are the allowed PENDING, EFFECTIVE, REJECTED, and SUPERSEDED price transitions complete for both approval modes? [Completeness, Spec §FR-023, FR-026, FR-030, Data Model §Price]
- [x] CHK003 Is the behavior of an existing effective price while a replacement is pending, rejected, or approved unambiguous? [Consistency, Spec §FR-030]
- [x] CHK004 Are approval-policy changes specified without automatic price transitions, hidden Staff work, or unaudited activation? [Edge Case, Spec §FR-029–FR-030, Research §Decision 8]
- [x] CHK005 Are enable preconditions and immediate Provider disablement consistent with current Catalog/configuration truth and approval rules? [Consistency, Spec §FR-019–FR-020, FR-032]
- [x] CHK006 Are Provider-controlled status and dynamic Catalog/configuration usability separated so dependency drift cannot fabricate status history? [Clarity, Spec §FR-020, FR-033–FR-035]

## Concurrency, Replay, and History

- [x] CHK007 Does one aggregate version cover every creation, configuration, price, lifecycle, and Staff-decision mutation with exactly one increment per accepted command? [Completeness, Spec §FR-024]
- [x] CHK008 Are identical late replay, conflicting key reuse, stale writers, and concurrent duplicate races assigned deterministic no-partial-change outcomes? [Exception Coverage, Spec §FR-024–FR-026, Data Model §Idempotency Receipt Rules]
- [x] CHK009 Is receipt lookup ordered after current authority but before fresh Catalog/configuration/version validation? [Consistency, Plan §Command model and transaction order]
- [x] CHK010 Are primary versus derived history events, operation identities, reasons, and single-receipt ownership defined for multi-row transitions? [Clarity, Plan §Current state, retained prices, and append-only evidence]
- [x] CHK011 Are internal creation/configuration receipt rows distinguished from externally visible enable/disable status transitions? [Consistency, Spec §FR-021, Data Model §ProviderServiceStatusHistoryEvent]
- [x] CHK012 Are append-only retention, legal price lifecycle updates, prohibited commercial rewrites, and no-hard-delete rules mutually consistent? [Consistency, Spec §FR-027, Data Model §Delete and Retention Policy]

## Notes

- All lifecycle/concurrency requirement-quality checks are resolved; implementation race evidence is intentionally deferred.
