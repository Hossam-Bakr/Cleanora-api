# Contract — OpenAPI Foundation

**Phase**: R1-P01  
**Approach**: Static OpenAPI 3.x document (see research R11)  
**Planned path**: `docs/apis/openapi/r1-p01-foundation.yaml`  
**Validation**: `npm run openapi:validate` included in `npm run ci`

## Goals

- Document implemented HTTP foundation endpoints under `/api/v1`.
- `$ref` shared success/failure schemas matching `response-envelope.md`.
- Remain editable without Express decorator codegen.
- Fail CI when the document is invalid YAML/OpenAPI.

## Minimum paths to document

| Method | Path | OperationId (illustrative) |
|---|---|---|
| GET | `/api/v1/system/health/live` | `systemHealthLive` |
| GET | `/api/v1/system/health/ready` | `systemHealthReady` |
| GET | `/api/v1/system/health/database` | `systemHealthDatabase` |

## Shared components

- `ApiSuccess` envelope
- `ApiFailure` envelope
- `REQUEST_VALIDATION_FAILED` example
- `DEPENDENCY_NOT_READY` / `DATABASE_UNAVAILABLE` examples
- Header `x-request-id` / property `requestId`

## Non-goals (R1-P01)

- Generating client SDKs.
- Documenting R1-P02 authentication routes as implemented.
- Hosting Swagger UI (optional later).
- Claiming configuration/audit HTTP CRUD (in-process contracts only).

## Related human docs

- `docs/apis/foundation-system.md` — update for database health
- `docs/apis/README.md` — index entry for OpenAPI file
- Postman: `postman/R1-P01-foundation-country-configuration.postman_collection.json` aligned with the same paths
