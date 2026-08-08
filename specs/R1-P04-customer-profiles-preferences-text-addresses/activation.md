# R1-P04 — Customer Profiles, Preferences & Text Addresses

**Status:** **Complete** as of `2026-08-08` by explicit human-owner approval.
Fresh independent final implementation re-review **`PASS`**. Tasks **T001–T120**
checked. Technical-planning review **`PASS`**. Final `/speckit.analyze`
**`CLEAN`**. Live Cloudinary smoke **PASS**. Proof DB
`cleanora_r1_p04_clean_proof`. Historical implementation review
**`CHANGES REQUIRED`**, historical first re-review **`BLOCKED`**, and historical
later re-review **`CHANGES REQUIRED`** remain labelled historical evidence only.
No next phase is active.

**Human-owner Complete approval (exact):**

```text
I approve R1-P04 — Customer Profiles, Preferences & Text Addresses as Complete.
```

**Owner acknowledgment with Complete approval:** the historical accidental
migration of database `Cleanora` remains a separate operational incident. This
approval does not authorize connecting to it, inspecting it, accepting its
state, rolling it back, resetting it, seeding it, migrating it, deleting it, or
performing any recovery action against it. `Cleanora` was not accessed during
administrative closure.

**Implementation repair authorized (historical):** 2026-08-07 by explicit
human-owner authorization (DEC-033 Cloudinary profile images + independent-
review remediations)

**Implementation authorized (historical):** 2026-08-07 — T001–T078 executed;
independent implementation review returned **`CHANGES REQUIRED`**

**Independent re-review (historical):** **`BLOCKED`** (2026-08-07). Focused
remediations T094–T100 validated.

**Later independent re-review (historical):** **`CHANGES REQUIRED`**.
Remediations **T101–T112** and final-loop **T113–T120** validated on
`cleanora_r1_p04_clean_proof`. Fresh independent final implementation re-review
returned **`PASS`** (2026-08-08).

**Activated for planning (historical):** 2026-08-07 by explicit human-owner
authorization

**Tasks generation authorized (historical):** 2026-08-07 for tasks generation
only

**Earlier activation (historical):** 2026-08-05 for specification preparation
only; subsequently paused while R1-P03A ran; specification and independent
re-review `PASS` remain authoritative

## Goal

Allow customers to manage identity-adjacent account data and customer-owned
text addresses without introducing map or provider-onboarding dependencies.

## Authorized scope at Complete

- R1-P04 recorded Complete; no phase remains In Progress.
- Phase 0/1 technical planning complete (`PASS`); final `/speckit.analyze`
  **`CLEAN`**.
- T001–T120 remain checked.
- Completion report:
  `specs/R1-P04-customer-profiles-preferences-text-addresses/completion-report.md`.

## Explicitly unauthorized by this Complete approval

- Commit, push, merge, deployment, or production actions
- Activation or implementation of the next roadmap phase
- Any connection or recovery action against database `Cleanora`
- Changing application code or tests to clear non-blocking MINOR notes

## Roadmap scope (delivered)

- Individual, company, and engineer customer profiles
- Profile image (Cloudinary / DEC-033), contact display, language and
  notification preferences
- Customer-owned text addresses
- Account-deactivation, deletion, and data-export request foundations

## Canonical dependencies and boundaries

- R1-P01 country configuration; R1-P02 identity/authentication; R1-P03
  permissions and audit; R1-P03A Complete (DEC-030 owner MVP)
- DEC-004 excludes geospatial dependencies from Release 1
- **DEC-030**: Customer self-service authorizes via trusted
  `AuthenticationPrincipal` facts, `SELF` ownership, and FR-028 category
  eligibility — without a `customer` role grant, `resource.self.read`/
  `resource.self.write`, or other role-derived R1-P04 customer permissions.
- **DEC-031 / DEC-032 / DEC-033** remain authoritative for privacy outcomes,
  preference PUT full replacement, and Cloudinary profile images
  (`MEDIA_STORAGE_ROOT` superseded).

## Phase transition

- R1-P03 remains Complete.
- R1-P03A remains Complete.
- R1-P04 is **Complete** as of `2026-08-08`.
- No other phase is In Progress.
- Next phase activation requires separate explicit human-owner authorization.

## Locked owner decisions (remain in force)

- No `customer` role provisioning; no automatic or manual customer role grant.
- No `resource.self.read`/`resource.self.write` or other role-derived customer
  permission.
- Customer self-service authorizes from trusted `AuthenticationPrincipal`
  facts, `SELF`, identity state, and category eligibility (FR-028).
- Processor and privileged operations remain separate from customer `SELF`.
- Privileged reassignment is `staff_admin` only (DEC-031).
- Privacy outcomes are closed to `REQUEST_FULFILLED` / `REQUEST_REJECTED`
  (DEC-031).
- Retention uses `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` with a bounded
  customers-owned hourly sweep (DEC-031).
- Preference PUT is full replacement: required `version` + complete matrix;
  `language` is `AR`/`EN`/`null`; omitted fields rejected (DEC-032).
- **Profile images:** Cloudinary via **DEC-033**; **`MEDIA_STORAGE_ROOT`
  superseded and removed**; Multer + Sharp; always-replace; signed URL delivery;
  async cleanup.
- No maps, coordinates, geocoding, zones, radius, or provider-onboarding.
- R1-P02 authentication contracts remain unchanged.
- Docker and cloud-specific work remain deferred (Cloudinary is an approved
  external media provider for R1-P04 profile images only).

## Historical pause evidence

The 2026-08-06 planning pause and pre-research gate record (waiting on R1-P03A
Complete) are **historical**. The R1-P03A Complete gate was satisfied on
`2026-08-07`. Independent specification review artifacts remain historical
PASS evidence and are not reopened.

## Completion gate (satisfied)

Fresh independent final implementation re-review **`PASS`** (2026-08-08).
Human-owner Complete approval recorded. Non-blocking MINOR follow-ups and the
separate `Cleanora` operational incident remain documented and unresolved as
follow-up / owner disposition items outside this phase Complete.
