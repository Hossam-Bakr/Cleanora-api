# Implementation Plan: R1-P12 — Browse Marketplace & Provider Details

**Branch**: `codex/r1-p12-browse-marketplace-provider-details` | **Date**: 2026-09-10 | **Spec**: [spec.md](./spec.md)  
**Authority**: `/work-on-next-phase` activation; awaiting Codex preparation acceptance of MVB holdings in spec Clarifications

## Summary

Scaffold a new `bookings` module that mounts guest-capable `/api/v1/browse/*` HTTP.
Eligible Provider/Team discovery must call composition-wired
`getStandardBrowseCandidates`. Bookings enriches eligible identities with
contact-free Provider projections, signed media, Catalog selectable summaries,
Configuration locality helpers, and team/crew summaries — all via public
contracts. No booking mutation, no ratings invention, no optional analytics
tables in MVB, no maps/premium/wallets/Docker/cloud.

## Technical Context

**Language/Version**: TypeScript (repo Node/Express stack)  
**Primary Dependencies**: Express, Zod, Prisma/PostgreSQL, existing Auth/Catalog/Providers/Eligibility/Media/Configuration public contracts  
**Storage**: MVB expects **no new tables** (optional `provider_view_events` / `search_events` deferred). Migration gate NOT_APPLICABLE unless acceptance forces tables or schema is otherwise required.  
**Testing**: New `vitest.r1-p12.config.ts` + `npm run test:coverage:r1-p12`; unit + HTTP integration; privacy assertions; OpenAPI/Postman  
**Target Platform**: Existing modular-monolith backend  
**Performance Goals**: One Eligibility evaluation per list request fingerprint; paginate in-memory/sorted eligible set (already bounded by P11 limits); signed URL issuance bounded to page/detail  
**Constraints**: DEC-072 facade; contact-free privacy; no premium boost; textual geo only; no wallets; Docker/cloud deferred  
**Scale/Scope**: Egypt active-country browse MVB; guest + optional auth

## Constitution Check

- Standalone repository-local behavior only.
- One deployable modular monolith; `bookings` owns Browse HTTP orchestration.
- Cross-module access only through named public contracts / composition.
- Zod at HTTP boundary; deny-by-default except explicit guest browse reads.
- No stored-value wallets; no Docker/cloud.
- Traceability: FR/SC → tasks with tests.
- Do not edit applied migrations.

## Architecture and Ownership

### Bookings (new module)

Owns:

- Browse application services (list, detail, catalog projection HTTP adapters, locality HTTP adapters)
- `/api/v1/browse` routes, controllers, Zod schemas, error mapping
- Pagination/cursor encoding bound to evaluation fingerprint (`resultHash` + filter/sort/locale params)
- Future home for optional view/search events (not in MVB)

Does **not** own: Eligibility rules, Provider persistence, Catalog persistence, Media storage, Configuration localities tables, Ratings.

### Providers (extend public surface as needed)

- Implement/realise contact-free preview with signed logo/cover/gallery delivery for browse enrichment (today stubbed/null media).
- Expose safe team/crew summary projection for browse (reuse `getBookingSafeTeamFacts` mapped to **no Worker IDs** in HTTP DTO — counts/genders/`cleans` aggregates only).

### Configuration (extend public reader)

- Add browse-safe list methods for active cities (by country) and active districts (by city) on the public locality contract so Bookings does not import repositories.

### Catalog / Eligibility / Media / Authentication

- Catalog: reuse `CatalogDefinitionReader`.
- Eligibility: reuse `getStandardBrowseCandidates` only for discovery lists.
- Media: signed delivery via existing Provider media ports through Providers projection (Bookings must not call Media repositories).
- Authentication: add **optional** authenticate middleware (absent token → guest; present token → must validate).

### Composition / routes

Wire `bookingsBrowseService` + router into `composition.ts` and `routes/index.ts`.

## HTTP surface (planned)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/browse/services` | optional | Selectable catalog services |
| GET | `/api/v1/browse/services/:serviceId` | optional | Selectable service snapshot-ready definition projection |
| GET | `/api/v1/browse/countries/:countryCode/cities` | optional | Active cities |
| GET | `/api/v1/browse/countries/:countryCode/cities/:cityId/districts` | optional | Active districts |
| GET | `/api/v1/browse/providers` | optional | Eligible list + filters/search/pagination |
| GET | `/api/v1/browse/providers/:providerId/teams/:teamId` | optional | Detail in browse context (query carries evaluation inputs) |

