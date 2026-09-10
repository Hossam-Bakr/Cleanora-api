# Browse HTTP API Contract (R1-P12)

Base: `/api/v1/browse`  
Auth: optional Bearer (guest allowed).  
Success/error envelopes: repository standard (`success`, `data`/`error`, `requestId`).

## Common browse context query (list + detail)

| Param | Required | Notes |
|---|---|---|
| `serviceId` | yes (list/detail) | Catalog service id |
| `countryId` | yes | Active country id |
| `cityId` | yes | |
| `districtId` | no | |
| `startsAt` | yes | UTC ISO |
| `endsAt` | yes | half-open |
| `crewPreference` | yes | `all_male` \| `all_female` \| `any` |
| `requiredTeamUnits` | yes | 1–50 int |
| `locale` | yes | `AR` \| `EN` |
| `maxPriceAmount` | no | decimal string; list only |
| `q` | no | display-name search; list only |
| `limit` | no | default 20, max 50; list only |
| `cursor` | no | opaque; list only; server snapshot expires after 5 minutes and process restart invalidates outstanding cursors |

Reject: `lat`, `lng`, `radius`, `coordinates`, map/socket params.

## Endpoints

### GET `/services`

Query: `countryCode`, `locale`, optional `cursor`, `limit`.  
Data: selectable catalog summaries from `CatalogDefinitionReader.listSelectable`.

### GET `/services/:serviceId`

Query: `countryCode`, `locale`.  
Data: snapshot-ready definition projection safe for guests (no staff-only fields).

### GET `/countries/:countryCode/cities`

Data: active cities `{ cityId, code, nameAr, nameEn, ...safe }`.

### GET `/countries/:countryCode/cities/:cityId/districts`

Data: active districts for city.

### GET `/providers`

Runs Eligibility browse facade → filter → sort → paginate.  
Each item: `providerId`, `teamId`, locale display name fields, optional thumb media, `sortingFacts`, safe metadata subset.

The first page freezes the filtered/sorted candidate identities in a bounded
in-process snapshot. Cursor pages reuse that snapshot rather than re-running
Eligibility with a new semantic `evaluatedAt`; media URLs are issued only for
the current page. A missing/expired snapshot fails with `VALIDATION_FAILED`.

### GET `/providers/:providerId/teams/:teamId`

Requires browse context query. Re-evaluates eligibility; requires pair in eligible set.  
Data: contact-free profile, gallery, service price facts, crew summary aggregates, `bookingPrerequisites`.

## bookingPrerequisites (detail)

```json
{
  "bookingAvailable": false,
  "requiresVerifiedCustomer": true,
  "phase": "R1-P13+"
}
```

## Errors (stable codes)

| Code | When |
|---|---|
| `VALIDATION_FAILED` | Zod / bad cursor / geo extras |
| `AUTHENTICATION_REQUIRED` | Malformed/invalid Bearer when present |
| `BROWSE_EVALUATION_FAILED` | Eligibility hard failure mapped safely |
| `BROWSE_PROVIDER_NOT_FOUND` | Detail target not eligible / unknown (non-enumerating) |
| `COUNTRY_UNAVAILABLE` | Inactive/unknown country for locality helpers |
| `RATE_LIMIT_EXCEEDED` | Provider list exceeds 60/minute/IP or detail exceeds 120/minute/IP |
| `RATE_LIMITER_UNAVAILABLE` | Guest abuse protection cannot make a decision |

## Out of contract

Eligibility admin diagnostics, booking create, payments, ratings values, staff catalog mutations.
