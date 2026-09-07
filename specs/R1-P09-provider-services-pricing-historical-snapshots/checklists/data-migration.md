# Data and Migration Requirements Checklist: R1-P09

**Purpose**: Validate persistence ownership, relational integrity, decimal safety, retention, migration, and upgrade requirements before schema work.
**Created**: 2026-09-05
**Feature**: [data-model.md](../data-model.md)

**Note**: This checklist tests the written requirements, not a schema or database. Checked items were evaluated during the planning analysis.

## Data Model Completeness

- [x] CHK001 Are exactly the four roadmap entities/tables named and owned by Providers, with future-phase tables explicitly excluded? [Completeness, Spec §FR-044–FR-045, Migration Plan §Planned Schema Delta]
- [x] CHK002 Are Provider, offering, Catalog service/unit, country, currency, proposer, actor, and history identities protected by explicit foreign-key and scope requirements? [Integrity, Data Model §Planned Models]
- [x] CHK003 Are one-offering-per-Provider/service and at-most-one-pending/effective-price invariants specified for concurrent writers? [Clarity, Spec §FR-002, FR-026, Data Model §Provider Service Price constraints]
- [x] CHK004 Are duration, localized-note pairing, aggregate-version, status/timestamp, receipt, and operation-identity constraints complete? [Completeness, Data Model §Provider Service constraints and §History integrity]
- [x] CHK005 Are monetary boundary strings, authoritative currency scale, exact whole minor units, positivity, minimum, maximum, and size limits mutually consistent? [Consistency, Spec §FR-012–FR-013, Data Model §Provider Service Price constraints]
- [x] CHK006 Is mutable price lifecycle state separated from immutable commercial/proposal context and fully immutable history? [Clarity, Data Model §ProviderServicePrice and §Delete and Retention Policy]

## Migration and Upgrade Coverage

- [x] CHK007 Is one clearly named additive forward migration specified without edits, resets, squashing, or reordering of applied migrations? [Governance, Migration Plan §Migration Identity]
- [x] CHK008 Are the supporting Catalog index and all reverse relations documented without transferring Catalog or Configuration ownership? [Boundary Consistency, Migration Plan §Planned Creation Order]
- [x] CHK009 Are clean-install, populated R1-P08 upgrade, data-digest preservation, live constraints, trigger behavior, and idempotent redeploy evidence all required? [Scenario Coverage, Migration Plan §Validation Plan]
- [x] CHK010 Are seed changes limited to non-secret Configuration key metadata with no Provider offering or price values invented? [Scope, Spec §FR-046, Migration Plan §Data and Backfill Policy]
- [x] CHK011 Is database execution limited to an explicitly approved disposable target, with production and historical-database access excluded? [Safety, Test Strategy §Principles, Quickstart §Re-establish the guardrails]
- [x] CHK012 Are Booking snapshots, answers, totals, schedules, availability, workflows, wallets, and destructive cleanup outside the schema delta? [Boundary Coverage, Spec §FR-040, FR-044–FR-045]

## Notes

- All data/migration requirement-quality checks are resolved; no schema, SQL, or database command was executed.
