# Payments and Paymob

Paymob is isolated behind `PaymentGatewayPort`, `PaymentWebhookVerifier`, and `PaymobPort`.

Locked invariants:

- The browser never proves payment.
- Webhook authenticity and provider event idempotency are mandatory.
- Server-side amounts and ledger records are authoritative.
- Money uses decimal-safe persistence; boundary minor units use `bigint`.
- Redirect URLs are user experience only.
- Raw provider payloads are sensitive and must not be logged.

R1-P00 defines contracts only. Payment sessions, webhook algorithms, ledger writes, refunds, and reconciliation belong to their owning phases.
