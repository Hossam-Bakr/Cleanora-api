# Logging Standard

Pino is the approved structured application logger and `pino-http` is the
approved HTTP request logger.

Each completed request logs:

- Request ID
- HTTP method
- Safe URL
- Response status
- Response duration
- Safe remote address

The logger does not log request bodies. Authorization headers, cookies,
passwords, tokens, OTPs, secrets, signatures, and payment payloads are redacted.

Levels:

- `info`: normal successful requests and lifecycle events
- `warn`: expected degraded states and 4xx responses needing attention
- `error`: 5xx responses, startup/shutdown failures, and failed dependencies
- `debug`: development-only safe diagnostic metadata

Business modules depend on the `Logger` port. Pino remains an integration
adapter and must not leak into module contracts.
