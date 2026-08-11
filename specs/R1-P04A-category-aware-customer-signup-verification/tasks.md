# Tasks: R1-P04A Category-Aware Customer Signup

## Authority and Design

- [x] T001 Record DEC-034 signup/profile requirements and DEC-035 email-only amendment
- [x] T002 Align spec, plan, research, data model, contract, and quickstart
- [x] T003 Keep R1-P04A as the sole active phase

## Category-Aware Signup

- [x] T004 Add strict category-discriminated signup/enrollment schemas
- [x] T005 Require Individual full name, Company/representative names, and Engineer name/title
- [x] T006 Add the Customers-owned signup profile writer
- [x] T007 Create/remove matching profiles inside Authentication transactions
- [x] T008 Require a usable Google display name for new Individual profiles
- [x] T009 Add signup, enrollment, concurrency, rollback, and Google regression tests

## Email-Only Verification

- [x] T010 Keep category and recovery targets email-only
- [x] T011 Ensure successful category activation sets email assurance only
- [x] T012 Default `SMS_AUTH_ENABLED=false` and reject true safely
- [x] T013 Remove Twilio/SMS adapters, provider variables, phone-verification routes, and grace/order runtime code
- [x] T014 Convert all affected unit/integration fixtures to email OTP

## Company Regulatory Profile

- [x] T015 Add nullable Company commercial/tax fields in Prisma and the phase migration
- [x] T016 Add normalized null-or-nonblank profile validation and persistence
- [x] T017 Add owner authorization, null initial state, and update tests

## Contracts and Validation

- [x] T018 Update runtime Swagger and source OpenAPI for strict email-only signup
- [x] T019 Update generated Postman variants and environments
- [x] T020 Update environment and human API documentation
- [x] T021 Run focused unit and integration tests
- [x] T022 Run Prisma and clean-migration validation
- [x] T023 Run full quality/coverage gates and safe startup validation
- [x] T024 Complete the R1-P04A readiness audit for owner approval

## Dependencies

Validation is sequential for database-backed suites. Commit/push and R1-P05
activation remain owner-controlled after completion evidence and approval.
