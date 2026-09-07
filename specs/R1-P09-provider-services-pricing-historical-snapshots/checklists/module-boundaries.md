# Module-Boundary Requirements Checklist: R1-P09

**Purpose**: Validate ownership, dependency direction, transaction composition, and future-phase boundaries for the modular monolith.
**Created**: 2026-09-05
**Feature**: [plan.md](../plan.md)

**Note**: This checklist tests the written architecture requirements, not source imports. Checked items were evaluated during the planning analysis.

## Ownership and Public Contracts

- [x] CHK001 Is Providers the sole owner of offering, price, history, readiness, use-case, repository, and transaction behavior for all four R1-P09 entities? [Ownership, Spec §FR-006, Plan §Ownership and dependency direction]
- [x] CHK002 Is Catalog still authoritative for service definition, localization, country selectability, price units, fields, options, and media? [Ownership, Spec §FR-003–FR-005]
- [x] CHK003 Is Configuration the sole source of active country/default currency/scale/approval/maximum policy through a narrow resolved public reader? [Ownership, Spec §FR-012, FR-028, Public Contract §Configuration Public Contract Extension]
- [x] CHK004 Are Authentication authority and Admin audit consumed only through their owned public contracts and transaction-bound factories? [Dependency Direction, Public Contract §Authentication and §Admin Audit]
- [x] CHK005 Are direct foreign repositories, services, controllers, generated models, and persistence types prohibited from Providers? [Boundary, Public Contract §Dependency Rules]

## Transaction and Future-Phase Boundaries

- [x] CHK006 Is the Providers-owned UoW responsible for creating transaction-bound public participants while domain/services remain unaware of raw transaction objects? [Clarity, Plan §Command model and transaction order, Public Contract §Dependency Rules]
- [x] CHK007 Are serializable mutation and repeatable-read current-facts/snapshot boundaries distinguished with bounded whole-transaction retry? [Consistency, Plan §Command model and §Snapshot consistency]
- [x] CHK008 Are Pricing, Offerings, ProviderServices, Booking, Browse, and generic Workflow/approval modules explicitly prohibited for this phase? [Scope, Spec §FR-045]
- [x] CHK009 Is the internal snapshot reader exposed by Providers only for a later composition-authorized consumer, while Booking owns any later persistence? [Future Boundary, Spec §FR-036, FR-040]
- [x] CHK010 Are readiness facts connected to the existing Providers public contract without introducing public Browse eligibility or future R1-P10/R1-P11 behavior? [Phase Boundary, Spec §FR-033–FR-035]

## Notes

- All module-boundary requirement-quality checks are resolved; implementation import tests remain later tasks.
