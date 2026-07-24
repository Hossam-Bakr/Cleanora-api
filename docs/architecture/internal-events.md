# Internal Events

Use direct public API calls by default.

Introduce an in-process domain/application event only when it reduces coupling and the owning phase defines:

- Event owner and versioned payload
- Transaction relationship
- Handler idempotency
- Ordering and retry expectations
- Audit/persistence requirement
- Failure recovery

Internal events are not business truth and do not justify a distributed event bus. Durable asynchronous work belongs behind the queue port when approved.
