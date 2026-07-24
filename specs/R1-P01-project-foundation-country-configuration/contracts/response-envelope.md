# Contract — Standard Success / Error / Validation Responses

**Phase**: R1-P01  
**Canonical standard**: `docs/standards/api-response-and-errors.md`  
**Implementation baseline**: `src/core/http/api-response.ts`, `error.middleware.ts`

R1-P01 reuses and freezes this envelope for all HTTP endpoints. No alternate shapes.

## Success

```json
{
  "success": true,
  "data": {},
  "requestId": "<uuid>",
  "meta": {}
}
```

- `data` always present.
- `meta` optional.
- `requestId` always present (normalized correlation UUID).

## Validation failure (HTTP 400)

```json
{
  "success": false,
  "error": {
    "code": "REQUEST_VALIDATION_FAILED",
    "message": "Request validation failed",
    "details": {
      "issues": [
        {
          "path": "field.name",
          "code": "invalid_type",
          "message": "Expected string"
        }
      ]
    }
  },
  "requestId": "<uuid>"
}
```

## Unexpected failure (HTTP 500)

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred",
    "details": {}
  },
  "requestId": "<uuid>"
}
```

No stack traces, SQL, file paths, tokens, or provider payloads.

## Selected foundation codes

| Code | HTTP | When |
|---|---:|---|
| `REQUEST_VALIDATION_FAILED` | 400 | Zod / input validation |
| `RATE_LIMIT_EXCEEDED` | 429 | Explicit policy exhausted |
| `RATE_LIMITER_UNAVAILABLE` | 503 | Limiter storage/middleware failure (fail-closed) |
| `DEPENDENCY_NOT_READY` | 503 | Readiness probe failure |
| `DATABASE_UNAVAILABLE` | 503 | Dedicated DB health failure |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected |

Configuration module **in-process** errors use typed application errors (not necessarily HTTP) with stable codes such as `CONFIG_KEY_UNKNOWN`, `CONFIG_VALUE_MISSING`, `CONFIG_COUNTRY_VALUE_REQUIRED`, `CONFIG_COUNTRY_OVERRIDE_REJECTED`, `COUNTRY_UNAVAILABLE`, `CONFIG_VALUE_INVALID`. If ever exposed via HTTP later, map through the same envelope.
