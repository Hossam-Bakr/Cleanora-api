# R1-P11 Research

**Phase**: Eligibility Engine V1  
**Authority**: DEC-062 (activation) + DEC-063–DEC-084 (Codex under delegated authority)  
**Date**: 2026-09-09  
**Repair**: Aligns with preparation re-review CHANGES_REQUIRED closure (DEC-084 Repairs A–D; prior DEC-079–083).

## Decision rationales (summary)

| DEC | Chosen core | Why | Rejected |
|---|---|---|---|
| 063 | `eligibility` module owns orchestration + 3 tables | Matches entity-ownership; Browse/Recommended share domain | Providers-owned eligibility; shared God engine; new Browse module in P11 |
| 064 | Fixed presentation order + complete independent reasons | Diagnosis without inventing downstream failures | First-failure-only; global Provider scan |
| 065 | Explicit UTC + P10 zone/calendar reuse | Avoid dual calendar truth; prevent short-interval false eligibility | Ambiguous local times; invented duration math |
| 066 | One `RepeatableRead` tx + hashes/evidence | Atomic consistent snapshot; honest reproducibility | Sequential independent reader txs; “same query always equal live” |
| 067 | Immutable rule versions + seed | Real version table without admin product | Mutable JSON singleton; caller-picked live versions |
| 068 | Performance gate disabled; missing ≠ FAIL | Roadmap: gate when data exists; protect cold start | Missing=0; silently enable ratings |
| 069 | Atomic persist + 720-hour purge | Useful history without unbounded PII | Indefinite retention; hash-only “evidence”; partial success |
| 070 | In-process only; diagnostics ≠ projection | Reusable backend contract without exposure | “Internal” HTTP leaking reasons |
| 071 | Business exclude vs hard fail | Infra faults ≠ empty marketplace | Catch-all empty arrays; unlimited retries |
| 072 | Facade + real integration proof | Honest DoD; P12 mounts HTTP | README-only promise; P12 work in P11 |
| 073 | Extend public readers | Atomic Team projection without private imports | Foreign Prisma; copied price/calendar |
| 074 | Crew on cleaners; capacity after filter | Vision Escort exception; no inflated capacity | Escort-as-cleaner; unfiltered P10 aggregate after crew |
| 075 | Sorting inputs + 500/5000 bounds | Stable facts; bounded work | Silent truncation; ranking product |
| 076 | Additive `r1_p11_eligibility_engine_v1` | Incremental migration discipline | Applied-migration edits; geo tables |
| 077 | Textual only; typed future hooks | Extension without speculative geo | Dormant geo scaffolding |
| 078 | Phase + repository gates | P10 waiver does not carry forward | Phase-only completion |
| 079 | Opaque tx factories; ID resolution; locale-independent pricing; separate discovery/explicit; Team aggregates without Worker IDs | Executable contracts; privacy; no invented locale | Per-call nested txs; raw workforce DTO forwarding |
| 080 | Factual prerequisites; Provider/Team eligibility algebra; disabled=`NOT_APPLICABLE` | Removes short-circuit/aggregation ambiguity | “Prior applicable”; informational codes as exclusions |
| 081 | `evaluatedAt` before retry; canonical SHA-256; performance evidence schema | Stable clock across retries; reproducible hashes | Clock inside retry; timestamps loosely “all excluded” |
| 082 | Physical types; XOR; no live Provider/Team FK; full seed verify; purge bounds | Migration-ready persistence | Deferred schema alternatives; checksum-only seed |
| 083 | T007 = `eligibility.public.ts` declarations only; T006 green before Batch A accept | Compact module convention | Empty layer folders / fake stubs |
| 084 | Named Catalog/Config methods; pricing AVAILABLE\|UNAVAILABLE; evaluationOutcomes; typed evidence/hashes; port MISSING-only; composite FK; 720h purge; no asOf | Close remaining PREP-01–04 gaps | Conditional getDefinition; clamp purge; hard-if-global inactive service |

Full decision text: `docs/product/decision-log.md`, `pm-preparation-report.md`,
`preparation-review-report.md`, `preparation-rereview-report.md`.

## Reader inventory (resolved for DEC-079 / DEC-084)

