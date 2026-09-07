# Authorization Matrix: R1-P09 Provider Services and Pricing

**Status**: Planned only. No role, permission, route, or authorization code has
been changed.

## Trusted Inputs

- Actor identity comes only from the authenticated request principal.
- Authentication owns account status, active role grants, global permissions,
  and the new Staff permission.
- Providers owns approved Provider state and exact Provider membership.
- `providerId`, `providerServiceId`, and price IDs from paths are targets to
  validate, never proof of authority.
- Caller-supplied actor IDs, membership levels, Provider scope, approval flags,
  currency, and monetary totals are rejected or ignored as non-authoritative.
- R1-P09 adds no recent-authentication proof requirement.

## Provider Management Matrix

Every `ALLOW` below additionally requires an active, non-verification-only
identity, enabled global `provider_admin` authority, an `APPROVED` Provider, and
active membership for the exact Provider. Suspended Providers retain the
existing remediation-management ability, but R1-P09 never grants public
eligibility.

| Operation | Exact active OWNER | Exact active ADMIN | Disabled member | Different Provider | Customer/anonymous | Staff without membership |
|---|---:|---:|---:|---:|---:|---:|
| List offerings | ALLOW | ALLOW | DENY | DENY, non-enumerating | DENY | DENY |
| Read offering detail | ALLOW | ALLOW | DENY | DENY, non-enumerating | DENY | DENY |
| Create offering | ALLOW | ALLOW | DENY | DENY, no mutation | DENY | DENY |
| Replace duration/notes | ALLOW | ALLOW | DENY | DENY, no mutation | DENY | DENY |
| Submit price proposal | ALLOW | ALLOW | DENY | DENY, no price/history | DENY | DENY |
| Enable offering | ALLOW | ALLOW | DENY | DENY, no status/history | DENY | DENY |
| Disable offering | ALLOW | ALLOW | DENY | DENY, no status/history | DENY | DENY |
| Read price history | ALLOW | ALLOW | DENY | DENY, non-enumerating | DENY | DENY |
| Read status history | ALLOW | ALLOW | DENY | DENY, non-enumerating | DENY | DENY |
| Transfer ownership | Existing OWNER-only rule; R1-P09 does not change it | DENY | DENY | DENY | DENY | DENY |
| Manage Provider membership | Existing OWNER-only rule; R1-P09 does not change it | DENY | DENY | DENY | DENY | DENY |

Read/detail/history denial must not disclose whether another Provider's target
exists, is enabled, has pending approval, or has any price/note/history data.

## Staff Approval Matrix

Planned permission code:
`providers.services.prices.approve`. Authentication maps it only to active
`staff_admin`; Providers never inspects Authentication role tables.

| Operation | Active staff_admin with permission | Staff role without permission | Disabled/revoked staff_admin | Provider OWNER/ADMIN | Customer/anonymous |
|---|---:|---:|---:|---:|---:|
| List pending proposals | ALLOW | DENY | DENY | DENY on Staff route | DENY |
| Read pending dossier | ALLOW | DENY | DENY | DENY on Staff route | DENY |
| Approve pending proposal | ALLOW if current country policy requires approval, reason/version/key valid | DENY | DENY | DENY | DENY |
| Reject pending proposal | ALLOW if current country policy requires approval, reason/version/key valid | DENY | DENY | DENY | DENY |

Staff list/detail/decision services perform a public-contract capability check.
The committing decision transaction rechecks the same permission through an
Authentication-owned transaction-bound authorizer. A role revocation between
the outer check and commit therefore fails without price/history/audit mutation.

## Internal Snapshot Reader

`ProviderServiceSnapshotReader` is a module-public, composition-injected
internal contract; it is not mounted on HTTP and accepts no caller role or
permission claim. Only a later separately approved module may receive it from
composition. The later consumer owns its own actor/customer authorization and
any persistence decision.

The reader itself still validates Provider ID, Catalog service code, exact
country, exact locale, enabled state, effective price, and current Catalog/
Configuration compatibility. Non-qualifying/private cases collapse to
`UNAVAILABLE`; repeated consistency drift returns `CONFLICT`.

## Authorization Order for Provider Commands

1. Authentication middleware establishes a trusted principal.
2. Authentication public contract confirms active Provider-admin identity/
   global authority.
3. Providers checks `APPROVED` Provider state and exact active OWNER/ADMIN
   membership.
4. The strict request and idempotency fingerprint are validated.
5. A Providers-owned serializable transaction constructs the required Catalog,
   Configuration, Authentication, and Admin public participants without
   exposing its raw transaction to Provider domain/service code.
6. Inside that transaction, Providers rechecks current Provider state and exact
   membership, then resolves a matching completed receipt or key conflict. A
   replay is returned only after the same actor still passes current exact-
   Provider authorization.
7. Only a fresh command reads current Catalog/Configuration facts through the
   transaction-bound public contracts, then rechecks expected version and
   receipt uniqueness.
8. The same transaction applies state changes, histories/receipt, and Admin-
   owned audit atomically before one commit.

## Authorization Order for Staff Decisions

1. Authentication middleware establishes a trusted principal.
2. Staff capability authorizer requires
   `providers.services.prices.approve`.
3. Providers validates the exact pending proposal target without leaking other
   Provider private data.
4. Strict decision shape, permitted reason, expected version, and canonical
   idempotency fingerprint pass before mutation begins.
5. A Providers-owned serializable transaction creates only transaction-bound
   Authentication, Configuration, and Admin public participants.
6. Inside that transaction, Providers rechecks Authentication permission and
   exact target authority, then resolves a matching completed receipt or key
   conflict before depending on current country configuration.
7. Only a fresh command asks the transaction-bound Configuration reader to
   confirm that the Provider's current country policy still requires approval,
   then rechecks target status and Provider aggregate version.
8. The same transaction updates price state, appends price history and the
   durable receipt, and appends the privileged Admin audit atomically.

## Reason and Audit Requirements

| Mutation | Reason input | History/audit reason |
|---|---|---|
| Create offering | No free text required | Stable `INITIAL_OFFERING` code |
| Replace duration/notes | No free text required | Stable `OFFERING_CONFIGURATION_UPDATED` code |
| Submit price proposal | Trimmed 1–1000 text required | Provider text plus stable proposal code |
| Enable | Trimmed 1–1000 text required | Provider text plus `OFFERING_ENABLED` |
| Disable | Trimmed 1–1000 text required | Provider text plus `OFFERING_DISABLED` |
| Staff approve/reject | Permitted trimmed 1–1000 text required | Staff text plus exact decision code |
| Derived supersession | No extra caller text | Stable derived code and the initiating actor/request |

Every accepted mutation records actor, action, target, safe before/after,
resulting version, time, request correlation, and applicable reason through the
Admin public writer in the same transaction. Logs and DTOs exclude raw tokens,
cookies, credentials, contacts, database URLs, transaction objects, and stack
traces.

## Denial and Failure Behavior

- Unauthorized/cross-Provider operations mutate no Provider-service current
  state, domain history, command receipt, readiness state, or success audit.
- A separately required privileged/security denial audit may be written only by
  the owning Admin policy and must not include private target data.
- Unknown and cross-Provider detail/history targets use the same safe response.
- Validation and version conflicts may identify the caller's own command error
  but never another Provider's current/pending price or notes.
- Unexpected dependencies map to a stable public error and log only safe
  correlation/context.
