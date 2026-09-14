# Review Resolution — R1-P16 Provider Booking Response & Cancellation Events

## Resolution summary

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| MAJOR customer/staff cancel after lazy expiry returns `TRANSITION_NOT_AVAILABLE` | accepted | `expireThenDenyIfExpired()` throws `RESPONSE_EXPIRED` after a committed expiry | `booking-response.service.test.ts` customer/staff cancel expired cases |
| MAJOR `providerCancel` replays before membership check | accepted | `assertActiveProviderManager()` now runs before `withActorIdempotency()` | inactive-manager replay test |
| MAJOR dossier omits frozen service facts | accepted | dossier/inbox now expose `serviceId` / catalog service code+version | dossier + inbox `serviceLabel` assertions |
| MAJOR inbox `take: 100` can hide live items behind expired rows | accepted | expire overdue PENDING rows first, then list live `expiresAt > now` up to `limit` | live-after-overdue-batch test |
| MAJOR actor-command check-then-create race | accepted | catch `P2002`, reload winner, hash-compare, replay or `IDEMPOTENCY_BODY_MISMATCH` | unique-collision accept replay test |

Allowed decisions: `accepted`, `rejected-with-evidence`, `already-resolved`, `owner-decision-required`.

## Files changed

- `src/modules/bookings/bookings.response.service.ts`
- `tests/unit/modules/bookings/booking-response.service.test.ts`
- `specs/R1-P16-provider-booking-response-cancellation-events/contracts/http-api.md`

## Regression coverage

- Expired customer/staff cancel → `RESPONSE_EXPIRED`
- Provider-cancel replay denied without active OWNER/ADMIN
- Dossier `serviceId` + frozen catalog service
- Inbox still returns later live items after an expired batch
- Actor-command `P2002` replays the stored result

## Remaining risks or decisions

- Codex re-review of these repairs **PASS** (call 7). Live clean + P15→P16
  upgrade **PASS** on `cleanora_r1_p16_proof`. Phase Complete under DEC-097.

## Final checks

- `npx tsc --noEmit` PASS (2026-09-14 02:16)
- `npm run test:coverage:r1-p16` PASS 98.16 / 85.61 / 96.29 / 98.51 (108 tests)
