# Security Requirements Quality Checklist: R1-P06

**Purpose**: Formal author/reviewer gate for payout cryptography, reveal, privacy, audit, and operational-security requirement quality.
**Created**: 2026-08-13
**Feature**: [spec.md](../spec.md)
**Depth**: High-risk formal documentation gate; evaluates written requirements, not implementation behavior.

## Requirement Completeness

- [x] CHK001 Are all recoverable protected fields explicitly enumerated and are allowed plaintext routing/mask facts bounded? [Completeness, Spec §FR-140–142]
- [x] CHK002 Are encryption algorithm, key size, nonce uniqueness, authentication tag, and authenticated-context dimensions all specified? [Completeness, Spec §FR-140–142]
- [x] CHK003 Are lookup canonical identities, domain separation, key separation, and prohibited fingerprint uses completely defined? [Completeness, Spec §FR-143–144]
- [x] CHK004 Are Owner, Admin, ordinary Staff, reveal Staff, history/audit, and public projection boundaries all documented? [Coverage, Spec §FR-145–155]
- [x] CHK005 Are allowed and denied reveal audit fields, pre-return persistence, accepted-reveal limit, and failure behavior specified? [Completeness, Spec §FR-150–157]
- [x] CHK006 Are startup, readiness, overlap, migration, zero-reference verification, and human retirement requirements complete for both key rings? [Completeness, Spec §FR-158–165]

## Requirement Clarity and Consistency

- [x] CHK007 Is AES-GCM context binding unambiguous about Provider, chain/destination, exact version, type, field, and key version? [Clarity, Spec §FR-140–142]
- [x] CHK008 Is wallet dedup clearly independent of operator and consistent with the HMAC canonical identity? [Consistency, Spec §FR-099, §FR-143]
- [x] CHK009 Are exact Mobile Wallet and IBAN masking rules unambiguous and consistent across ordinary response requirements? [Clarity, Spec §FR-100, §FR-116, §FR-147–149]
- [x] CHK010 Is “five per rolling 10-minute window” clearly limited to accepted reveals and separated from the five-minute step-up age? [Clarity, Spec §FR-151, §FR-157]
- [x] CHK011 Are write-only Provider identifiers consistent for create/update responses and all later DRAFT/terminal reads? [Consistency, Spec §FR-145–149]
- [x] CHK012 Is the holder-name all-or-omitted rule consistent with Owner management, Admin omission, and Staff reveal? [Consistency, Spec §FR-146, §FR-149–150]

## Scenario and Failure Coverage

- [x] CHK013 Are wrong/missing historical key, decrypt/authentication failure, audit failure, proof failure, and rate failure all required to fail closed without fallback disclosure? [Exception Coverage, Spec §FR-153–156, §FR-159, §FR-164]
- [x] CHK014 Are concurrent reveals and retry attempts covered so request changes cannot bypass the durable accepted limit? [Concurrency Coverage, Spec §FR-154–157]
- [x] CHK015 Is duplicate protection during partial HMAC rotation explicitly required across every enabled lookup-key version? [Recovery Coverage, Spec §FR-160–163]
- [x] CHK016 Is bounded, resumable rotation specified without changing business lifecycle/version/readiness truth? [Recovery Coverage, Spec §FR-160–163; Plan Security Design]
- [x] CHK017 Are key retirement and configuration rollback boundaries explicit enough to prevent premature deletion? [Safety, Spec §FR-162–165]

## Acceptance and Dependency Quality

- [x] CHK018 Can the protected-persistence, equality, reveal, configuration, rotation, and recovery criteria be objectively measured? [Measurability, Spec §SC-035–042]
- [x] CHK019 Are external secret injection, no-default behavior, and Release 3 cloud-secret-manager deferral documented consistently? [Dependency, Spec §FR-158–165, §Out of Scope]
- [x] CHK020 Are logs, errors, audit, history, notifications, examples, and public responses all covered by explicit non-leakage requirements? [Coverage, Spec §FR-066, §FR-138, §FR-154–155, §FR-166]

## Notes

- Mark complete only after the cited requirement and planning artifact together provide an objective, non-conflicting answer.
- Validation 2026-08-13: PASS, 20/20. Exact field envelopes, HMAC identities, masks, role projections, audit-before-return, accepted reveal serialization, fail-closed configuration/recovery, and bounded human-approved rotation are fully specified in FR-140–166 and `security-design.md`.
