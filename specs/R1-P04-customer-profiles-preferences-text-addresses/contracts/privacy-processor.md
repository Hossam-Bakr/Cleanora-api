# Privacy Processor Contract — R1-P04

## Purpose

Explicit `customers`-owned application contract for later authorized privacy
processors. R1-P04 retains request-record and lifecycle ownership. Processors
orchestrate only through this contract and never access customers Prisma
repositories directly.

## Actor

Trusted processor identity **and** composition-only capability constant/type:

`privacy.requests.process`

Rules:

- Server-created capability; never accepted from a client field
- Not seeded into customer or staff roles in R1-P04
- No production processor adapter and no public processor HTTP endpoint
- Tests construct trusted vs forged processor contexts through composition
- Missing or forged capability → fail closed; no state change

**Must not** require customer `SELF` or customer identity/category eligibility.
Customer `user_id` on the request remains the request owner.

## Operations

### `claimPrivacyRequest({ requestId, processorId, capability })`

- Requires `capability === privacy.requests.process`
- Legal source: `PENDING` only
- Effect: exclusive atomic transition to `PROCESSING`; set `processor_id` and
  `processing_at` together
- Repeat by same claimant: idempotent return of current request
- Competing claimant: stable conflict; no metadata change

### `resolvePrivacyRequest({ requestId, processorId, capability, status, outcomeCode })`

- Requires `capability === privacy.requests.process`
- Legal source: `PROCESSING` and `processorId` equals recorded claimant
- Closed DEC-031 outcome legality only:

| `status` | Required `outcomeCode` |
|---|---|
| `COMPLETED` | `REQUEST_FULFILLED` |
| `REJECTED` | `REQUEST_REJECTED` |

- Every other status/code combination is rejected atomically with no change
- On success: set terminal status, `terminal_at`, resolving processor id,
  `outcome_code`, and `purge_after = terminal_at + PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS`

## Non-operations (forbidden in R1-P04)

- Changing account status / sessions
- Deleting or anonymizing customer business data
- Generating or attaching export archives
- Free-form rationale or any outcome code outside the closed catalog
- Automatic rollback from `PROCESSING` to `PENDING`
- Public staff/processor HTTP UI

## Audit

Claim and resolve emit redacted evidence through the Admin general
transactional audit writer inside the customers transaction. Audit failure
rolls back the lifecycle mutation.
