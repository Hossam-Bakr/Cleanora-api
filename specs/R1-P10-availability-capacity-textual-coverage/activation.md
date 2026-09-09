# R1-P10 Activation — Availability, Capacity & Textual Coverage

Date: 2026-09-07
Status: Active — activation only; ready for specification preparation.
Authority: DEC-052 and the owner's explicit conditional instruction to activate
Phase 10 after verifying readiness.

## Readiness

R1-P09 is Complete; its reviewed commit 47fdf53 is merged into origin/main at
19d4b00 through PR #9, with no merge-tree change. Technical gates and ownership
handoff are recorded in ../R1-P09-provider-services-pricing-historical-snapshots/completion-report.md.
Canonical vision, decisions, open questions and roadmap are repository-local.
No current canonical open question blocks activation of this roadmap section.

## Approved roadmap scope

- Countries, cities and districts; Provider textual coverage.
- Provider weekly schedules, holidays and exceptions.
- Worker schedules and exceptions.
- Team capacity and temporary Provider pause.
- Schedule conflict rules.
- No coordinates or radius.

The roadmap identifies cities, districts, provider_coverage_areas,
provider_schedules, provider_schedule_exceptions, worker_schedules,
worker_schedule_exceptions and provider_capacity_rules. This inventory is
planning input, not authorization to create schema or migrations now.

## Roadmap acceptance outcomes

Provider availability can be evaluated; textual areas can filter future Browse
candidates; schedule and capacity conflicts can be detected; the model can later
support geographic coverage without replacement.

## Preparation decisions still to resolve

Specify the authoritative time zone, interval/boundary rules, overnight and
exception precedence, capacity units and calculation, pause behavior, textual
area hierarchy/administration, exact authorization, module ownership and public
read contracts. These are preparation topics, not approved product choices.

## Execution boundary and next step

R1-P10 is the sole active phase in docs/product/current.md. No specification,
plan, tasks, API endpoints, application code, schema, migration, seed, database
operation or new feature branch is created by activation. Docker/cloud work,
coordinates/radius, public eligibility and Booking implementation remain outside
this activation.

Next: prepare and clarify the R1-P10 specification from the roadmap and inherited
public contracts, then plan and generate tasks under the authorized workflow.
The Spec Kit feature pointer remains on the completed R1-P09 artifact until the
R1-P10 specify workflow initializes the new feature; it is not an active-phase
status authority. No R1-P10 Companion progress is fabricated.

The local checkout still has the reviewed Phase 9 tree plus preserved local
extras. origin/main was fetched and verified; activation does not switch or
remove local branches, stage, commit or push.
