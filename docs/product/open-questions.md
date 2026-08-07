# Cleanora — Open Product Questions

> Items in this file must not be invented by developers or AI systems.
> A decision must be approved and moved to `decision-log.md` before implementation.

| ID | Open Question | Affected Areas | Temporary Implementation Rule |
|---|---|---|---|
| OQ-001 | Exact cancellation and reschedule fee matrix, including deposit fate | Booking, payment, ledger | Build cancellable states and audit events; do not calculate unapproved fees |
| OQ-002 | Whether cleaning materials are provider-supplied or customer-supplied per service | Catalog, booking snapshot | Store service notes/requirements; do not enforce a universal rule |
| OQ-003 | Recurring booking and package rules | Future retention | Excluded from current three releases |
| OQ-004 | Additional charges after work starts and customer approval UX | Orders, payment | Do not allow automatic unapproved price increases |
| OQ-005 | Detailed review dimensions, publishing rules, editing window, and advanced moderation | Ratings/reviews | Release 1 implements basic provider/team rating plus written review |
| OQ-006 | In-order chat versus structured status-only communication | Orders, notifications | No free chat in the current roadmap |
| OQ-007 | Exact provider-document checklist required for verification | Provider verification | Build configurable document types; final required seed list needs product approval |
| OQ-008 | Coupon/promo stacking with marketer commission and deposit | Growth, ledger | Coupons excluded until approved |
| OQ-009 | Exact InstaPay technical workflow | Payments | Keep payment-method abstraction; do not invent integration behavior |
| OQ-010 | Final booking/order enum names and emergency modeling | Booking, orders | Freeze during R1-P13 using a transition matrix before migration |
| OQ-011 | Exact provider payout schedule and supported payout rails | Settlements | Make schedule and methods configurable; production values require approval |
| OQ-012 | Final rules for review deletion, provider response, and abuse reports | Reviews, admin | Do not add unapproved destructive behavior |
| OQ-013 | Exact premium price, duration, and gallery limits | Premium | Build configurable plans/benefits in Release 2 |
