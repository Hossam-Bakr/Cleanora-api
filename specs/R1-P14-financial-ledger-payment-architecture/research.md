# Research — R1-P14 Financial Ledger

Date: 2026-09-11

## Why a new `payments` module

Architecture entity ownership already assigns the six P14 tables to `payments`.
Bookings owns commercial quotes; mixing ledger posting into Bookings would
create a second money owner and leak persistence across the later P15 gateway
work.

## Why zero HTTP

Roadmap §R1-P14 lists ledger structure, types, idempotency, snapshots, and
reconciliation interfaces — not customer or staff routes. P11 already proved
the in-process public-contract pattern. Staff finance HTTP belongs to a later
admin/finance phase. Inventing endpoints would expand MVB.

## Why system accounts only

DEC-003 forbids stored-value user wallets. Per-user or per-provider accounts
with a cached balance would be a wallet in disguise. System accounts classify
movement; `ledger_entry_links` attach journals to bookings; derived totals are
sums.

## Why double-entry

Vision §7.4 and the master ERD require immutable financial records and
corrections via compensating entries. A balanced debit/credit journal makes
“totals derive from controlled server records” testable and prevents a single
unsigned bucket from acting like a wallet.

## Why booking links now

The `orders` table is R1-P18. Roadmap “order-level financial entries” is
satisfied by linking to the commercial booking and reserving `ORDER` as a
closed unused kind. A live order FK would invent a table.

## Why Bookings does not post in P14

P13 EX-02 kept deposit as a calculated requirement. P15 owns verified gateway
events and the `CONFIRMED` transition. If Bookings posted on submit-for-deposit,
P14 would invent collection.

## Open product items contained, not invented

- OQ-001: no cancellation fee amounts
- OQ-008: no coupon lines
- OQ-009: no InstaPay / gateway session
