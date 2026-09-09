# Feature Specification: R1-P10 — Availability, Capacity & Textual Coverage

**Feature Branch**: `codex/r1-p10-availability-capacity-textual-coverage`
**Created**: 2026-09-07
**Status**: Complete — explicit human-owner approval recorded under DEC-061
**Input**: Owner request of 2026-09-07 authorizes preparation followed by Cursor implementation after material decisions and preparation gates, Phase 10 testing, documentation, review and repairs within five hours. Publication requires a separate exact `commit and push` instruction.

## Clarifications

### Session 2026-09-07

- Q: Which locality administration and coverage granularity? → A: Staff-managed localized hierarchy; Provider selects cities or districts in its own country; city coverage includes active districts; deactivate rather than delete; inactive ancestry stops matching (DEC-056).

- Q: How does temporary pause operate? → A: One immediate pause, optional automatic expiry, otherwise explicit Owner/Admin resume; overlapping evaluation is unavailable with zero capacity; lifecycle unaffected (DEC-057).

- Q: Who may manage Provider Phase 10 settings, and does suspension make them read-only? → A: Active Owners and enabled Provider Admins may manage their exact approved Provider in any operational state; suspension blocks availability but permits configuration repair. Workers and Team Supervisors gain no new authority (DEC-058).

- Q: How does Phase 10 expose coverage and availability evaluation? → A: Providers exposes narrow internal candidate-filter and per-Provider evaluation contracts; HTTP is protected management only. Customer and anonymous availability remain in later phases (DEC-059).

- Q: Do Phase 10 readiness gates represent completed configuration or momentary availability? → A: They represent completed valid configuration; pause, suspension and request-time feasibility affect runtime evaluation without erasing readiness (DEC-060).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Maintain textual service areas (Priority: P1)

Authorized administrators maintain a country/city/district hierarchy. Authorized Provider operators select the textual areas their Provider serves.

**Why this priority**: Coverage determines whether a Provider serves a requested textual location.
**Independent Test**: Configure a hierarchy and Provider coverage; evaluate matching and nonmatching locations without maps or Browse.
**Acceptance Scenarios**:
1. Given active valid areas, when authorized coverage is saved, then a supplied location can be evaluated against that Provider's coverage.
2. Given a district under another city or country, when mismatched ancestry is supplied, then the write is rejected without partial changes.
3. Given another Provider's settings, when an unauthorized actor attempts protected access or mutation, then access is denied without private disclosure.

### User Story 2 - Maintain operating schedules (Priority: P1)

Authorized Provider operators manage weekly hours, holidays, dated exceptions and temporary pauses and evaluate requested operating intervals.

**Why this priority**: Stated operating hours need deterministic meaning before later consumers depend on them.
**Independent Test**: Evaluate ordinary, closed, exception and paused intervals under approved calendar rules.
**Acceptance Scenarios**:
1. Given a weekly schedule, when an interval is evaluated, then its complete duration is assessed using approved time and boundary rules.
2. Given Monday 22:00–Tuesday 02:00 and a Tuesday holiday, when the interval is evaluated, then only the Monday portion remains available; the Tuesday civil-date exception removes the carryover.
3. Given a temporary pause, when an interval intersects it, then the approved pause effect is reported separately from application approval and suspension.

### User Story 3 - Evaluate workforce and team capacity (Priority: P1)

Authorized Provider operators maintain Worker schedules/exceptions and capacity so consumers can assess feasible supply without creating a Booking.

**Why this priority**: Provider hours alone do not prove workforce availability.
**Independent Test**: Evaluate active/inactive Workers and Teams, schedule intersections and capacity boundaries using the approved unit.
**Acceptance Scenarios**:
1. Given Provider and Worker schedules, when Worker availability is evaluated, then neither Provider closure nor Worker unavailability can be bypassed.
2. Given inactive or foreign-Provider workforce, when capacity is evaluated, then that workforce cannot contribute.
3. Given three fully available Teams and a configured limit of two, when capacity is evaluated, then capacity is two; demand for three reports insufficient capacity.

### User Story 4 - Consume consistent operational facts (Priority: P2)

Internal consumers obtain owned coverage, availability and capacity facts with explicit reasons without publishing Providers or reserving resources.

**Why this priority**: Later phases must reuse these rules through explicit contracts.
**Independent Test**: Query the same Provider/location/interval and verify expected facts under missing setup and concurrent edits.
**Acceptance Scenarios**:
1. Given missing required setup, when facts are requested, then absence is explicit and cannot masquerade as availability.
2. Given accepted configuration changes, when a subsequent evaluation occurs, then current truth is reflected without rewriting historical approval facts.

### Edge Cases

