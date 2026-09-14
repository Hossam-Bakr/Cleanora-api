# Preparation acceptance — R1-P16

Codex PM consultation (call 1 + timed-out resume delta, thread
`01a09809-f752-7d12-b9b2-b74eb82a32ee`):

**VERDICT: ACCEPT_WITH_EXCEPTIONS**

KEEP EX-01 EX-02 EX-03 unchanged:

- EX-01: no fee calculation, no refund_request, no REFUND journal
- EX-02: notification intents only; no FCM/SMS/email delivery
- EX-03: lazy expiry on read/command; no background worker

Required persistence addition authorized in the resume delta:
`booking_actor_commands` for provider/staff idempotency because
`booking_commands` is unique on `(customerUserId, commandType, idempotencyKey)`.

T001–T033 were authorized for Cursor implementation. Phase Complete and Git
publication were not.
