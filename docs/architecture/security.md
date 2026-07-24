# Security

- Deny protected actions by default.
- Validate trusted identity, permissions, ownership, account state, and resource state.
- Use Zod at HTTP boundaries.
- Generate or accept only valid UUID request IDs.
- Redact credentials, tokens, OTPs, signatures, cookies, and payment payloads.
- Apply safe response headers and body limits at composition.
- Verify webhook signatures against raw bytes.
- Audit privileged writes with actor, reason, timestamp, and before/after evidence.
- Store no credentials or real endpoints in the repository.

Authentication, CORS, CSRF, upload security, and endpoint rate policies must be completed by their owning phases.
