# Contract — System Health APIs

**Phase**: R1-P01  
**Base**: `/api/v1/system`  
**Auth**: Public (no authentication in R1-P01)  
**Envelope**: See `response-envelope.md`

## GET `/health/live`

**Purpose**: Process liveness only. No database or dependency calls.

**Success 200**:

```json
{
  "success": true,
  "data": { "status": "ok" },
  "requestId": "<uuid>"
}
```

## GET `/health/ready`

**Purpose**: Aggregate readiness of registered probes (includes PostgreSQL in normal startup).

**Success 200**:

```json
{
  "success": true,
  "data": { "status": "ready" },
  "requestId": "<uuid>"
}
```

**Failure 503** `DEPENDENCY_NOT_READY`:

```json
{
  "success": false,
  "error": {
    "code": "DEPENDENCY_NOT_READY",
    "message": "One or more required services are unavailable",
    "details": { "failed": ["database"] }
  },
  "requestId": "<uuid>"
}
```

`details.failed` contains safe probe names only — never DSNs, SQL, or secrets.

## GET `/health/database`

**Purpose**: Distinguish database connectivity from generic readiness. Performs a safe connectivity check only.

**Success 200**:

```json
{
  "success": true,
  "data": { "status": "up" },
  "requestId": "<uuid>"
}
```

**Failure 503** `DATABASE_UNAVAILABLE`:

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_UNAVAILABLE",
    "message": "Database is unavailable",
    "details": {}
  },
  "requestId": "<uuid>"
}
```

## Safety rules

- Health responses MUST NOT include environment values, connection strings, schema lists, or credentials.
- Liveness MUST remain dependency-free so orchestrators can distinguish “process dead” from “DB down.”
