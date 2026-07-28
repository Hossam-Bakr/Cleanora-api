# API Response and Error Standard

All business and system endpoints use the same JSON envelopes.

## Success

```json
{
  "success": true,
  "data": {
    "id": "example"
  },
  "requestId": "8d98a068-5e5d-45b7-a038-6a92aebaa1c2",
  "meta": {
    "page": 1,
    "pageSize": 20
  }
}
```

- `data` is always present, including for small acknowledgements.
- `meta` is optional and contains pagination or safe response metadata.
- `requestId` is always present.
- Never return raw Prisma records.

## Failure

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_VALIDATION_FAILED",
    "statusCode": 400,
    "message": "Request validation failed",
    "details": {
      "issues": [
        {
          "path": "phone",
          "code": "custom",
          "message": "Enter a valid international phone number, for example +201012345678"
        },
        {
          "path": "email",
          "code": "invalid_format",
          "message": "Enter a valid email address"
        },
        {
          "path": "password",
          "code": "custom",
          "message": "Password must not be common, repeated, or sequential"
        }
      ]
    }
  },
  "requestId": "8d98a068-5e5d-45b7-a038-6a92aebaa1c2"
}
```

- `error.code` is the stable machine-readable contract used for frontend
  branching and localization.
- `error.statusCode` always equals the actual HTTP response status.
- `error.message` is a safe descriptive English message. A frontend may show
  it during development and should localize by `error.code` for production.
- `error.details` is optional and may identify safe input fields and reasons.
  It never contains submitted values or authentication secrets.
- `REQUEST_VALIDATION_FAILED` returns every independently detectable body,
  parameter, and query issue in `error.details.issues`. Validation must not
  force the client to fix one field and resubmit merely to discover the next
  invalid field.
- A safe state-dependent operation may also use `error.details.issues` when
  multiple approved conflict fields are known at once. Passwords and other
  secrets are never conflict fields and must never appear in those issues.

## Error families

| Family | HTTP status | Example code |
|---|---:|---|
| Validation | 400 | `REQUEST_VALIDATION_FAILED` |
| Authentication | 401 | `AUTHENTICATION_REQUIRED` |
| Authorization | 403 | `PERMISSION_DENIED` |
| Not found | 404 | `RESOURCE_NOT_FOUND` |
| Conflict/state | 409 | `RESOURCE_STATE_CONFLICT` |
| Rate limit | 429 | `RATE_LIMIT_EXCEEDED` |
| Dependency unavailable | 503 | `DEPENDENCY_NOT_READY` |
| Unexpected | 500 | `INTERNAL_SERVER_ERROR` |

## Safety rules

- Codes are stable machine-readable contracts.
- Messages are safe for users and may be localized by the client.
- Details contain field-level or operationally safe information only.
- Do not expose stack traces, SQL, provider payloads, connection strings,
  tokens, OTPs, cookies, password hashes, or internal file paths.
- Database connection errors become a safe dependency error at health
  boundaries or an internal error during a protected workflow.
- Every error is correlated with structured logs using `requestId`.
