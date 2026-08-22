# API and Domain Requirements Quality Checklist: R1-P06

**Purpose**: Formal gate for lifecycle, authorization, API, idempotency, readiness, and phase-boundary requirement quality.
**Created**: 2026-08-13
**Feature**: [spec.md](../spec.md)
**Depth**: Standard-to-high reviewer gate.

## Requirement Completeness

- [x] CHK001 Are application-approval prerequisites and suspended-remediation behavior defined for every Provider document and payout capability? [Completeness, Spec §FR-006–009]
- [x] CHK002 Are Provider document Owner/Admin authority and Staff-only decision authority complete for list, draft, evidence, submission, successor, review, and history? [Coverage, Spec §FR-019–036]
- [x] CHK003 Are payout Owner mutation, Admin reduced read, Staff review/reveal/decision, and cross-Provider denial scopes completely distinguished? [Coverage, Spec §FR-055–071]
- [x] CHK004 Are Mobile Wallet and Bank Account required fields, registry sources, normalization, and prohibited inputs/evidence completely defined? [Completeness, Spec §FR-089–117]
- [x] CHK005 Are review queues, decision histories, audit evidence, and notification intents specified for every required event? [Completeness, Spec §FR-075–080, §FR-136–139]

## Lifecycle Clarity and Consistency

- [x] CHK006 Is the document matrix explicit about SUBMITTED decisions versus approved-version invalidation and voluntary successor continuity? [Clarity, Spec §FR-027–038]
- [x] CHK007 Are all nine payout states and every legal transition/terminal state fully specified without a generic status mutation? [Clarity, Spec §FR-120–128]
- [x] CHK008 Is one-open-successor behavior consistent across correction, voluntary replacement, Staff challenge, rejection, and abandonment? [Consistency, Spec §FR-119, §FR-123–128]
- [x] CHK009 Are first-primary initialization, unrelated approval, explicit switch, removal replacement, last-primary acknowledgement, successor inheritance, and Staff no-failover behavior mutually consistent? [Consistency, Spec §FR-129–135]
- [x] CHK010 Is readiness consistently limited to one current active approved primary across wallet/bank requirements and later projections? [Consistency, Spec §FR-062–063, §FR-102, §FR-117, §FR-129]

## API and Failure Semantics

- [x] CHK011 Are strict request authority, exact versions, command identity, matching retries, and stale/competing conflict semantics documented for all mutations? [Completeness, Spec §FR-034–035, §FR-078–081, §FR-098, §FR-114, §FR-135]
- [x] CHK012 Are safe response envelopes, pagination bounds, HTTP status families, and stable non-sensitive error codes documented in the planning contract? [Completeness, API Contract]
- [x] CHK013 Are payout identifiers prohibited from URLs/query strings and full values restricted to one non-cacheable reveal response? [Security Consistency, Spec §FR-150–153; API Contract]
- [x] CHK014 Is role-specific DTO separation explicit enough that Admin/ordinary Staff cannot receive Owner/reveal-only fields? [Clarity, Spec §FR-067, §FR-146, §FR-150]
- [x] CHK015 Are cross-Provider duplicate conflicts discoverable/resolvable by Staff without uniqueness override or incumbent disclosure? [Exception Coverage, Spec §FR-099, §FR-115; API Contract]

## Acceptance and Boundary Quality

- [x] CHK016 Are document policy changes, expiry, replacement, and badge/readiness effects objectively measurable across all projections? [Measurability, Spec §SC-014, §SC-020–021]
- [x] CHK017 Are wallet/bank authorization, normalization, manual decision, dedup, masking, and readiness outcomes measurable? [Measurability, Spec §SC-022–029]
- [x] CHK018 Are cardinality, successor, primary, re-authentication, notification, and concurrency outcomes measurable? [Measurability, Spec §SC-030–034]
- [x] CHK019 Are no-transfer/no-settlement/no-internal-wallet/no-public-eligibility boundaries consistent across requirements and out-of-scope text? [Consistency, Spec §FR-052–054, §FR-083–087, §Out of Scope]
- [x] CHK020 Are authoritative country, legal-name, Media, Authentication, Customer, Configuration, and Admin Audit dependencies explicit and ownership-safe? [Dependency, Spec §FR-021–022, §FR-070–077, §Dependencies]

## Notes

- This checklist evaluates whether the English/API contract is implementable without inventing product behavior.
- Validation 2026-08-13: PASS, 20/20. The document invalidation ambiguity was reconciled so only approved versions are invalidated; Staff conflict resolution is closed without uniqueness override; route/DTO/version/error/readiness/phase boundaries are explicit in the API and transaction contracts.
