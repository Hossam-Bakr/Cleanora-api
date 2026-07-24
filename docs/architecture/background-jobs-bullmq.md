# Background Jobs and BullMQ

BullMQ sits behind `QueueFactory`, `QueuePort`, and `QueueWorker`.

Every job must define:

- Domain owner and versioned payload
- Deterministic job/idempotency key
- Retry/backoff and terminal-failure policy
- Side-effect idempotency
- Observability and operator recovery
- Data retention

No future business queues or workers exist in R1-P00. PostgreSQL remains authoritative; a queue acknowledgement is not business completion.
