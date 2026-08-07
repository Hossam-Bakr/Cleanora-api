# Implementation Plan: R1-P04 Customer Profiles, Preferences & Text Addresses

**Branch**: `R1-P04-customer-profiles-preferences-text-addresses` | **Date**: 2026-08-07 | **Spec**: [spec.md](./spec.md)

**Input**: Approved feature specification in `specs/R1-P04-customer-profiles-preferences-text-addresses/spec.md`

**Planning status**: **PAUSED** before Phase 0 research. R1-P03A (owner MVP per DEC-030) is the active prerequisite. R1-P04 is not active.

## Summary

R1-P04 adds customer-owned profiles, preferences, text addresses, and privacy-request foundations in the modular monolith.

Technical planning has **not** started Phase 0. Under owner **DEC-030**, the prior authorization-provisioning blocker (requiring customer-role grants before R1-P04 could plan) is **removed**. R1-P04 customer self-service authorizes via trusted `AuthenticationPrincipal` facts, `SELF` ownership, and FR-028 category eligibility — **without** a `customer` role grant, `resource.self.read`/`resource.self.write`, or other role-derived R1-P04 customer permissions. A historical `customer` user-role grant does not affect eligibility.

R1-P04 remains paused until R1-P03A is implemented, validated, and owner-approved Complete — for phase sequencing and staff-admin production readiness, not because customer permissions require a role-grant workflow from R1-P03A.

## Technical Context

**Language/Version**: Node.js 24+ with TypeScript 6

**Primary Dependencies**: Express 5, Zod 4, Prisma 7 with PostgreSQL

**Storage**: PostgreSQL through repository-local Prisma schema and phase-owned migrations (when authorized)

**Testing**: Vitest and Supertest; Release 1 must not depend on Docker or Testcontainers

**Target Platform**: Linux-hosted backend service

**Project Type**: Single deployable modular-monolith web service

**Performance Goals**: SC-008 workload unchanged when planning resumes

**Constraints**: R1-P04 paused; R1-P03A active prerequisite; R1-P02 authentication contracts unchanged; DEC-030 governs authorization relationship with R1-P03A

**Scale/Scope**: 48 functional requirements, 19 success criteria — planning artifacts not yet generated beyond this gate record

## Constitution Check

*GATE: Pre-research — PAUSED pending R1-P03A Complete*

### Historical note (2026-08-06)

An earlier pre-research check recorded BLOCKED status because the superseded R1-P03A design had not yet delivered staff administration and because the specification then required proof of customer permission provisioning without category-derived grants. That blocker category is **superseded by DEC-030**.

### Current pre-research posture (DEC-030)

| Check | Status | Notes |
|---|---|---|
| Specification review | PASS (historical) | Independent re-review PASS; product requirements unchanged |
| Authorization model | PASS (DEC-030) | Customer ops use AuthenticationPrincipal + SELF + category eligibility; no customer-role grant or role-derived R1-P04 customer permission prerequisite |
| Phase sequencing | PAUSED | R1-P03A owner MVP must Complete before R1-P04 Phase 0 |
| R1-P02 contract freeze | PASS | No R1-P04 work may change authentication contracts |
| Automatic role grants | PASS | Still prohibited; DEC-030 does not authorize category-derived grants |

When R1-P03A is Complete, rerun this Constitution Check and begin Phase 0 research.

## Prerequisite — R1-P03A (DEC-030 owner MVP)

R1-P03A delivers:

- Owner internal API for `staff_admin` provisioning
- Staff-admin non-customer role-grant command API

R1-P03A does **not** deliver customer-role provisioning for R1-P04. R1-P04 does not wait on customer grants.

## Project Structure

### Documentation (this feature)

```text
specs/R1-P04-customer-profiles-preferences-text-addresses/
├── plan.md              # This paused gate record
├── spec.md              # Complete specification
├── activation.md
├── checklists/requirements.md
├── review-resolution.md
├── research.md          # Not generated: Phase 0 not started
├── data-model.md        # Not generated
├── quickstart.md        # Not generated
├── contracts/           # Not generated
└── tasks.md             # Not authorized
```

## Complexity Tracking

No constitutional exception proposed. Planning resumes after R1-P03A Complete owner approval.
