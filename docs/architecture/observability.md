# Observability

Every request receives a correlation UUID and returns it in `x-request-id`.

Structured logs include timestamp, level, application, environment, request/job identifiers, stable event name, and safe metadata. Sensitive fields are redacted. Error responses expose stable codes without internal details.

Metrics and traces should cover request latency/errors, database readiness, queue depth/failures, webhook replays, notification delivery, and shutdown behavior when the relevant adapters are implemented.

Morgan is the only HTTP access logger. Development uses a concise format;
production uses a combined-style format; tests are silent. Query strings,
bodies, authorization headers, and cookies are excluded. A small JSON
application logger handles startup, shutdown, and provider failures with
recursive secret redaction.
