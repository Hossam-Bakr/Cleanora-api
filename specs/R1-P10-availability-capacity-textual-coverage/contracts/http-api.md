# R1-P10 Protected HTTP Contract

All routes use the existing response/error envelope. Mutations require `expectedVersion` and UUID `idempotencyKey`; Staff locality writes also require a meaningful approved reason. The Phase 10 paths are fixed below and expose no customer/anonymous evaluation.

## Staff Configuration

- `GET|POST /api/v1/staff/configuration/countries/:countryId/cities`
- `PATCH /api/v1/staff/configuration/cities/:cityId`
- `GET|POST /api/v1/staff/configuration/cities/:cityId/districts`
- `PATCH /api/v1/staff/configuration/districts/:districtId`
- `GET|PUT /api/v1/staff/configuration/countries/:countryId/time-zone`
- Permissions: `configuration.localities.read` and `.write`; write is privileged and audited.

## Provider management

- `GET|PUT /api/v1/providers/:providerId/availability/coverage`
- `GET|PUT /api/v1/providers/:providerId/availability/calendar`
- `GET|PUT /api/v1/providers/:providerId/availability/workers/:workerId/calendar`
- `GET|PUT /api/v1/providers/:providerId/availability/capacity`
- `GET|POST /api/v1/providers/:providerId/availability/pause`
- `POST /api/v1/providers/:providerId/availability/pause/resume`

Owner/Admin scope follows DEC-058. Cross-Provider resources return the existing non-enumerating not-found form. Validation covers invalid ancestry, inactive areas, duplicate/overlapping periods, stale versions, replay mismatch, pause conflict and invalid dates/instants. No endpoint exposes contact data, customer lookup, candidate lists or reservation behavior.
