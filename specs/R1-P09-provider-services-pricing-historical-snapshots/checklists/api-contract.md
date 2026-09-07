# API and Contract Requirements Checklist: R1-P09

**Purpose**: Validate the completeness and consistency of protected HTTP, safe DTO, internal-reader, error, and documentation contracts.
**Created**: 2026-09-05
**Feature**: [provider-services-http.md](../contracts/provider-services-http.md)

**Note**: This checklist tests the written contracts, not running routes. Checked items were evaluated during the planning analysis.

## HTTP Surface and Input Clarity

- [x] CHK001 Are the exact 11 protected Provider/Staff operations, methods, paths, and purposes enumerated once without hidden public operations? [Completeness, Plan §Planned HTTP Surface, HTTP Contract §Provider Routes and §Staff Routes]
- [x] CHK002 Are strict body, path, cursor, version, idempotency, note, reason, decimal, and unknown-field rules specified for every applicable operation? [Clarity, HTTP Contract §Common Boundary Rules]
- [x] CHK003 Are fresh-create, fresh-proposal, ordinary success, and replay status/envelope semantics defined consistently? [Consistency, HTTP Contract §Provider Routes]
- [x] CHK004 Are server-owned actor, scope, currency, approval, maximum, Catalog identity, and monetary-total fields excluded from caller authority? [Security, HTTP Contract §Common Boundary Rules and §POST services]
- [x] CHK005 Are current effective versus pending/rejected/superseded management facts and safe history projections distinguished? [Clarity, Spec §FR-032, HTTP Contract §Core Management DTOs]
- [x] CHK006 Are pagination order, cursor behavior, default/maximum limits, and safe list metadata defined for management/history/Staff lists? [Completeness, HTTP Contract §Common Boundary Rules and route sections]

## Outputs, Failures, and Internal Contract

- [x] CHK007 Are all public monetary values specified as canonical decimal strings with no client total or binary-float semantics? [Consistency, Spec §FR-013–FR-014, HTTP Contract §Core Management DTOs]
- [x] CHK008 Are safe error codes/statuses defined for validation, authority, scope, Provider/Catalog/configuration/approval state, version, replay, snapshot conflict, and dependency failure? [Exception Coverage, HTTP Contract §Status and Error Catalog]
- [x] CHK009 Are Staff queue/dossier visibility, fresh decision-time policy checks, and replay-before-current-policy behavior explicitly separated? [Edge Case, HTTP Contract §Staff Routes]
- [x] CHK010 Is the internal snapshot input/output complete, exact-locale, effective-only, non-HTTP, and deterministic for unavailable/conflict outcomes? [Completeness, Spec §FR-036–FR-040, Public Contract §ProviderServiceSnapshotReader]
- [x] CHK011 Are raw persistence, private contacts, secrets, receipt internals, Staff reasons, and hidden approval metadata excluded from each relevant output class? [Privacy, Spec §FR-038, HTTP Contract §Core Management DTOs]
- [x] CHK012 Is route/OpenAPI/Postman method/path/schema/security/example parity required for exactly the same 11 operations? [Traceability, HTTP Contract §OpenAPI and Postman, Test Strategy §OpenAPI and Postman]

## Notes

- All API/contract requirement-quality checks are resolved; no route, OpenAPI source, or Postman artifact was implemented.
