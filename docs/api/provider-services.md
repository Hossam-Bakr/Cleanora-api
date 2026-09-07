# Provider Services and Pricing (R1-P09)

**Status**: Implemented protected HTTP surface (phase completion pending owner
approval). Snapshot reads remain an **internal-only** Providers public contract;
there is no anonymous Browse or Booking HTTP API in this phase.

## Configuration prerequisite

Provider enable and Staff decision workflows require active country/currency and
pricing-policy facts from Configuration. Missing or inactive configuration maps
to `PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE` (503). There is **no
production Provider-price seed**; Catalog seed may create selectable services,
but Provider offerings and prices are created only through authorized APIs.

## Protected Provider routes

All routes require a Bearer access token plus Provider-admin global authority and
exact OWNER/ADMIN membership for the Provider.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/providers/:providerId/services` | List offerings |
| `POST` | `/api/v1/providers/:providerId/services` | Create disabled offering + initial price |
| `GET` | `/api/v1/providers/:providerId/services/:providerServiceId` | Management detail |
| `PUT` | `/api/v1/providers/:providerId/services/:providerServiceId/configuration` | Duration / notes only |
| `POST` | `/api/v1/providers/:providerId/services/:providerServiceId/price-proposals` | Retained price proposal |
| `POST` | `/api/v1/providers/:providerId/services/:providerServiceId/lifecycle` | `ENABLE` / `DISABLE` |
| `GET` | `/api/v1/providers/:providerId/services/:providerServiceId/price-history` | Safe price history |
| `GET` | `/api/v1/providers/:providerId/services/:providerServiceId/status-history` | Enable/disable history |

## Protected Staff routes

Staff routes require `providers.services.prices.approve` (active `staff_admin`).

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/staff/providers/service-price-proposals` | Pending proposals queue |
| `GET` | `/api/v1/staff/providers/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId` | Pending dossier |
| `POST` | `/api/v1/staff/providers/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId/decisions` | `APPROVE` / `REJECT` |

## Contract sources

- OpenAPI fragments: `src/swagger/r1-p09-openapi.paths.ts` (exactly 11 operations)
- Runtime merge: `src/swagger/openapi.document.ts`
- Postman: `postman/Cleanora-R1-P09-Provider-Services.postman_collection.json`
- Design contract: `specs/R1-P09-provider-services-pricing-historical-snapshots/contracts/provider-services-http.md`

Mutation bodies are strict. Client monetary result fields (`subtotal`, `total`,
`tax`, `fee`, `discount`, `commission`, `deposit`, `payable`) are rejected.

## Safety commands

```bash
npm run postman:generate:r1-p09
npm run test:r1-p09
npm run db:validate-clean-migration   # requires CLEANORA_R1_P09_DATABASE_URL
npm run db:validate-r1-p09-upgrade    # requires CLEANORA_R1_P09_DATABASE_URL
```

Disposable database names must match
`^cleanora_r1_p09(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$`.
Do not point validators at `Cleanora`, production, or unknown databases.
Live T079 migration gates remain blocked until an owner-approved disposable
target is supplied.
