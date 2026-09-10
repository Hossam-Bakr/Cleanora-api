# Research — R1-P12 Browse Marketplace

Date: 2026-09-10

## Decisions

| Topic | Choice | Why |
|---|---|---|
| Module | `bookings` | Architecture owns browse event tables and marketplace consumer role |
| Analytics tables | Defer | Roadmap marks optional; MVB needs no persistence for discovery |
| Eligibility | `getStandardBrowseCandidates` | DEC-072; sole eligibility authority |
| `eligibleForPublicBrowse` | Ignore as filter | Still typed `false` placeholder in Providers readiness |
| Auth | Optional Bearer | Guest Browse required; invalid token still fails |
| Contacts | Omit raw channels | Privacy; gallery kept |
| Ratings | Omit | No ratings module |
| Sort | Price asc + ids | Standard; no premium |
| Detail eligibility | Re-evaluate facade | Correctness over cache complexity |
| Locality lists | Extend Configuration public reader | Configuration owns cities/districts |
| Path prefix | `/api/v1/browse` | Clear guest marketplace surface |

## Alternatives rejected

- New standalone `browse` module — conflicts with architecture ownership of browse events under `bookings`.
- Reuse staff catalog HTTP with loosened auth — mixes staff mutation surface with guests.
- Trust client-supplied eligible provider ids — bypasses Eligibility.
- Ship ratings stubs with zeros — invents marketplace reputation (rejected in P11 decisions).

## Dependency inventory

See explore briefing: Eligibility facade; CatalogDefinitionReader; Providers preview/team facts/pricing snapshot; Media signed URLs via Providers; Configuration country/locality; Auth middleware patterns (optional auth new).
