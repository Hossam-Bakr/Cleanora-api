# Data, Migration, and Seed Requirements Quality Checklist

**Purpose:** Validate persistence ownership, constraints, compatibility, and
seed requirements before implementation.
**Created:** 2026-08-30
**Audience/Timing:** Architecture/database review before tasks and migration.

## Data model completeness

- [x] CHK001 Are every canonical Catalog entity and its ownership, fields, relationships, uniqueness, lifecycle, and indexes defined? [Completeness, Data Model §Entities]
- [x] CHK002 Are Category and Service aggregate/version boundaries explicit, including which child records change `service.version`? [Clarity, Data Model §Ownership and aggregate boundaries]
- [x] CHK003 Is the mixed localization representation justified and complete for every localized entity without adding a generic i18n platform? [Consistency, Plan §Data and Localization Direction, Research §explicit two-locale storage]
- [x] CHK004 Are inactive-draft nullable fields distinguished from always-invalid kind/constraint combinations? [Clarity, Data Model §ServiceField]
- [x] CHK005 Is the exact six-kind field matrix complete for requiredness, length, numeric, option, and selection constraints? [Completeness, DEC-042, Data Model §ServiceField]
- [x] CHK006 Are service-scoped price-unit identity and the explicit absence of amounts/provider prices defined? [Boundary, Data Model §ServicePriceUnit]
- [x] CHK007 Are Configuration country ownership and Catalog's FK/active-country validation boundary specified? [Dependency, Data Model §ServiceCountryAvailability]
- [x] CHK008 Are service-media association ownership, uniqueness, order, READY eligibility, and non-deletion semantics specified? [Completeness, Data Model §ServiceMediaAssociation]
- [x] CHK009 Are durable idempotency fields, states, replay rules, and pending Media reservation meaning specified? [Completeness, Data Model §CatalogCommandRequest]

## Migration clarity and compatibility

- [x] CHK010 Is the exact forward-only migration name/order defined while all 14 existing migrations remain immutable? [Clarity, Migration Plan §Baseline]
- [x] CHK011 Are new enums, nine tables, existing-model relation changes, indexes, and named constraint classes enumerated? [Completeness, Migration Plan §Phase-owned schema changes]
- [x] CHK012 Are the two architecture-inventory additions justified against simpler alternatives and assigned to Catalog? [Consistency, Plan §Complexity Tracking]
- [x] CHK013 Are generated-SQL review criteria explicit about forbidden destructive/future-phase operations? [Coverage, Migration Plan §Generated SQL review requirements]
- [x] CHK014 Are database-enforced versus transaction/application-enforced invariants distinguished? [Clarity, Migration Plan §Required database constraints]
- [x] CHK015 Are existing Media, Country, Identity, Provider/Worker, audit, and authorization compatibility effects documented? [Completeness, Migration Plan §Backfill and compatibility]
- [x] CHK016 Are clean-install and populated-R1-P07-upgrade evidence requirements independently defined? [Coverage, Migration Plan §Clean chronological installation proof, §Populated R1-P07 upgrade proof]
- [x] CHK017 Is the safe disposable target naming/approval rule explicit, including exclusion of unknown `.env` and historical databases? [Security, Migration Plan §Clean chronological installation proof]
- [x] CHK018 Is the post-application forward-fix rule explicit and consistent with immutable migrations? [Recovery, Migration Plan §Failure and forward-fix strategy]

## Seed measurability

- [x] CHK019 Are exact DEC-044 stable codes, localized values, unit count, field count/content, Egypt availability, and no-Media rule documented? [Measurability, Spec §FR-047, Data Model §Seed identities and values]
- [x] CHK020 Is create-if-missing/empty-update ownership behavior clear for existing staff-managed rows? [Clarity, Spec §FR-048–FR-049, Migration Plan §Re-run ownership rule]
- [x] CHK021 Are double-run expected identities/counts/digests objectively specified? [Acceptance Criteria, Spec §SC-005, Migration Plan §Double-run evidence]
- [x] CHK022 Is OQ-002 neutrality preserved in all seeded labels/descriptions/fields? [Consistency, DEC-044, Data Model §Fields]
- [x] CHK023 Are Provider offering/pricing, Booking/answers/snapshots, and future schema explicitly absent from the migration/seed? [Boundary, Spec §FR-045–FR-050]
