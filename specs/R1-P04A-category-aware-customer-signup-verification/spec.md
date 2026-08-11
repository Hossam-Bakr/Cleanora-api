# Feature Specification: R1-P04A Category-Aware Customer Signup

**Created:** 2026-08-09  
**Aligned:** 2026-08-10 under DEC-035  
**Status:** Complete — owner approved 2026-08-10

## Objective

Require the minimum category-specific customer identity during signup so no
customer enters Cleanora without the matching name/profile. Preserve email OTP
as the only current activation channel for every supported category.

## User Story 1 — Register a named customer (P1)

An Individual supplies `fullName`; a Company supplies `companyName` and
`representativeFullName`; an Engineer supplies `fullName` and
`professionalTitle`. Phone, email, password, and category remain required.

Acceptance scenarios:

1. A valid customer signup atomically creates identity, credential, matching
   customer profile, and one email verification challenge.
2. Missing, blank, extra, or wrong-category profile fields fail validation
   before persistence.
3. Delivery failure leaves no identity, credential, profile, or challenge that
   appears usable.
4. Provider Owner retains email activation and creates no customer profile.
5. Worker self-signup remains prohibited.

## User Story 2 — Activate every category by email (P1)

Every supported password-based category verifies the authoritative email using
the existing bounded six-digit OTP flow.

Acceptance scenarios:

1. Individual, Company, Engineer, and Provider Owner signup responses return
   `channel: EMAIL` and a masked email destination.
2. Successful verification sets the category and `emailVerifiedAt` only.
3. `phoneVerifiedAt` remains null for password-based signup.
4. A mismatched, expired, replayed, or exhausted challenge changes no assurance.
5. `AUTH_ENABLED=true`, `EMAIL_AUTH_ENABLED=true`, and
   `SMS_AUTH_ENABLED=false` start without any SMS-provider configuration.
6. `SMS_AUTH_ENABLED=true` fails startup because SMS is deferred.

## User Story 3 — Complete Company regulatory details later (P2)

A verified Company owner may complete commercial-registration and
tax-registration numbers from the existing private profile endpoint. These
values are not signup requirements.

Acceptance scenarios:

1. New and existing Company profiles remain valid with both values null.
2. The verified owner may replace either value with a trimmed non-blank string
   up to 100 characters or null.
3. Pending, wrong-category, or unrelated callers are denied under existing
   profile authorization and audit rules.

## Functional Requirements

- **FR-001:** Signup and category enrollment MUST use strict discriminated
  request unions.
- **FR-002:** Individual MUST require `fullName`.
- **FR-003:** Company MUST require `companyName` and
  `representativeFullName`.
- **FR-004:** Engineer MUST require `fullName` and `professionalTitle`.
- **FR-005:** Profile text MUST be trimmed, non-blank, and at most 200
  characters; unknown/inapplicable fields MUST be rejected.
- **FR-006:** Customer identity, credential, profile, and initial challenge MUST
  have all-or-nothing observable creation semantics.
- **FR-007:** All supported current category activation MUST use email OTP.
- **FR-008:** Successful category verification MUST set email assurance and
  MUST NOT set phone assurance.
- **FR-009:** OTP binding, cooldown, expiry, attempts, rate limits, replay
  defense, generic failures, and secret redaction MUST remain intact.
- **FR-010:** Google Individual creation MUST create a non-blank Individual
  profile from a usable provider display name or fail atomically.
- **FR-011:** `SMS_AUTH_ENABLED` MUST default to false and MUST be rejected when
  true in the current phase.
- **FR-012:** No SMS provider code, provider variables, phone-verification route,
  phone CTA, email-grace deadline, or order restriction MAY be shipped in this
  phase.
- **FR-013:** Company profiles MUST add nullable private
  `commercialRegistrationNumber` and `taxRegistrationNumber` fields, omitted
  from signup and editable after activation.
- **FR-014:** The phase migration MUST add only those two nullable Company
  columns and MUST NOT invent regulatory values.
- **FR-015:** Existing authentication, role, profile, privacy, preference,
  address, and media behavior MUST remain compatible.

## Success Criteria

- **SC-001:** Every accepted Individual, Company, and Engineer signup has one
  matching non-blank profile.
- **SC-002:** All supported signup/enrollment variants return email challenges.
- **SC-003:** Category activation verifies email and leaves phone unverified.
- **SC-004:** Invalid and failed-delivery signups leave no partial customer.
- **SC-005:** Email-only Authentication configuration passes startup validation;
  enabling deferred SMS fails with a safe diagnostic.
- **SC-006:** Company regulatory fields begin null and accept only authorized,
  normalized updates.
- **SC-007:** Runtime Swagger, source OpenAPI, Postman, migration checks, focused
  tests, and full repository gates pass.

## Scope Boundary and Future Direction

The future intended journey is documented but not implemented: Individual will
eventually activate by phone and have 15 days to verify email before order
creation is restricted; Company and Engineer will activate by email and may
verify phone from the profile. Provider selection and all related code, schema,
API, UX, and tests require a later explicit phase.

No Orders module, frontend, provider onboarding, deployment, production
migration, commit, push, or next-phase activation is authorized here.
