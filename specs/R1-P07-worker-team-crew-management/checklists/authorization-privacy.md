# Authorization & Privacy Requirements Checklist: Worker, Team & Crew Management

**Purpose**: Validate completeness, clarity, consistency, and measurability of authorization and sensitive-data requirements
**Created**: 2026-08-22
**Feature**: [spec.md](../spec.md)
**Audience/Timing**: Author and reviewer before task generation

## Requirement Completeness

- [x] CHK001 Are exact-Provider Owner, explicit Admin, primary-Supervisor, Worker-self, Customer, and cross-Provider actors defined for every protected surface? [Completeness, Spec §FR-033–FR-041, Authorization Matrix]
- [x] CHK002 Are Supervisor read and write limits exhaustive, including the prohibited operations and absence of operational-notes fields? [Completeness, Spec §FR-037, DEC-039]
- [x] CHK003 Are full operational-phone recipients and all forbidden generic/public surfaces explicitly enumerated? [Completeness, Spec §FR-025–FR-028]
- [x] CHK004 Are high-risk commands and the 10-minute recent-authentication requirement identified without applying step-up to routine edits? [Completeness, Spec §FR-040–FR-041]
- [x] CHK005 Are invitation proof, password, OTP, cookie, credential, storage-key, and phone redaction rules defined across responses, logs, history, audit, errors, and outbox? [Completeness, Spec §FR-028, FR-080, FR-085, FR-087]

## Requirement Clarity

- [x] CHK006 Is “explicit Provider Admin” tied only to active `provider_members.ADMIN` rather than a Worker field or global role? [Clarity, Spec §FR-032–FR-035]
- [x] CHK007 Is “current primary Supervisor” objectively defined by current assignment, membership, Team, Worker status, and capability at read time? [Clarity, Spec §FR-026, FR-064–FR-066]
- [x] CHK008 Is the difference between Worker self DTO, Supervisor current-member summary, and Owner/Admin private DTO documented? [Clarity, Authorization Matrix §Management operations]
- [x] CHK009 Is proof binding specific to actor, session, purpose, Provider, Worker, request, age, and one-use consumption? [Clarity, Plan §Security and Privacy, Module Public Contracts]
- [x] CHK010 Is denied cross-Provider behavior defined without leaking private resource existence? [Clarity, Spec §FR-006, FR-088]

## Consistency and Scenario Coverage

- [x] CHK011 Are Owner-only access/Admin/removal operations consistent between user stories, FRs, HTTP contracts, and authorization matrix? [Consistency, Spec §US3/US6, FR-035, OpenAPI]
- [x] CHK012 Are Supervisor phone rights consistent with immediate scope loss after assignment or membership invalidation? [Consistency, Spec §FR-025–FR-026, Authorization Matrix]
- [x] CHK013 Are Worker/Admin dual relationships kept independent across lifecycle and role reconciliation requirements? [Consistency, Spec §FR-034, FR-039]
- [x] CHK014 Are anonymous/restricted/authenticated invitation principals and their allowed actions distinguished? [Coverage, OpenAPI §Worker Invitations, Module Public Contracts]
- [x] CHK015 Are allowed, denied, stale-proof, wrong-purpose, and dependency-failure authorization scenarios documented? [Coverage, Spec §FR-040, FR-078, FR-087]

## Measurability and Traceability

- [x] CHK016 Can unauthorized access be measured as 100% denial with no private disclosure? [Measurability, Spec §SC-005–SC-006]
- [x] CHK017 Can sensitive-output safety be evaluated across every named evidence/output class? [Measurability, Spec §SC-012]
- [x] CHK018 Can high-risk evidence be evaluated for actor, proof, reason/note, exact version, timestamp, and safe facts? [Measurability, Spec §SC-013]
- [x] CHK019 Does every authorization rule trace to an FR/SC, DEC-038/DEC-039, or an explicit design contract rather than an inferred role? [Traceability, Authorization Matrix]
- [x] CHK020 Are Booking-safe/public Providers contracts explicitly contact-free and prevented from changing `eligibleForPublicBrowse`? [Boundary, Plan §Public HTTP Contract Direction, Module Public Contracts]

## Notes

- Result: 20/20 requirements-quality checks satisfied.
- Full phone is purpose/scope restricted, not a generic masked colleague field.
- No material authorization or privacy ambiguity remains before tasks.
