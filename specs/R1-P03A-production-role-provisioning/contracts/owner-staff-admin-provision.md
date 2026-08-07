# Owner Staff-Admin Provisioning Contract

**Surface:** `POST /api/v1/internal/owner/staff-admins`

**OpenAPI:** [owner-staff-admins.openapi.yaml](./owner-staff-admins.openapi.yaml)

**Owner module:** Authentication

## Purpose

Assign or re-enable `staff_admin` for one target user through an internal HTTPS
endpoint controlled by the product owner. This replaces the superseded non-HTTP
Ed25519 CLI bootstrap (DEC-030).

## Availability

- Endpoint registered only when server wiring includes the internal owner router.
- Requests are rejected unless `OWNER_ADMIN_API_ENABLED=true`.
- When disabled, respond with a safe error that does not confirm endpoint existence
  beyond normal internal routing policy.

## Authentication

- **Not** a user bearer session.
- Required header: `X-Owner-Admin-Secret` (name may be finalized at implementation;
  document placeholders only).
- Secret value comes from server configuration (for example
  `OWNER_ADMIN_SECRET` env var). Compare using **timing-safe** equality.
- Invalid, missing, or empty secret → fail closed before business logic.

## Rate limiting

Apply the repository rate-limit port before grant evaluation. Excessive traffic
receives a safe throttled response without grant mutation.

| Rule | Requirement |
|---|---|
| Exists | User row present for normalized email |
| Account | `ACTIVE` |
| Email | Verified (`email_verified_at` set) |

## Request body

```json
{
  "email": "existing-user@example.com"
}
```

- `email` — target user's verified email; required.
- Body MUST NOT carry authority, roles, secrets, or `targetUserId`.

Failure → safe denial without grant mutation. Unknown targets must not disclose
unrelated-user existence beyond public failure semantics.

## Allowed mutations

| Current grant | Operation |
|---|---|
| Absent or `REVOKED` | Assign → `ENABLED` |
| `DISABLED` | Enable → `ENABLED` |
| `ENABLED` | Idempotent success (no duplicate audit) |

No other roles. No revoke/disable through this endpoint.

## Audit

- Atomic with successful grant mutation.
- Privileged reason: `owner_staff_admin_provision`.
- Redacted context only — never log header secret, raw tokens, or unnecessary PII.
- Audit write failure → rollback grant.

## Idempotency

Retry of an accepted provision returns stable outcome without duplicate grant or
audit records.

## Examples policy

Documentation and OpenAPI examples MUST use:

- Secret: `OWNER_ADMIN_SECRET_PLACEHOLDER`
- Target: synthetic IDs such as `usr_placeholder_example`

Never embed real production secrets in repository artifacts.

## Explicit non-goals

- No Ed25519 envelope verification.
- No CLI adapter.
- No closure/fingerprint tables.
- No six-class bootstrap evidence matrix.
- No customer-role provisioning.
