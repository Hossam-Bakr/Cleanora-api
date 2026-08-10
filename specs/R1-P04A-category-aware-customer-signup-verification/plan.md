# Implementation Plan: R1-P04A Category-Aware Customer Signup

**Date:** 2026-08-10  
**Decision authority:** DEC-034 signup/profile requirements as amended by
DEC-035 email-only activation

## Summary

Extend Authentication signup/enrollment inputs and transactions so Customers
creates the matching category profile atomically. Keep the existing email OTP
delivery for every category. Add only nullable Company regulatory columns. SMS
and the future grace/order design remain outside implementation.

## Ownership

- Authentication owns identity, credential, category challenge, verification,
  session, delivery, and transaction control.
- Customers owns profile validation/persistence and exposes the narrow
  `CustomerSignupProfileWriter` transaction participant.
- Authentication opens the transaction and calls the Customers writer with the
  same Prisma transaction; it does not import Customers repositories.

## Data Change

Migration: `r1_p04a_category_aware_customer_signup_verification`

- Add nullable `company_profiles.commercial_registration_number VARCHAR(100)`.
- Add nullable `company_profiles.tax_registration_number VARCHAR(100)`.
- No user, OTP enum, phone-assurance, or grace-deadline change.
- No backfill and no edit to an applied migration.

## Runtime Configuration

- `AUTH_ENABLED=true` requires the existing complete email and secret groups.
- `SMS_AUTH_ENABLED=false` is the only accepted current value.
- `SMS_AUTH_ENABLED=true` fails startup with a safe diagnostic.
- Runtime composition contains no SMS provider import or adapter.

## API and UX

- Signup/enrollment bodies are category-discriminated and strict.
- Every accepted challenge reports `channel: EMAIL` and masked email.
- Safe user continues to expose the existing `emailVerified` and
  `phoneVerified` booleans; password signup leaves phone false.
- No current phone-verification or grace-period CTA/endpoint is published.

## Verification Plan

1. Unit: env guard, schemas, email target policy, migration SQL, Swagger, and
   Postman examples.
2. Integration: category profiles, email activation assurances, rollback,
   enrollment, Google name, Company regulatory fields, and regressions.
3. Gates: Prisma generate/validate, migration proof, typecheck, lint, unit,
   integration, coverage, OpenAPI, Postman, docs, build, audit, and diff check.
4. Startup: prove `.env` passes configuration with SMS absent/false; database
   connectivity is tested only through the approved isolated test target.

## Constitution Check

PASS by design: one active phase, standalone repository, explicit module seam,
one forward-only migration, no future provider implementation, server-derived
verification targets, and human-controlled Git/deployment actions.
