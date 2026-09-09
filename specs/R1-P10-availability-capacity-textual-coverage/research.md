# R1-P10 Research and Decisions

## Time zone and calendar arithmetic

- **Decision**: evolve `platform.default_timezone` to `COUNTRY_REQUIRED`; migrate/seed Egypt as `Africa/Cairo`; use `@js-temporal/polyfill` behind a Providers-owned calendar utility.
- **Rationale**: DEC-053 requires a country-managed IANA zone. Node 24.16 reports `Temporal` unavailable and no zone library is installed. Temporal directly represents instants, zones, civil dates, DST gaps and repeated times.
- **Rejected**: second time-zone column/source; fixed offsets; minute-by-minute iteration; hand-written `Intl` offset inference.

## Interval representation

- **Decision**: accept local `HH:mm` plus `endsNextDay`, normalize to minutes after midnight, use half-open intervals, split at civil midnight, and let a dated exception replace each affected civil date.
- **Rationale**: this is DEC-054 and keeps persistence simple while supporting overnight work.
- **Rejected**: same-day-only schedules and JSON schedule blobs.

## Mutation model

- **Decision**: bounded full-replacement commands with `expectedVersion` and UUID `idempotencyKey`, Serializable transactions, fingerprinted replay and safe audit/history.
- **Rationale**: matches existing Provider workforce/service patterns and makes conflict behavior explicit.
- **Rejected**: many tiny period CRUD endpoints and last-write-wins updates.

## Evaluation and candidate lookup

- **Decision**: indexed textual candidate lookup plus one Provider evaluation under RepeatableRead; return stable facts/blockers and versions, never reservations.
- **Rationale**: DEC-059 supports later consumers without implementing Eligibility or Browse.
- **Rejected**: anonymous/customer HTTP and future Booking/busy-time inputs.

## Readiness

- **Decision**: derive setup readiness exactly as DEC-060; runtime pause/suspension/time/capacity are evaluation facts.
- **Rationale**: completed configuration should not disappear during a temporary closure.

## Migration compatibility

- **Decision**: additive tables/columns and country-config backfill from the existing global Egypt value; do not edit historical migrations.
- **Rationale**: clean and populated R1-P09 upgrade must both retain prior truth.
