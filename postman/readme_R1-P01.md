# Cleanora R1-P01 — Foundation & Country Configuration

> **API version:** `/api/v1`
> **Collection environments:** `Hosted (Not hosted yet)` and `Local`

R1-P01 expands the foundation health surface with a direct database health
probe. Country configuration and privileged audit remain internal modular
monolith contracts in this phase; R1-P01 intentionally exposes no public
country CRUD or audit-log CRUD endpoint.

## Collection Structure

```text
Hosted (Not hosted yet)
└── System Health
    ├── Live
    ├── Ready
    └── Database

Local
└── System Health
    ├── Live
    ├── Ready
    └── Database
```

Hosted requests use `{{hostUrl}}`; Local requests use `{{baseUrl}}`.

## Health Contracts

### Live

```http
GET {{baseUrl}}/system/health/live
```

Returns `200` when the process is alive.

### Ready

```http
GET {{baseUrl}}/system/health/ready
```

Returns `200` when required dependencies are ready. A dependency problem
returns a safe `503 DEPENDENCY_NOT_READY` response without connection strings,
SQL text, or internal topology.

### Database

```http
GET {{baseUrl}}/system/health/database
```

Returns `200` when PostgreSQL is reachable. A database outage returns a safe
`503 DATABASE_UNAVAILABLE` envelope.

## Saved Examples and Tests

Every request contains a Saved Example named `Success`. The executable Postman
tests also verify:

- the expected status;
- `success` and `requestId` in the response body;
- correlation between the body request ID and `x-request-id`;
- safe `503` error codes for readiness/database failures;
- absence of database URLs, SQL, and sensitive infrastructure details.

No health request requires authentication or a request body.