Exact query/body schemas: [contracts/http-api.md](./contracts/http-api.md).

## Evaluation fingerprint & pagination

1. Validate browse context query.
2. Call `getStandardBrowseCandidates` once per list request.
3. Apply `maxPriceAmount` and `q` (display-name) filters.
4. Sort by price asc → providerId → teamId.
5. Issue cursor = HMAC-signed opaque encoding of `{ resultHash, filterDigest, offset }`. The filter digest binds the full browse context plus locale/search/price filter. A bounded five-minute in-process snapshot freezes sorted candidate identities across pages; process restart or expiry invalidates the cursor safely. Use the access secret when configured and a process-random secret otherwise (no static fallback and no new environment variable).
6. Detail requires same browse context query; re-evaluate or verify candidate still in eligible set for that context (plan default: **re-call facade** and require membership — simpler correctness than caching).

## Privacy allowlist

List/detail may include only:

- Provider/Team ids
- Display names / descriptions (AR/EN as requested by locale)
- Country code
- Signed media delivery URLs + expiry for logo/cover/gallery
- Sorting/price facts from Eligibility projection and/or Provider service snapshot for requested service
- Crew summary aggregates (counts by gender/cleaner flags) — **no workerId, no names**
- `bookingPrerequisites` hint
- Eligibility metadata subset safe for clients (`evaluatedAt`, `ruleVersionId`, `resultHash` optional)

Forbidden: phones, emails, channels, raw storage keys, verification docs, payouts, exclusion reason arrays, Worker IDs.

## Test strategy

| Layer | Focus |
|---|---|
| Unit | Sorting/filter/cursor; DTO allowlist; optional-auth middleware |
| Integration HTTP | Guest catalog→list→detail; ineligible exclusion; privacy markers; validation; pagination |
| Contract | OpenAPI + Postman validate |
| Coverage | Phase config thresholds 80/75/80/80 |
| Boundaries | Import lint / module boundary review |

Discovered commands:

- `npm run typecheck`
- `npm run lint` (phase-intended tree if repo pattern exists)
- `npm run test:unit` (honest inherited failures remain reportable)
- `npm run test:coverage:r1-p12` (new)
- `npm run openapi:validate`
- `npm run postman:validate`
- `npm run docs:check`
- `npm run build`
- Prisma validate; migration proofs N/A unless schema changes

## Implementation batches

1. **Batch A — Scaffold & contracts**: bookings module skeleton, optional-auth middleware, Configuration locality public list methods, Providers contact-free media preview, OpenAPI stub.
2. **Batch B — Catalog & locality HTTP**: services + cities/districts browse routes + tests.
3. **Batch C — Eligible list**: providers list with Eligibility facade, sort/filter/pagination + tests.
4. **Batch D — Provider detail**: detail enrichment + privacy tests + prerequisites hint.
5. **Batch E — Artifacts & gates**: Postman, docs, coverage, boundary review, Codex final review.

Mandatory Codex batch acceptance is **not** pre-required unless prep acceptance names it; default is continuous Cursor implementation after one prep acceptance.

## Media signing failure policy (EX-01 — locked)

If signed delivery URL issuance fails for one logo, cover, or gallery item:

1. Set `logo` / `cover` to `null` when that slot fails.
2. Omit the failed gallery item from the `gallery` array.
3. Continue returning the rest of the list card or detail payload successfully.
4. Do **not** fail the whole Browse response solely because one media sign failed.
5. Do **not** leak storage keys or raw Media internals in errors.

## Risks

| Risk | Mitigation |
|---|---|
| Contact-free preview still stubbed | Task to implement Providers projection with signed URLs before detail ships |
| LocalityReader lacks list APIs | Extend Configuration public contract in-phase |
| Eligibility cost per detail | Accept re-evaluate for correctness in MVB |
| Inherited dirty P11 tree | Do not mix into P12 tasks; fix only if gates block |
| Ratings expectations | Explicit null/omit; no synthetic scores |
| Media sign flake | EX-01 omit policy above |
| Guest evaluation abuse | IP-hashed limits: provider list 60/minute; detail 120/minute; limiter failure is fail-closed |

## Complexity tracking

MVB deliberately avoids analytics tables, ratings module, booking drafts, and map search to keep one coherent guest discovery slice.
