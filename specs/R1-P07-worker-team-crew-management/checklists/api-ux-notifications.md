# API, UX & Notification Requirements Checklist: Worker, Team & Crew Management

**Purpose**: Validate design-contract completeness, user-impact communication, locale, and notification failure requirements
**Created**: 2026-08-22
**Feature**: [provider-workforce-api.openapi.yaml](../contracts/provider-workforce-api.openapi.yaml)
**Audience/Timing**: Product/API reviewer before task generation

## API Contract Completeness

- [x] CHK001 Are Provider Worker, Team, self-service, and invitation endpoint families all represented? [Completeness, OpenAPI §paths]
- [x] CHK002 Are profile/skills/avatar, lifecycle/access/Admin, Team/membership/Supervisor, history, and readiness surfaces covered? [Completeness, OpenAPI operation inventory]
- [x] CHK003 Are every covered mutation's `expectedVersion` and `idempotencyKey` requirements explicit? [Completeness, OpenAPI schemas, Spec §FR-076]
- [x] CHK004 Are stable validation/authentication/authorization/not-found/conflict/dependency failure families documented without internal detail? [Completeness, Module Public Contracts §Failure contract]
- [x] CHK005 Are role-specific DTO/privacy and no-store requirements explicit rather than relying on a raw generic Worker model? [Clarity, OpenAPI PrivateSuccess, Authorization Matrix]

## UX and Impact Clarity

- [x] CHK006 Is the exact warning/confirmation UX for Owner/Admin last-cleaner and `workersReady` impact defined? [Completeness, Spec §FR-050, FR-074]
- [x] CHK007 Is the Supervisor final-cleaner response a safe conflict that directs escalation without exposing an unauthorized confirmation control? [Clarity, Spec §FR-051]
- [x] CHK008 Are cancellation and stale/competing outcomes defined as zero-change rather than silent partial success? [Consistency, Spec §FR-051, FR-078]
- [x] CHK009 Are new-user and existing-user invitation journeys distinguished, including password ownership and operational-phone review? [Coverage, Spec §US2, FR-012, FR-017]
- [x] CHK010 Are SC-001/SC-002 journey timing criteria measurable while explicitly excluding email-delivery time where approved? [Measurability, Spec §SC-001–SC-002]

## Locale and Notification Requirements

- [x] CHK011 Is Owner selection of `AR` or `EN` required for every exact invitation version, including resend? [Completeness, Spec §FR-011, FR-084]
- [x] CHK012 Is post-acceptance locale precedence unambiguous: valid preference, accepted invitation locale, final `AR`? [Clarity, Spec §FR-084]
- [x] CHK013 Is locale part of immutable/idempotent notification-intent meaning? [Consistency, Spec §FR-085]
- [x] CHK014 Are invitation links/proofs absent from outbox persistence while still regenerable at dispatch? [Security, Research Decision 4/6]
- [x] CHK015 Are delivery retry/terminal failure effects limited to delivery state and forbidden from changing business truth? [Recovery, Spec §FR-086, Transaction Boundaries]

## Contract Boundaries and Traceability

- [x] CHK016 Are Authentication onboarding/recent-auth/role contracts and Media avatar contracts documented without exposing private adapters? [Traceability, Module Public Contracts]
- [x] CHK017 Are Booking assignment/snapshot, public Worker surfaces, frontend, payroll, payout, and R1-P08 catalog explicitly excluded? [Boundary, Spec §Out of Scope]
- [x] CHK018 Does every OpenAPI operation carry FR traceability metadata and avoid claiming runtime implementation? [Traceability, OpenAPI `x-requirement-ids`/info]
- [x] CHK019 Are OpenAPI/runtime and Postman parity requirements defined as future implementation evidence? [Completeness, Test Strategy §Contract and documentation evidence]
- [x] CHK020 Are full phone, proof, password/OTP, cookie, storage-key, audit-internal, and raw Prisma fields prohibited from public/generic responses? [Security, Spec §FR-028, Module Public Contracts]

## Notes

- Result: 20/20 requirements-quality checks satisfied.
- OpenAPI is a design contract until implementation mounts matching runtime paths.
