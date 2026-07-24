# Observability

Every request receives a correlation UUID and returns it in `x-request-id`.

Structured logs include timestamp, level, application, environment, request/job identifiers, stable event name, and safe metadata. Sensitive fields are redacted. Error responses expose stable codes without internal details.

Metrics and traces should cover request latency/errors, database readiness, queue depth/failures, webhook replays, notification delivery, and shutdown behavior when the relevant adapters are implemented.

Pino and `pino-http` are approved in ADR-0008. Later log transports, metrics,
and traces remain phase- and deployment-owned decisions.
