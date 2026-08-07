# Transaction Boundaries — R1-P03A (Owner MVP)

**Authority:** DEC-030, [spec.md](../spec.md)

## Module ownership

| Concern | Owner |
|---|---|
| Owner provisioning policy | Authentication |
| Staff-admin command adaptation | Authentication |
| Role transition business rules | Authentication (`RoleManagementService`) |
| Grant persistence | Authentication repositories |
| Audit record lifecycle | Admin |
| Audit write inside transaction | Admin writer invoked by Authentication UoW |

No module imports another module's Prisma adapter. Composition root wires ports only.

## Owner provisioning flow

```text
HTTP POST /internal/owner/staff-admins
  -> OwnerStaffAdminProvisionController (parse, rate limit)
  -> verify OWNER_ADMIN_API_ENABLED + timing-safe secret
  -> OwnerStaffAdminProvisionService
  -> OwnerStaffAdminProvisionUnitOfWork (Authentication)
       reload/lock target (ACTIVE + verified email)
       apply staff_admin assign or enable via existing grant rules
       invoke Admin audit writer (same transaction client)
  -> commit or rollback
```

There is no closure table, fingerprint persistence, or secondary evidence transaction
for the six-class superseded matrix.

## Staff-admin command flow

```text
HTTP POST /auth/role-grants/commands
  -> RoleGrantCommandController
  -> reject roleCode customer
  -> authenticate bearer principal
  -> RoleManagementService (existing Authentication transaction)
  -> commit or rollback
```

Controller MUST NOT bypass `RoleManagementService` or open a parallel transaction.

## Cross-module audit rule

Successful owner provision and ordinary mutations append audit through the existing
Admin transactional writer on the Authentication transaction client. Audit failure
rolls back the grant mutation.

## R1-P04 note

R1-P03A does not grant `customer` roles and does not implement R1-P04 customer
authorization. R1-P04 customer self-service will authorize from principal + SELF
+ category eligibility without role-derived customer permissions.
R1-P04 authorization is independent per DEC-030.
