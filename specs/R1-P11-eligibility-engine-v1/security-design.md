# R1-P11 Security Design

Authority: DEC-069, DEC-070, DEC-071, DEC-072, DEC-079.

## Trust boundary

| Layer | Trust |
|---|---|
| Composition | Trusted wiring of Eligibility + dependency readers |
| In-process callers supplied by composition | Trusted application components only |
| HTTP (P11) | **None** for eligibility — no routes |
| Caller-supplied role strings / Provider IDs / evaluation IDs | **Not** credentials |
| Dependency DTOs | Validate; corrupt DTO → hard failure |
| Performance evidence port | Trusted only when composition injects it; tests control fixtures |

## Authorization model

P11 does not introduce end-user authorization. Future HTTP adapters (P12+) must
supply authentication, authorization, and privacy independently. Internal
diagnostic results must never be exposed merely because a route is labelled
“internal.”

## Separated allowlists (DEC-079 / P11-PREP-07)

Persistence, diagnostics, Browse projection, and routine logs are **separate**
schemas. Do not merge “persisted / logged” into one allowlist.

### 1. Persistence (`requestNormalized`, `evidenceSafe`, candidate JSON)

**Allow:**

- Service / country / city / district ids
- UTC interval, crew preference, required units
- Discovery/explicit mode (explicit stores sorted Provider ids only)
- Pinned rule version id/checksum, hashes, sorting facts
- Rule outcomes and exclusion reason codes
- Team aggregate cleaner gender counts and escort validity booleans
- Performance metric key / decimal value / sample count / observedAt when evaluated

**Deny (absolute):**

- Raw street addresses
- Customer identity / PII / phone / email
- **Worker IDs** and Worker names/contacts
- Raw member arrays
- Verification document payloads
- Payout account numbers / holder names
- Geo coordinates / radius
- `ownerUserId`

### 2. Diagnostic API output (`DiagnosticResult`)

**Allow:** Eligible and excluded Provider/Team rows with rule outcomes, exclusion
reasons, sorting facts, and evaluation metadata for approved in-process
consumers/tests.

**Deny:** Same absolute deny list as persistence. Diagnostics may include
machine-readable reasons but **must not** include Worker IDs or member arrays.

### 3. Browse projection (`BrowseSafeProjection`)

**Allow:** Only the allowlist in [browse-consumer-contract.md](contracts/browse-consumer-contract.md)
(eligible identities + sorting facts + safe metadata subset).

**Deny:** Exclusion diagnostics, Worker IDs, member-level evidence, reason dumps,
`providerIds` request echo.

### 4. Routine logs

**Allow:** Operational metadata only — counts, hashes, durations, typed error
codes, evaluation id, trace id, discovery counts.

**Deny:** Reason dumps with PII, Worker IDs, full evidence payloads, raw
dependency DTOs, customer identifiers.

## Diagnostics vs projection

| Concern | Diagnostic evaluate | Browse projection | Persistence | Routine logs |
|---|---|---|---|---|
| Eligible Teams | Yes | Yes | Yes | Counts only |
| Exclusion reasons | Yes | No | Yes (allowlisted codes) | No dumps |
| Worker IDs | **No** | **No** | **No** | **No** |
| Member-level arrays | **No** | **No** | **No** | **No** |
| Rule version / hashes | Yes | Safe subset | Yes | Hashes/ids only |

## Retention privacy

- 30-day retention on evaluations/results (`expiresAt = completedAt + 30d`).
- Purge removes expired evaluation trees only (batch-bounded).
- Rule versions retained.
- No authorization to purge inherited user data.
- Eligibility history retention is the specific DEC-069 exception; it does not
  weaken other audit retention.

## Rule provenance

Seed/migration provenance identifies the controlled system operation. Do not
invent human actors for automated seed rows.

## Threat notes

- Enumeration: no HTTP list of other Providers’ exclusions.
- Integrity: atomic persist or fail; no success with missing evidence.
- Confusion: setup placeholder `eligibleForPublicBrowse: false` is not an authz
  or eligibility signal for P11 runtime.
- Geo: reject unsupported geographic input explicitly rather than ignoring fields.
- Privacy regression: negative tests must assert Worker IDs never appear in
  persistence JSON, diagnostic fixtures intended for safe storage, Browse
  projection, or routine log payloads.

