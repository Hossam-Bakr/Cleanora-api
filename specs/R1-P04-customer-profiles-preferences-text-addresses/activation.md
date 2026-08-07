# R1-P04 — Customer Profiles, Preferences & Text Addresses

**Status:** Not active — specification preparation complete; R1-P03A Complete
gate satisfied on `2026-08-07`; planning resume requires separate explicit
human-owner activation; R1-P03 remains Complete

**Activated:** 2026-08-05 by explicit human-owner authorization (specification
preparation); subsequently paused for R1-P03A; Complete prerequisite now met

## Goal

Allow customers to manage identity-adjacent account data and customer-owned
text addresses without introducing map or provider-onboarding dependencies.

## Authorized preparation scope

- Update the live phase pointer and record this activation.
- Create the R1-P04 business specification from canonical roadmap and approved decisions.
- Generate and validate `checklists/requirements.md`.
- Stop after specification readiness assessment.

## Roadmap scope

- Individual, company, and engineer customer profiles
- Profile image, contact display, language and notification preferences
- Customer-owned text addresses
- Account-deactivation, deletion, and data-export request foundations

## Canonical dependencies and boundaries

- R1-P01 country configuration; R1-P02 identity/authentication; R1-P03 permissions and audit
- DEC-004 excludes geospatial dependencies from Release 1
- **DEC-030**: Customer self-service authorizes via trusted
  `AuthenticationPrincipal` facts, `SELF` ownership, and FR-028 category
  eligibility — without a `customer` role grant, `resource.self.read`/
  `resource.self.write`, or other role-derived R1-P04 customer permissions. A
  historical `customer` user-role grant is not required and does not affect
  eligibility.

## Clarification outcome

All owner clarification sessions are complete. Independent specification re-review
returned `PASS`. No owner product decision remains open in the R1-P04 specification.

## Activation guardrails

- R1-P03 is Complete. R1-P03A is Complete as of `2026-08-07`.
- R1-P04 is **not active**. The R1-P03A Complete sequencing gate is satisfied.
- The prior **authorization-provisioning blocker** (customer-role grants required
  before R1-P04 planning) remains **removed by DEC-030**.
- Do not edit applied migrations or change R1-P02 authentication contracts.
- Do not implement R1-P04 code until separately authorized.
- R1-P04 may resume planning only after **separate** explicit human-owner
  activation (not implied by the R1-P03A Complete approval alone).

## Current gate

Awaiting separate explicit human-owner authorization to resume R1-P04 planning.
R1-P04 specification remains complete; only authorization relationship docs were
aligned to DEC-030 during R1-P03A.