- Adjacent, overlapping, zero-length, invalid and overnight intervals; daylight-saving gaps and repeated local times.
- Holidays, exceptional openings, missing schedules and exceptions spanning midnight.
- Worker hours outside Provider hours; inactive Teams/Workers; Escort and non-cleaning membership; membership changes.
- Pause boundaries, early resume, missing end time and suspension interactions.
- Inactive or mismatched areas, duplicate coverage, ancestor/descendant selection and area deactivation.
- Stale versions, simultaneous edits, repeated commands and foreign Provider identifiers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Staff administer localized countries/cities/districts with stable identities, active status and validated ancestry, reusing existing country truth. Localities are deactivated rather than deleted; Providers cannot create place names (DEC-056).
- **FR-002**: Providers select whole cities or individual districts within their own country. Whole-city coverage includes all its currently active districts, including newly added ones. Inactive country/city/district ancestry cannot match. Evaluate supplied textual locations without coordinates or radius (DEC-056).
- **FR-003**: Maintain Provider weekly hours, holidays and dated exceptions.
- **FR-004**: Maintain Provider-owned Worker weekly hours and dated exceptions.
- **FR-005**: Resolve Provider and Worker schedules using the Staff-managed IANA time zone of their country; Egypt uses `Africa/Cairo`. All Providers and Workers inherit their country zone. Release 1 assumes one operating time zone per country (DEC-053).
- **FR-006**: Use start-inclusive/end-exclusive periods; adjacent periods do not conflict, while overlapping periods in the same schedule are rejected. An explicit `endsNextDay` flag supports positive overnight shifts no longer than 24 hours. Split shifts at local midnight before evaluating each civil date. A dated exception replaces all weekly hours on that date; an empty exception closes that date. Worker availability is intersected with Provider availability (DEC-054).
- **FR-007**: Count one complete available Team as one simultaneous-job capacity unit. A Team counts only if active, with at least one valid cleaner, and every current member active and available for the complete interval. Escorts contribute no additional units but must be available. Capacity is min(configured simultaneous-Team limit, available Team count). Unteamed Workers add no capacity. This is potential supply, not unbooked or reserved supply (DEC-055).
- **FR-008**: An Owner/Admin can start one immediate Provider pause, optionally ending at a specified future instant; otherwise it remains effective until resumed. Any evaluation interval overlapping an effective pause is unavailable with zero capacity. Early resume and automatic expiry do not alter approval, suspension or go-live. No future pause calendar or Booking mutation is included (DEC-057).
- **FR-009**: Detect schedule conflicts and insufficient capacity with deterministic reasons; invalid writes are atomic rejections.
- **FR-010**: Active Owners and enabled Provider Admins may read and manage coverage, Provider/Worker schedules and exceptions, capacity, and pause for their exact approved Provider in `INACTIVE`, `LIVE`, or `SUSPENDED` operational state. Suspension makes evaluations unavailable but does not prevent configuration repair. Workers and Team Supervisors gain no new management authority. Staff locality/time-zone administration uses separate Configuration permissions and cannot mutate Provider settings through those permissions (DEC-058).
- **FR-011**: Privileged mutations preserve safe audit evidence and apply version/retry protection against stale, concurrent and repeated writes.
- **FR-012**: Providers exposes narrow internal public contracts to (a) find candidate Provider identifiers for an active textual area and (b) evaluate one Provider for a textual location, UTC interval and required complete-Team units. Results include the country IANA zone, coverage/availability/capacity facts, available units, stable blocker codes and relevant configuration versions. Cross-module consumers cannot access private persistence. No Phase 10 customer or anonymous evaluation HTTP is exposed (DEC-059).
- **FR-013**: `coverageReady` requires at least one effective active coverage selection. `availabilityReady` requires at least one valid Provider weekly period. `capacityReady` requires a positive simultaneous-Team limit and at least one active structurally valid complete Team whose current members share nonzero recurring availability with the Provider. One incomplete Team does not block another valid Team. Temporary pause, suspension and requested-interval feasibility affect runtime evaluation without erasing configuration readiness. Final eligibility, operational go-live and anonymous Browse remain deferred (DEC-060).
- **FR-014**: Protected projections and errors do not disclose private Worker contacts or other Providers' operational settings.
- **FR-015**: Document all delivered endpoints, constraints, actor access, examples, errors and approved calendar semantics using established Swagger and Postman conventions.
- **FR-016**: Incremental persistence changes preserve earlier-phase data and contracts; applied migrations remain immutable.

### Key Entities *(include if feature involves data)*

- **Country / City / District**: Existing country identity and textual descendants with validated ancestry and active state.
- **Provider Coverage Area**: Provider-selected textual operating area.
- **Provider Schedule / Exception**: Weekly periods and dated departures, including holidays.
- **Worker Schedule / Exception**: Provider-owned Worker periods and dated departures.
- **Provider Capacity Rule**: Supply constraints expressed in the approved unit.
- **Temporary Provider Pause**: Temporary unavailability separate from lifecycle suspension.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every approved hierarchy and coverage acceptance case produces its expected match or rejection without geographic data.
- **SC-002**: All approved boundary, exception, time-zone and schedule-conflict cases have deterministic expected results.
- **SC-003**: All approved capacity cases account for current owned supply and enforce the approved limit.
- **SC-004**: Unauthorized and cross-Provider mutation cases leave state unchanged and disclose no protected data.
- **SC-005**: Requirements map to completed tasks and independently verified evidence; no unresolved blocking or major finding remains at technical readiness.
- **SC-006**: Phase 10 coverage reaches 80% statements, 75% branches, 80% functions and 80% lines across all Phase 10 production behavior, including unexecuted files and changed integration behavior.
- **SC-007**: Every delivered endpoint has validated Swagger and Postman documentation matching implemented behavior.
- **SC-008**: Fresh installation and populated earlier-phase upgrade pass on an authorized disposable target with data/contract preservation evidence.

## Assumptions

- Authority: current.md, roadmap.md R1-P10, DEC-052 and inherited Provider/workforce decisions, vision.md sections 3 and 5, and activation.md.
- Existing ownership in docs/architecture/entity-ownership.md assigns cities/districts to Configuration and coverage, Provider/Worker schedules/exceptions and capacity to Providers. No new scheduling module is assumed.
- Reuse existing authentication, Provider ownership, Worker/Team identities, audit and public-module contracts.
- DEC-053 through DEC-060 resolve the material Phase 10 product semantics. Remaining technical details must follow these decisions and established repository patterns without broadening product behavior.
- Booking, reservations, assignment workflows, Browse/Eligibility engines, coordinates/radius, frontend, wallets, Docker and cloud are excluded.
- Tests are Phase 10 only. Full-project regression and coverage are not authorized; any broader publication gate remains explicit and outstanding.
- Time and quota limits do not waive correctness, evidence or separate owner approval.





