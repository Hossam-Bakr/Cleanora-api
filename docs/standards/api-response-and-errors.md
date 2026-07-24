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
    "message": "Request validation failed",
    "details": {
      "issues": [
        {
          "path": "email",
          "code": "invalid_format",
          "message": "Enter a valid email address"
        }
      ]
    }
  },
  "requestId": "8d98a068-5e5d-45b7-a038-6a92aebaa1c2"
}
```

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
