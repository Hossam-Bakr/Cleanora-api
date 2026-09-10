# Quickstart — R1-P12 Browse Marketplace

## Run locally

1. Use the existing app bootstrap (`npm run dev` / repo standard start).
2. No new environment variables in MVB.
3. Guest calls do not require `Authorization`. If a Bearer token is sent, it must be valid.

## Smoke sequence

```http
GET /api/v1/browse/services?countryCode=EG&locale=AR
GET /api/v1/browse/countries/EG/cities
GET /api/v1/browse/providers?serviceId=...&countryId=...&cityId=...&startsAt=...&endsAt=...&crewPreference=any&requiredTeamUnits=1&locale=AR
GET /api/v1/browse/providers/{providerId}/teams/{teamId}?serviceId=...&countryId=...&cityId=...&startsAt=...&endsAt=...&crewPreference=any&requiredTeamUnits=1&locale=AR
```

## Evidence commands

See `test-strategy.md`. Do not treat inherited whole-tree `test:unit` failures as P12 regressions without diagnosis.
