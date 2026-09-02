# R1-P08 Authorization and Audit Matrix

**Decision authority:** DEC-043

## Authentication catalog additions

| Kind | Code | Mapping / rule |
|---|---|---|
| Permission | `catalog.management.read` | Active `staff_admin` only |
| Permission | `catalog.management.write` | Active `staff_admin` only |
| Protected operation | `catalog.management.read` | Global scope, non-privileged, requires read permission |
| Protected operation | `catalog.management.write` | Global scope, privileged, requires write permission and reason operation |
| Reason operation | `CATALOG_MANAGEMENT_WRITE` | Closed Authentication-owned operation |
| Reason code | `catalog_management_change` | Active and valid only for `CATALOG_MANAGEMENT_WRITE` |

No Catalog code checks a role name. Authentication evaluates the protected
operation against the trusted principal and current enabled grants.

## Actor matrix

| Actor/current state | Protected management read | Protected management write |
|---|---:|---:|
| Active `staff_admin` grant | Allow | Allow with valid reason |
| Disabled/revoked `staff_admin` grant | Deny | Deny |
| `staff_operations` | Deny | Deny |
| `staff_support` | Deny | Deny |
| `staff_finance` | Deny | Deny |
| Provider role/account | Deny | Deny |
| Worker | Deny | Deny |
| Customer/anonymous caller | Deny | Deny |
| Inactive/suspended trusted principal | Deny | Deny |

`CatalogDefinitionReader` is a composition-injected module contract, not an
actor-addressable HTTP permission surface. R1-P08 may wire it for approved
internal consumers and tests, but it exposes no anonymous or customer Catalog
Browse route; R1-P12 owns that later surface and its actor authorization. The
reader still returns only selectable facts and never exposes inactive drafts,
edit versions/receipts, audit facts, uploader identity, or raw Media data.

## Endpoint operation matrix

| Surface | Operation group | Required protected operation | Reason/audit |
|---|---|---|---|
| `/api/v1/staff/catalog/categories*` GET | Category management views | `catalog.management.read` | No privileged write audit |
| `/api/v1/staff/catalog/services*` GET | Service management views | `catalog.management.read` | No privileged write audit |
| Category create/update/lifecycle/reorder | Category writes | `catalog.management.write` | `catalog_management_change`; atomic privileged audit |
| Service create/update/lifecycle/reorder | Service writes | `catalog.management.write` | Same reason; atomic privileged audit |
| Service configuration PUT | Translations, units, fields/options, countries | `catalog.management.write` | Same reason; one aggregate audit |
| Service media add/reorder/remove | Media presentation | `catalog.management.write` | Same reason; final association/order audit atomic with Catalog write |
| `CatalogDefinitionReader` | Selectable list and current/snapshot-ready facts | Composition-injected internal contract; no R1-P08 HTTP route | Caller owns its later authorization; no R1-P08 business write |

## Write gate sequence

1. Authenticate the trusted principal with existing middleware.
2. Authorize `catalog.management.write` before external work.
3. Validate exact `reasonCode` through Authentication's reason catalog.
4. Validate request shape and idempotency key.
5. For ordinary writes, enter the Catalog transaction; for Media upload,
   reserve the command/media identity first and perform Media I/O outside the
   final Catalog transaction.
6. Lock affected rows and re-authorize in the final transaction using current
   Authentication facts.
7. Enforce expected version and all Catalog/Configuration/Media invariants.
8. Write Catalog truth and version.
9. Append Admin-owned privileged audit evidence with the same transaction.
10. Complete the idempotency receipt and commit.

Any denied, stale, invalid, or dependency-failed command produces no accepted
Catalog truth or success audit. A denial audit may be recorded independently
only through the existing Admin denial seam with safe allowlisted context.

## Audit allowlist

Allowed:

- actor user ID from trusted principal;
- action code, target type/ID, request ID, reason code, timestamp;
- before/after `isActive`, aggregate version, category/service code, safe
  country code, and counts/position IDs when needed;
- outcome codes such as `SUCCEEDED`, `DENIED`, `CONFLICT`, or `COMPENSATED`.

Forbidden:

- Arabic/English names, descriptions, labels, help text, or special content;
- request body, uploaded bytes, content body, storage key, signed URL;
- credentials, tokens, cookies, proofs, role tables, raw Prisma records, stack
  traces, SQL, or provider payloads.

## Authorization tests

- Positive read/write for active `staff_admin`.
- Every other existing staff role denied independently, including multi-role
  combinations that do not include active `staff_admin`.
- Disabled/revoked grant and inactive/suspended principal denied on a fresh
  authorization read.
- Write denied when reason is missing, inactive, unknown, or bound to another
  operation.
- Protected management reads show inactive drafts only to the allowed actor.
- Internal reader tests prove selectable facts never expose draft management
  fields, and route/OpenAPI/Postman tests prove R1-P08 exposes no anonymous or
  customer Catalog Browse surface.
- Race test rechecks authority inside the final transaction so revocation
  between precheck and commit prevents the mutation.
