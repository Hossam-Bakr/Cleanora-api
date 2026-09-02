# Authorization, Audit, and Privacy Requirements Quality Checklist

**Purpose:** Validate that R1-P08 authorization, privileged audit, safe output,
and privacy requirements are complete and unambiguous before tasks.
**Created:** 2026-08-30
**Audience/Timing:** Codex architecture reviewer and Cursor implementer before
implementation; formal phase gate depth.

## Authority completeness

- [x] CHK001 Are protected management-read and management-write permissions explicitly named and separated? [Completeness, Spec §FR-030, DEC-043]
- [x] CHK002 Is the exact role mapping for both permissions specified, including explicit exclusion of every other current staff and business role? [Clarity, Spec §FR-031, Authorization Matrix §Actor matrix]
- [x] CHK003 Are active-account and enabled-grant requirements distinguished from merely possessing a historical role record? [Completeness, DEC-043, Authorization Matrix §Actor matrix]
- [x] CHK004 Is Catalog's dependency on Authentication's public protected-operation contract specified without role-table access or role-name checks? [Consistency, Spec §FR-032, Plan §Architecture and Ownership]
- [x] CHK005 Are protected management HTTP and the internal selectable module contract defined as separate surfaces, with anonymous/customer Browse HTTP explicitly deferred to R1-P12? [Consistency, Spec §FR-033, §FR-050, Authorization Matrix §Endpoint operation matrix]
- [x] CHK006 Is later internal snapshot-ready access constrained to a named public contract rather than implied direct database access? [Coverage, Spec §FR-042–FR-043, Contract §Reader interface]

## Privileged reason and audit clarity

- [x] CHK007 Are the write reason operation/code, ownership, activity rule, and wrong-reason denial specified exactly? [Clarity, Authorization Matrix §Authentication catalog additions]
- [x] CHK008 Are all accepted Catalog mutation classes explicitly covered by the privileged write/audit requirement? [Completeness, Spec §FR-033, Authorization Matrix §Endpoint operation matrix]
- [x] CHK009 Are required audit facts—actor, reason, target, request ID, timestamp, version, and safe before/after context—defined? [Completeness, Spec §FR-033, Authorization Matrix §Audit allowlist]
- [x] CHK010 Are localized content, request bodies, binary data, storage keys, URLs, credentials, and raw persistence data explicitly excluded from audit/log context? [Privacy, Authorization Matrix §Audit allowlist]
- [x] CHK011 Is atomic rollback specified when privileged audit persistence fails? [Recovery, Spec §FR-033–FR-035, Transaction Contract §Failure semantics]
- [x] CHK012 Is idempotent replay defined to avoid a second mutation, version increment, or success audit? [Consistency, Spec §FR-035, Transaction Contract §Ordinary mutation transaction]

## Denial and race coverage

- [x] CHK013 Are unauthenticated, unauthorized, inactive/suspended, disabled/revoked grant, invalid reason, stale version, and unknown operation outcomes covered distinctly? [Coverage, Authorization Matrix §Authorization tests]
- [x] CHK014 Is a final transaction-bound authority recheck specified for revocation races? [Concurrency, Authorization Matrix §Write gate sequence]
- [x] CHK015 Are denied and invalid writes specified to change zero Catalog business rows and create no success audit? [Measurability, Spec §FR-031–FR-035]
- [x] CHK016 Are safe 401/403/404 distinctions specified without leaking draft existence or permission internals? [Privacy, Contract `catalog-api.openapi.yaml`, Transaction Contract §Failure semantics]

## Output and Media privacy

- [x] CHK017 Are management-only versions/drafts/receipts separated from selectable DTOs? [Consistency, Spec §FR-042–FR-044, Public Contract §Selectable service summary]
- [x] CHK018 Is the staff uploader ID defined as Media accountability only and excluded from customer-facing/service-ownership semantics? [Clarity, Data Model §Modified existing model]
- [x] CHK019 Are signed delivery URLs, expiries, stable Media references, and forbidden storage/provider details distinguished? [Completeness, Public Contract §Media public additions, Plan §Security]
- [x] CHK020 Is the assumption that ordinary Catalog text is non-PII balanced by a requirement not to log/audit free-form localized content? [Consistency, Spec §Assumptions, Authorization Matrix §Audit allowlist]
