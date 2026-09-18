# HTTP API contract — R1-P18

Base: `/api/v1/orders`

Auth: session cookie / bearer as existing auth middleware. Deny by default.

| Method | Path | Actor | Purpose |
|---|---|---|---|
| GET | `/:orderId` | customer owner, provider OWNER/ADMIN, ACTIVE assignment member, staff | Dossier (no code plaintext) |
| GET | `/by-booking/:bookingId` | same entitlement via booking link | Ensure+get or 404 |
| GET | `/:orderId/timeline` | same | Chronological events/history |
| POST | `/:orderId/transitions/on-the-way` | field actor | ASSIGNED→ON_THE_WAY |
| POST | `/:orderId/transitions/in-progress` | field actor | ON_THE_WAY→IN_PROGRESS |
| POST | `/:orderId/transitions/ready-to-complete` | field actor | IN_PROGRESS→READY_TO_COMPLETE + code |
| POST | `/:orderId/complete` | field actor | body `{ code, idempotencyKey }` |
| POST | `/:orderId/completion-code/resend` | field actor | supersede + intent |
| POST | `/:orderId/media` | field actor | attach mediaFileId + kind |
| POST | `/:orderId/notes` | field actor | add note |
| GET | `/:orderId/media` | role-filtered | list visible media |

Idempotency: `Idempotency-Key` header or body field on all POSTs.

Errors: reuse platform problem+json / existing error envelope with orders
error codes (invalid state, forbidden, code invalid/expired/locked, etc.).

OpenAPI file: `docs/apis/openapi/r1-p18-order-execution-completion-code.yaml`
