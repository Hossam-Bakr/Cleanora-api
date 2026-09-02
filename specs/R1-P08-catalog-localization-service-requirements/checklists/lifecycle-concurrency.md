# Lifecycle, Ordering, Idempotency, and Concurrency Requirements Quality Checklist

**Purpose:** Validate state, ordering, transaction, retry, and race requirements
before implementation.
**Created:** 2026-08-30
**Audience/Timing:** Codex/Cursor preimplementation reviewer gate.

## Lifecycle definition

- [x] CHK001 Is inactive explicitly the only draft form, with no separate `DRAFT` state or hidden transition? [Clarity, DEC-041, Plan §Lifecycle and Validation]
- [x] CHK002 Are category activation prerequisites complete and objectively testable? [Measurability, Data Model §Category activation]
- [x] CHK003 Are service activation prerequisites complete for parent, exact locales, units, fields/options, and ordering? [Completeness, Data Model §Service activation]
- [x] CHK004 Is country availability clearly a selectability condition rather than a third service lifecycle state? [Consistency, Data Model §Service activation, §Selectability]
- [x] CHK005 Are child active/inactive completeness rules and always-invalid constraint rules distinguished? [Clarity, Data Model §ServiceField]
- [x] CHK006 Is category deactivation specified to suppress child selection without rewriting child service lifecycle? [Consistency, Transaction Contract §Category command propagation]
- [x] CHK007 Are stable category/service identities protected from hard deletion while management can deactivate them? [Boundary, Spec §FR-029, Data Model §Deletion and history]

## Ordering and replacement

- [x] CHK008 Are category, service, price-unit, field, option, and media ordering scopes explicitly defined? [Completeness, Data Model §Entities]
- [x] CHK009 Is full-order replacement defined to require an exact ID/version set and produce contiguous deterministic positions? [Clarity, Plan §Lifecycle and Validation]
- [x] CHK010 Is the atomic full-replacement boundary for service configuration explicit, including which child collections are replaced together? [Consistency, Research §full-replacement service configuration]
- [x] CHK011 Are duplicate, omitted, conflicting, or incompatible ordered entries addressed as whole-command failures? [Edge Case, Spec §US2 acceptance, Transaction Contract §Failure semantics]

## Versions and races

- [x] CHK012 Is every mutable aggregate's integer version and increment rule specified? [Completeness, Spec §FR-034, Data Model §Version propagation]
- [x] CHK013 Are category-to-child service version propagation rules explicit for content/lifecycle/order changes? [Clarity, Transaction Contract §Category command propagation]
- [x] CHK014 Is the fixed lock order documented for categories, services, children, Media checks, audit, and receipts? [Concurrency, Plan §Transaction, Idempotency, and Lock Strategy]
- [x] CHK015 Is the same-old-version race outcome measurable as one winner, safe loser, and zero partial state? [Acceptance Criteria, Spec §SC-006]
- [x] CHK016 Is a snapshot-ready read required to observe one internally consistent aggregate version during concurrent mutation? [Consistency, Spec §SC-009, Public Contract §Reader interface]

## Retry and external-I/O recovery

- [x] CHK017 Are same-key/same-hash replay and same-key/different-hash conflict semantics specified? [Clarity, Data Model §CatalogCommandRequest]
- [x] CHK018 Are ordinary command receipts committed atomically with business truth and privileged audit? [Consistency, Transaction Contract §Ordinary mutation transaction]
- [x] CHK019 Is Media upload reservation/ingest/finalize/compensate sequencing fully specified without holding a transaction over external I/O? [Recovery, Transaction Contract §Service image upload orchestration]
- [x] CHK020 Is crash/retry behavior for a pending Media reservation specified to resume one stable Media ID? [Recovery, Research §persistent command receipts]
- [x] CHK021 Are audit failure, Media failure, authorization revocation, validation failure, and CAS conflict rollback effects explicit? [Exception Coverage, Transaction Contract §Failure semantics]
- [x] CHK022 Is deletion/cleanup clearly separate from removing a Catalog association? [Consistency, Spec §FR-038–FR-041]
