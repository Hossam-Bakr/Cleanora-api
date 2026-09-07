# Security Requirements Checklist: R1-P09 Provider Services and Pricing

**Purpose**: Validate that authorization, isolation, audit, privacy, and failure requirements are complete and unambiguous before implementation.
**Created**: 2026-09-05
**Feature**: [spec.md](../spec.md)

**Note**: This checklist tests the written requirements, not an implementation. Checked items were evaluated during the planning analysis.

## Authority and Scope Completeness

- [x] CHK001 Are the trusted identity, global capability, approved-Provider state, exact membership, and OWNER/ADMIN requirements defined for every Provider management operation? [Completeness, Spec §FR-007–FR-008, Authorization Matrix §Provider Management]
- [x] CHK002 Is the boundary between OWNER/ADMIN service-management authority and OWNER-only ownership/membership authority explicit? [Clarity, Spec §FR-008]
- [x] CHK003 Are the Staff role, exact permission, active-grant requirement, decision reason, and current-policy condition all specified? [Completeness, Spec §FR-028–FR-031, Authorization Matrix §Staff Approval]
- [x] CHK004 Are current authorization rechecks and receipt-replay ordering defined for both Provider and Staff mutations? [Consistency, Plan §Command model and transaction order, Authorization Matrix §Authorization Order]

## Isolation, Privacy, and Failure Semantics

- [x] CHK005 Are unknown-target and cross-Provider responses required to avoid disclosing another Provider's offerings, notes, histories, or approval facts? [Coverage, Spec §FR-009, HTTP Contract §Status and Error Catalog]
- [x] CHK006 Are caller-supplied actor, Provider scope, currency, approval policy, and calculated monetary totals explicitly non-authoritative or rejected? [Completeness, Spec §FR-007, FR-012, FR-014]
- [x] CHK007 Are allowlisted audit facts and prohibited secret/contact/database/transaction content specified for every accepted mutation? [Clarity, Spec §FR-038, FR-041, Authorization Matrix §Reason and Audit Requirements]
- [x] CHK008 Are unauthorized, invalid, stale, and idempotency-conflicting outcomes required to leave domain history, receipts, readiness, and success audit unchanged? [Exception Coverage, Spec §FR-043]
- [x] CHK009 Is the separately owned denial/security-audit exception bounded so it cannot disclose private target data or masquerade as a successful domain audit? [Clarity, Authorization Matrix §Denial and Failure Behavior]
- [x] CHK010 Is current actor authorization required before a stored successful result may be replayed? [Security, Plan §Command model and transaction order]
- [x] CHK011 Is the decision not to require recent-authentication proof stated rather than left as an implementation assumption? [Assumption, Authorization Matrix §Trusted Inputs, Research §Decision 11]
- [x] CHK012 Is the internal snapshot consumer contract non-HTTP, composition-controlled, and free of caller-controlled role claims? [Boundary Coverage, Authorization Matrix §Internal Snapshot Reader, Spec §FR-036–FR-040]

## Notes

- All security requirement-quality checks are resolved; implementation evidence remains a later, separately authorized activity.
