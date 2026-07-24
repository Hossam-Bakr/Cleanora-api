# Foundation System API

Status: Implemented

Base URL: `http://localhost:8000/api/v1`

## Liveness

```text
GET /system/health/live
```

Confirms that the Node.js process and Express application are alive. It does
not call PostgreSQL or other dependencies.

## Readiness

```text
GET /system/health/ready
```

Checks every registered readiness probe. The server registers PostgreSQL in the
normal startup path. A failed check returns `503 DEPENDENCY_NOT_READY` with safe
probe names only.

The matching local database command is:

```text
npm run db:check
```

The script is a developer diagnostic and does not replace the HTTP readiness
contract.

## Database connectivity

```text
GET /system/health/database
```

Checks PostgreSQL connectivity only. It returns `200` with `{ "status": "up" }`
or `503 DATABASE_UNAVAILABLE`; neither response exposes connection strings,
queries, credentials, or other database details.

## Rate-limit policy

`GET /system/health/ready` uses the local in-memory foundation limiter with a
generous policy of 120 requests per IP per 60 seconds. Liveness remains
unlimited. If the limiter cannot run, readiness fails closed with
`503 RATE_LIMITER_UNAVAILABLE`.
