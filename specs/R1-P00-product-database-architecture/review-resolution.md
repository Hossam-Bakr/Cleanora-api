# Review Resolution — R1-P00 Product & Database Architecture

> **Historical phase-state note:** This resolution preserves the point-in-time
> R1-P00 repair state before later human completion. R1-P00 is now Complete;
> every `In Progress` or not-yet-Complete statement below is historical.
> `docs/product/current.md` is the authority for current phase state.

## Resolution summary

| Finding | Decision | Evidence/fix | Validation |
|---|---|---|---|
| MAJOR — Wrong OQ tags on `provider_document_reviews` | `accepted` | Replaced `OQ-005/012` with `OQ-007` on `docs/architecture/entity-ownership.md` ownership row for `provider_document_reviews`. OQ-007 containment remains: configurable provider-document types; required checklist unfrozen. Ratings/review rows retain `OQ-005/012`. | PASS — `provider_document_reviews` cites only OQ-007; OQ-005/012 limited to ratings/reviews |
| MAJOR — Ban/suspension incomplete vs FR-011 / FR-034 | `accepted` | `docs/architecture/master-erd.md` §1: phase `R1 / R1-P02`; notes R1-P02 identity enforcement + R1-P25 admin consumer/control surface; no dedicated table. `docs/architecture/entity-ownership.md` conceptual/derived inventory: Ban/suspension row with owning concern `identity` (R1-P02), admin consumer (R1-P25), persistence deferred. | PASS — R1-P02 enforcement ownership; R1-P25 control surface; conceptual inventory present; no invented table/enum/migration |
| MINOR — `payment_methods` over-classified as immutable financial | `accepted` | Reclassified `payment_methods` to `authoritative / external integration` in `entity-ownership.md`. Attempts, payments, ledger, and other immutable financial rows unchanged. | PASS — `payment_methods` is not immutable financial |
| MINOR — Cloned sibling consumer wording | `accepted` (non-blocking polish; partially tightened) | Left most cloned family wording unchanged. Materially adjusted only `financial_idempotency_keys` (removed inaccurate marketer commission consumer) and `payment_methods` consumer purposes (method selection vs deposit/payment state). | PASS — no invented consumers; optional polish only where purpose differed |

Allowed decisions used: `accepted`.

## Files changed

- `docs/architecture/master-erd.md` — Ban/suspension phase + ownership notes
- `docs/architecture/entity-ownership.md` — OQ-007 on `provider_document_reviews`; Ban/suspension conceptual row; `payment_methods` classification/consumers; `financial_idempotency_keys` consumer purpose
- `specs/R1-P00-product-database-architecture/review-resolution.md` — this file

## Regression coverage

Documentation-only repair. No runtime tests. Validation performed by targeted content checks (see Final checks).

## Remaining risks or decisions

- Exact Ban/suspension persistence shape (user state vs history vs audit) remains deferred to R1-P02 / R1-P25 implementation plans — intentional.
- Broader cloned consumer text across sibling tables remains accepted non-blocking polish for a later doc pass if desired.
- R1-P00 human Complete is **not** authorized by this resolution.

## Final checks

| Check | Result |
|---|---|
| `provider_document_reviews` cites only OQ-007 | PASS |
| OQ-005 / OQ-012 limited to ratings/reviews | PASS |
| Ban/suspension phase R1-P02 enforcement ownership | PASS |
| R1-P25 documented as admin consumer/control surface | PASS |
| Ban/suspension in conceptual/derived inventory | PASS |
| No dedicated ban table / Prisma model / enum / migration / fields invented | PASS |
| `payment_methods` not immutable financial | PASS |
| OQ-010 remains R1-P13 | PASS |
| All 85 tasks remain `[X]` | PASS |
| `docs/product/current.md` Status remains `In Progress` | PASS |
| No commit / push | PASS (not performed) |