| Contract / reader | Owner | Capability | P11 disposition |
|---|---|---|---|
| `createTransactionalCatalogDefinitionReaderFactory` + `getProviderOfferingReference` / `resolveSelectableProviderOffering` | Catalog | Service/country offering | **Reuse** named methods; null → Catalog business outcome |
| `createTransactionalActiveCountryReader` / `getActiveCountryById` + locality/TZ readers | Configuration | Active country (`EG`), zone, ancestry | **Reuse**; unknown ancestry = global validation failure |
| `ProviderServiceSnapshotReader` (locale-bound) | Providers | Localized snapshot | **Reuse unchanged** for other consumers |
| **Eligibility pricing projection** | Providers | Discriminated `AVAILABLE` \| `UNAVAILABLE` | **New** — reuses P09 selection; CONFLICT rejects |
| Eligibility Provider lifecycle projection | Providers | `PRESENT` \| `MISSING` | **New** narrow DTO |
| `ProviderOperationalAvailabilityReader` | Providers | Discovery + Team budget/`OVERFLOW` + missing-config | **Extend** |
| Workforce booking-safe DTOs (`workerId`) | Providers | Member-level facts | **Not forwarded**; escort not universally required |
| `PerformanceEvidencePort` | Eligibility | Returns evidence \| `MISSING`; Eligibility owns samples/freshness/threshold | **New** port |

## Contract gaps closed by DEC-079–084

1. **Transaction binding**: Opaque `tx` factories only; bound readers must not open nested txs.
2. **Pricing without locale**: Discriminated `AVAILABLE` (non-null money) \| `UNAVAILABLE`; CONFLICT rejects.
3. **Team projection**: Aggregate cleaner gender counts + escort validity facts; escort not required on every Team; budget+OVERFLOW.
4. **Verdict algebra**: Provider/Team predicates; `evaluationOutcomes.catalog`; `TEAM_STRUCTURALLY_INVALID`.
5. **Timing / evidence**: `evaluatedAt` before ≤3 retries; typed snapshot; exact hash inputs; concurrent may succeed without retry.
6. **Persistence**: Physical types, XOR, composite FK `(ruleVersionId, countryId)`, unique `(id, countryId)`, 720h retention, reject invalid purge batchSize, no caller `asOf`.
7. **Batch A**: Declarations-only public file; `EligibilityError` interface (DEC-083/084).

## Determinism boundary (DEC-081 / DEC-084)

Semantic result equality:

`normalizedRequest + pinnedRuleBundle + EligibilityEvidenceSnapshot + evaluatedAt + engine/calendarVersions`

**Outside equality**: evaluation/candidate ids, trace id, execution duration,
persistence timestamps (`createdAt`, `completedAt`, `expiresAt`).

**Inside equality**: `evaluatedAt` (must not be treated as “any timestamp”).

Canonical hashes: SHA-256 over UTF-8 canonical JSON with exact
`requestHash` / `evidenceHash` / `resultHash` input sets (null-vs-omit and
array ordering defined in the public contract).

## Browse DoD interpretation

P11 **proves** `getStandardBrowseCandidates` as the application contract Browse
will call. Facade forbids `providerIds`. P12 **mounts** HTTP/marketplace UX.
A type-only facade or mocked evaluator does not satisfy SC-005 / DEC-072.

## Non-goals confirmed

- No wallets, Docker/cloud, Booking, geo, Ratings production metrics,
  rule-authoring HTTP, P12 routes.
- No deletion of inherited/existing user data during purge design (purge targets
  P11 evaluation rows only; DEC-069 retention exception for eligibility history).

## Sources consulted

- `docs/product/decision-log.md` (DEC-005, DEC-062–084)
- `specs/R1-P11-eligibility-engine-v1/preparation-review-report.md`
- `specs/R1-P11-eligibility-engine-v1/preparation-rereview-report.md`
- `specs/R1-P11-eligibility-engine-v1/pm-preparation-report.md`
- `docs/architecture/entity-ownership.md` (eligibility tables)
- `docs/architecture/module-template.md` (no empty shells)
- P09/P10 public reader surfaces in `src/modules/*/ *.public.ts` (inspection for
  contract design only; this repair batch does not modify them)

