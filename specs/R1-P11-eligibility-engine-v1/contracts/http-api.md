# HTTP API — R1-P11

## Decision

**ZERO new HTTP endpoints** for Eligibility in P11 (DEC-070, DEC-072).

P11 exposes in-process module contracts only:

- `evaluateEligibility` (discovery + explicit modes)
- `getStandardBrowseCandidates` (discovery only; no `providerIds`)
- `purgeExpiredEvaluations` (application/ops, not public HTTP)

## Explicit non-deliverables

- No customer, anonymous, Provider, Staff, or “internal-secret” eligibility routes
- No OpenAPI path objects for eligibility evaluation
- No Postman eligibility requests
- No Swagger fragments mounting eligibility handlers
- No placeholder `/internal/eligibility/*` routes

## Documentation obligation

During implementation, record a short note in API navigation / phase docs that
P11 intentionally adds no HTTP operations; Browse HTTP remains P12. Do **not**
invent stub paths “for later.”

## Existing HTTP untouched (except approved dependency side effects)

P09/P10 protected management routes remain as delivered. Providers setup
readiness may continue to show `eligibleForPublicBrowse: false` as a
placeholder; P11 does not change that into a live eligibility oracle.
