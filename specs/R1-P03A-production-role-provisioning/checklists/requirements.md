# Specification Quality Checklist: R1-P03A — Production Role Provisioning (Owner MVP)

**Purpose**: Validate DEC-030 simplified specification completeness

**Created**: 2026-08-06

**Revised**: 2026-08-07

**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details beyond approved DEC-030 surfaces
- [x] Focused on owner and staff-admin operational security value
- [x] Written for junior-readable product and security review
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic where required
- [x] Acceptance scenarios cover owner and staff-admin flows
- [x] Edge cases identified for gates, secrets, and customer-role rejection
- [x] Scope clearly bounded; superseded design explicitly excluded
- [x] Dependencies and DEC-030 assumption recorded

## Feature Readiness

- [x] Functional requirements map to acceptance scenarios
- [x] User scenarios cover primary flows (owner provision, staff-admin commands, boundaries)
- [x] Measurable outcomes SC-001–SC-010 defined
- [x] Placeholder-only secret policy stated (FR-021)

## Notes

- **DEC-030** supersedes the prior complex bootstrap, closure-table, and
  customer-role provisioning specification. Prior independent PASS reviews against
  the superseded design are **historical only**.
- Removed from normative scope: Ed25519 envelopes, CLI bootstrap,
  `StaffAdminBootstrapClosure`, `StaffAdminBootstrapAuthorizationUse`, command
  fingerprints, six-class bootstrap evidence, permanent closure semantics, and
  customer-role eligibility inside role management.
- Migration hygiene: restore corrupted superseded migration SQL on disposable test
  DBs; forward drop migration for obsolete tables; simplified MVP requires no new
  models.
- R1-P04 does not depend on customer-role grants from R1-P03A per DEC-030.
- Tasks prepared in [tasks.md](../tasks.md); all unchecked pending owner
  implementation authorization.
- Prior checklist entries referencing FR-019 six-class matrix and DEC-029
  customer eligibility are obsolete under DEC-030.
