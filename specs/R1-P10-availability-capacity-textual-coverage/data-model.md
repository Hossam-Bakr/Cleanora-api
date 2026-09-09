# R1-P10 Data Model

## Configuration-owned entities

- `City`: id, countryId, stable code, localized English/Arabic names, active flag, version, timestamps. Unique country/code and country/localized-name constraints; country deletion restricted.
- `District`: id, cityId, stable code, localized names, active flag, version, timestamps. Unique city/code and city/localized-name constraints; city deletion restricted.
- Country time zone: existing `AppConfig` metadata for `platform.default_timezone` becomes `COUNTRY_REQUIRED`; `CountryConfig` stores the IANA string. Egypt is `Africa/Cairo`.
- `ConfigurationLocalityCommand` (repair item 5): durable UUID-idempotency receipt for every Staff locality/time-zone write (city create/update, district create/update, country time-zone PUT). Actor, operation-scoped `scopeKey`, caller-supplied UUID `idempotencyKey`, SHA-256 `requestFingerprint` over every semantically relevant input, in-progress/accepted status, safe result code/JSON and timestamps. Unique on `(scopeKey, idempotencyKey)`. Owned entirely by Configuration; never shared with Catalog's or Providers' own command tables.

## Providers-owned entities

- `ProviderAvailabilityConfiguration`: one per Provider; aggregate version and timestamps.
- `ProviderCoverageArea`: Provider plus exactly one cityId or districtId, timestamps. Partial unique indexes prevent duplicates.
- `ProviderSchedule`: Provider, weekday 1–7, startMinute 0–1439, endMinute 0–1439, endsNextDay, timestamps.
- `ProviderScheduleException`: Provider, localDate, closed flag, optional period fields, timestamps. Closed rows contain no period; open rows contain a valid period. Multiple open rows per date are allowed without overlap.
- `WorkerSchedule` and `WorkerScheduleException`: same period/date form scoped to an existing Provider Worker.
- `ProviderCapacityRule`: one per Provider, maxSimultaneousTeams 1–50, version, timestamps.
- `ProviderTemporaryPause`: Provider, startedAt, optional endsAt, optional resumedAt, actor, version, timestamps. A partial unique index permits one unresolved pause; effective means startedAt <= now, resumedAt null and endsAt null or now < endsAt.
- `ProviderAvailabilityCommand`: Provider scope/idempotency key, actor, fingerprint over every semantically relevant command input (selections, expected version and reason where applicable), in-progress/accepted status and safe replay result. A fingerprint mismatch or a different `actorUserId` on a reused key is the same stable idempotency conflict (repair item 4, extended by final repair item 4); an `IN_PROGRESS` or incomplete row is never a successful replay. Reservation itself uses a transaction-safe `createMany({ skipDuplicates: true })` write, not `create` + catch-unique-violation + `findUnique`, because a PostgreSQL unique violation aborts the whole interactive transaction (final repair item 3).
- `ProviderAvailabilityHistory`: append-only target/event/version, actor, request, safe before/after and timestamp.

## Invariants

- Provider coverage locality belongs to the Provider profile country exactly (repair item 3): every selection's own country must equal the trusted `providerCountryId`, and a Provider with no configured country can never validly select coverage; active ancestry is required for writes and matches.
- Trusted authorization facts (active user, enabled `provider_admin` capability, approved Provider, exact/active OWNER-or-ADMIN membership, Provider profile country) are read from Authentication's public contract and Providers' own tables inside the same transaction — never hardcoded or caller-supplied (repair item 2). Coverage-management authorization applies the DEC-058 policy exactly, not R1-P09's Provider Service policy: an active, exact-scope Owner is allowed **without** an enabled `provider_admin` capability; an active, exact-scope Admin is allowed only when that capability is enabled; every other membership level, an inactive identity/membership, or a wrong-Provider scope is denied the same non-enumerating way; an unapproved Provider is denied as a state-invalid target (final repair item 1). Configuration's locality facts used for the country check below are read through a `LocalityReader` bound to the exact same interactive transaction as the coverage mutation, supplied only via the per-unit-of-work context — never a separately opened, full-client reader (final repair item 2).
- Provider/Worker periods are positive, no longer than 24 hours and non-overlapping after overnight normalization; adjacency is allowed.
- A dated exception replaces weekly hours for its civil date. Empty/closed means no time on that date.
- Worker effective availability is intersected with Provider effective availability.
- A capacity unit is one fully available active complete Team. At least one current cleaner is required; every current member must be active and available. Escorts add no unit.
- Effective capacity is `min(configured limit, available complete Teams)`. Unteamed Workers do not count.
- Runtime suspension or overlapping pause yields unavailable/zero capacity. Neither erases setup readiness.

## State transitions

- Locality: active ↔ inactive through versioned Staff change; never HTTP delete.
- Configuration collections: replace version N → N+1 atomically; replay returns the accepted N+1 result; stale version conflicts.
- Command receipts (`ConfigurationLocalityCommand`, `ProviderAvailabilityCommand`): absent → `IN_PROGRESS` (reserved) → `ACCEPTED` (completed, safe result stored) inside the same Serializable transaction as the mutation. Same actor/key/same-fingerprint replays the stored `ACCEPTED` result without a second audit/history write; same key/different-fingerprint **or** same key/different actor raises the same stable conflict (final repair item 4); an `IN_PROGRESS` row is never treated as a successful replay.
- Pause: absent/expired/resumed → active pause; active → resumed; automatic expiry is derived from time and needs no mutation.
