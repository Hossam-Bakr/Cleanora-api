# API & Security Checklist: R1-P16

**Purpose**: Requirements-quality checks for HTTP, authz, and audit
**Created**: 2026-09-13
**Feature**: [spec.md](../spec.md)

- [x] Provider HTTP is scoped to selected provider OWNER/ADMIN
- [x] Customer cancel/get remain owner-scoped
- [x] Staff cancel is staff_admin with mandatory reason
- [x] Idempotency keys required on provider/staff mutates
- [x] Version/stale concurrency required
- [x] Non-enumerating privacy for other providers
- [x] No fee or gateway secret in responses
- [x] Notification intents use safe variables only
- [x] OpenAPI and Postman required for new/changed endpoints
- [x] Rate-limit existing bookings mutate pattern reused
