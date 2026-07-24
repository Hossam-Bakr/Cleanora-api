# ADR-0008 — Production logger

- Status: Accepted
- Date: 2026-07-23
- Accepted: 2026-07-24

## Context

The foundation needs safe structured application and HTTP request logging.

## Decision

- Use Pino for structured JSON application logs.
- Use `pino-http` for one completion log per HTTP request.
- Keep Pino behind the internal `Logger` port and the integration layer.
- Reuse the request correlation UUID.
- Do not log request bodies.
- Redact authorization, cookies, tokens, passwords, OTPs, secrets, signatures,
  and payment payloads.

## Consequences

Business modules remain independent of Pino. Console JSON is the initial
transport; later transports require a separate operational decision.
