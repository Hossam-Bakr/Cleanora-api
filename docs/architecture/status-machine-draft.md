# Status-Machine Draft

**Phase**: R1-P00 — Product & Database Architecture  
**Status**: Provisional design approach (documentation only)  
**Date**: 2026-07-24  
**Canonical standalone boundary**: [`docs/product/standalone-project-boundary.md`](../product/standalone-project-boundary.md)

## Purpose

Define a reusable, auditable transition format so later phases can implement state changes safely **without freezing OQ-010**.

## Critical open question

| ID | Topic | Owner | Rule for this draft |
|---|---|---|---|
| **OQ-010** | Final booking/order enum names and emergency modeling | **R1-P13** | All booking/order/emergency labels below are **provisional conceptual labels**. Do not treat them as schema contracts. Emergency may be a state **or** a parallel concern — **undecided**. |

## Standalone boundary validation

This draft is repository-local. See [`docs/product/standalone-project-boundary.md`](../product/standalone-project-boundary.md). Do not duplicate that document here.

## Acceptance criteria (US4 / FR-057–FR-061 / SC-012)

- [x] Seven required fields on every sample
- [x] Backend authority, ownership checks, stale-state rejection, idempotent side effects
- [x] Categories: normal, cancellation, failure, privileged override, completion, emergency-related
- [x] Rejected ≠ successful; sensitive failures auditable
- [x] OQ-010 visibly unresolved → R1-P13

---

## Transition record format (FR-057–FR-058, FR-061)

Every transition record MUST document:

1. **Actor** — who initiates (role/system)
2. **From state** — provisional label
3. **To state** — provisional label
4. **Preconditions** — including ownership/permission/state checks
5. **Side effects** — including idempotency expectations
6. **Audit requirement** — what must be recorded
7. **Failure / rejection outcome** — how rejection differs from success

Plus cross-cutting rules:

- **Backend authority**: client cannot force illegal transitions.
- **Permission & ownership checks**: deny by default.
- **Stale-state / concurrency**: reject if expected `from` no longer matches; no partial side effects.
- **Idempotent side effects**: replayable financial/notification effects must be safe.
- **Transition owner**: one application-service owner per transition.

### Rejection vs success

| Outcome | Meaning |
|---|---|
| Success | State changed; required side effects completed or durably queued per design |
| Rejection | State unchanged; observable error; sensitive rejections still auditable when required |

---

## Sample transitions (provisional labels only)

> Labels are illustrative for design review. **Not** final enums (OQ-010 → R1-P13).

### A. Provider lifecycle (normal)

| Field | Value |
|---|---|
| Actor | Staff verifier / system |
| From | `provider_pending_verification` |
| To | `provider_active` |
| Preconditions | Required documents present per configured types (OQ-007: checklist not frozen); actor permitted |
| Side effects | Emit verification history; notify provider (idempotent by verification case id) |
| Audit | Actor, reason, before/after, timestamp |
| Failure/rejection | Missing docs or unauthorized → no status change; auditable denial |
| Owner | `providers` verification use case |

### B. Booking progression (normal) — provisional

| Field | Value |
|---|---|
| Actor | Customer / system after deposit rules |
| From | `booking_draft` |
| To | `booking_awaiting_deposit` |
| Preconditions | Server price/deposit calculated; snapshots captured; idempotency key unique |
| Side effects | Persist snapshots; create deposit requirement record linkage |
| Audit | Actor, booking id, price inputs/results references |
| Failure/rejection | Validation failure → no booking row activation |
| Owner | `bookings` |

### C. Booking → order activation (normal) — provisional

| Field | Value |
|---|---|
| Actor | System after confirmation invariant |
| From | `booking_confirmed` (provisional) |
| To | Order `order_pending_fulfillment` (provisional) |
| Preconditions | Confirmation/activation invariant satisfied (FR-024); exactly one order linkage |
| Side effects | Create/activate order; preserve booking source history |
| Audit | Booking id, order id, actor/system, timestamps |
| Failure/rejection | Invariant fail → no order; booking unchanged |
| Owner | coordinating `bookings`/`orders` application service (document owner in R1-P13/R1-P18) |

### D. Completion (completion)

| Field | Value |
|---|---|
| Actor | Customer completing with code / system |
| From | `order_in_progress` |
| To | `order_completed` |
| Preconditions | Valid completion code attempt; ownership checks |
| Side effects | Record completion evidence; trigger post-completion hooks idempotently |
| Audit | Attempts, success, actor, before/after |
| Failure/rejection | Invalid code → state unchanged; attempt recorded |
| Owner | `orders` |

### E. Cancellation (cancellation) — OQ-001 contained

| Field | Value |
|---|---|
| Actor | Customer / provider / staff |
| From | cancellable provisional booking/order state |
| To | `cancelled` (provisional) |
| Preconditions | Actor permitted; state cancellable |
| Side effects | Write cancellation event; **do not calculate unapproved fees** (OQ-001) |
| Audit | Actor, reason code, before/after |
| Failure/rejection | Not cancellable / unauthorized → unchanged |
| Owner | `bookings` or `orders` per lifecycle stage |

### F. Failure path (failure)

| Field | Value |
|---|---|
| Actor | System |
| From | active fulfillment provisional state |
| To | `failed` (provisional) |
| Preconditions | Detected unrecoverable execution failure |
| Side effects | Failure event; notify; no silent money mutation |
| Audit | Required |
| Failure/rejection | N/A (this is the failure transition); nested errors must not mark success |
| Owner | `orders` |

### G. Privileged override

| Field | Value |
|---|---|
| Actor | Privileged staff with permission |
| From | any documented state |
| To | forced target provisional state |
| Preconditions | Permission, **reason required**, target exists |
| Side effects | Apply forced transition; suppress illegal client paths |
| Audit | **Mandatory**: permission, reason, before/after, actor, timestamp |
| Failure/rejection | Missing reason/permission → no change; auditable denial |
| Owner | `admin` coordinating with owning domain service |

### H. Emergency-related (provisional — OQ-010)

| Field | Value |
|---|---|
| Actor | Customer / worker / system |
| From | active order provisional state **or** parallel emergency flag unset |
| To | emergency signaled **(state or parallel concern — undecided)** |
| Preconditions | Authenticated actor; order context |
| Side effects | Create emergency incident/dossier linkage; notify operations |
| Audit | Mandatory |
| Failure/rejection | Unauthorized → no incident |
| Owner | `orders` emergency use case |
| **OQ-010 note** | Final representation deferred to **R1-P13** transition matrix |

---

## Category coverage checklist

| Category | Sample |
|---|---|
| Normal | A, B, C |
| Completion | D |
| Cancellation | E |
| Failure | F |
| Privileged override | G |
| Emergency-related | H |

## Implementation note for later phases

R1-P13 owns freezing booking/order enums and emergency modeling before those migrations. Until then, keep labels provisional in docs and code comments.
