# Architecture Decision Records

Use sequential IDs and `template.md`. Accepted ADRs define current architecture; Proposed ADRs are not permission to install packages or implement providers.

| ADR | Decision | Status |
|---|---|---|
| 0001 | Modular monolith | Accepted |
| 0002 | Compact module layout | Accepted |
| 0003 | One Prisma schema with module ownership | Accepted |
| 0004 | Public module API through `index.ts` | Accepted |
| 0005 | Cross-module import enforcement | Proposed |
| 0006 | Vitest, Supertest, and non-Docker Release 1 test isolation | Accepted |
| 0007 | Firebase push; SMS provider remains open | Partially Accepted |
| 0008 | Pino and pino-http structured logging | Accepted |
| 0009 | rate-limiter-flexible behind an explicit-policy port | Accepted |
| 0010 | JWT access plus rotating refresh-cookie sessions | Accepted |
| 0011 | Root app/server with routes, integrations, and job composition | Accepted |
| 0012 | Prisma 7.9 toolchain security override | Accepted |
| 0013 | Auth JWT, Argon2id, OTP, and OpenID Connect libraries | Accepted for R1-P02 preparation |
