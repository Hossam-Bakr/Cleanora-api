# Data model — R1-P12

## Persistence

MVB adds **no new Prisma models**. Optional architecture tables
`provider_view_events` and `search_events` remain deferred.

## Read models (application DTOs)

### BrowseEvaluationContext
serviceId, countryId, cityId, districtId?, startsAt, endsAt, crewPreference,
requiredTeamUnits, locale

### BrowseCandidateCard
providerId, teamId, displayName (locale), optional thumb media, sortingFacts,
safe metadata subset

### BrowseProviderDetail
contact-free profile, gallery[], servicePriceFacts, crewSummary aggregates,
bookingPrerequisites, ratingSummary=null/omitted

### BrowseLocalityCity / District
ids, codes, localized names, active flag only

## Ownership

| Concern | Owner |
|---|---|
| Browse HTTP / cursors | bookings |
| Eligibility evaluation | eligibility |
| Provider profile/media facts | providers + media |
| Catalog selectables | catalog |
| Cities/districts | configuration |
