# UX and Accessibility Requirements Quality Checklist: R1-P06

**Purpose**: Author/reviewer gate for role/state visibility, reference reconciliation, accessibility, Arabic/RTL, responsive, and privacy UX requirement quality.
**Created**: 2026-08-13
**Feature**: [spec.md](../spec.md)
**Depth**: Standard reviewer gate using UX references as lowest authority.

## Information and Role Completeness

- [x] CHK001 Are overview requirements explicit for application prerequisite, both independent gates, badge truth, blockers, and later-phase non-eligibility? [Completeness, Spec §FR-043–050; UX Contract]
- [x] CHK002 Are Individual Team NOT_REQUIRED/no-upload and Registered Company checklist experiences distinctly specified? [Clarity, Spec §FR-004–007, §FR-044–045; UX Contract]
- [x] CHK003 Are document draft, upload-processing, READY, submission, Staff decision, successor continuity, expiry, and history states covered? [Scenario Coverage, Spec §FR-019–042; UX Contract]
- [x] CHK004 Are Owner mutation, Admin reduced masked read, Staff safe dossier, separate reveal, and public omission visibly distinct? [Coverage, Spec §FR-055–067, §FR-145–153; UX Contract]
- [x] CHK005 Are empty, blocked, pending, terminal, five-slot, one-successor, no-primary, and readiness-loss experiences defined? [Edge Coverage, Spec §FR-118–139; UX Contract]

## Form and State Clarity

- [x] CHK006 Are all Company metadata fields and PDF/image-set limits represented without implying direct public storage or mixed evidence? [Completeness, Spec §FR-024–026; UX Contract]
- [x] CHK007 Are wallet registry selection/no-prefix-inference/no-phone-verification and bank IBAN-first/no-redundant-fields requirements explicit? [Clarity, Spec §FR-089–117; UX Contract]
- [x] CHK008 Is Save Draft distinct from proof-bound Submit, and is complete re-entry required to change write-only identifiers? [Clarity, Spec §FR-121, §FR-134, §FR-145; UX Contract]
- [x] CHK009 Is create-time primary selection excluded and are all primary/removal/replacement warnings aligned to lifecycle truth? [Consistency, Spec §FR-129–135; UX Contract]
- [x] CHK010 Is manual external verification described without implying API integration, money movement, completed transfer, or settlement recording? [Consistency, Spec §FR-103, §FR-112; UX Contract]

## Privacy and Safety UX

- [x] CHK011 Are exact mask presentation, holder-name presence/omission, and role-specific safe history requirements unambiguous? [Clarity, Spec §FR-100, §FR-116, §FR-145–150]
- [x] CHK012 Is reveal clearly one exact pending version with reason, fresh step-up, accepted-audit gate, no bulk/export/reuse, and transient plaintext? [Coverage, Spec §FR-150–157; UX Contract]
- [x] CHK013 Is the accepted-reveal limit wording distinguished from denied-attempt audit and proof-age wording? [Clarity, Spec §FR-151, §FR-154, §FR-157]
- [x] CHK014 Are analytics/session replay/browser persistence/error-copy exclusions documented for sensitive input/reveal views? [Non-Functional Coverage, UX Contract]

## Accessibility, RTL, and Responsive Quality

- [x] CHK015 Are Arabic/English direction and LTR isolation requirements specified for E.164, IBAN, codes, and request IDs? [Accessibility, UX Contract]
- [x] CHK016 Are labels, associated errors, focus, keyboard operation, non-drag ordering, state announcements, and non-color cues covered? [Accessibility Completeness, UX Contract]
- [x] CHK017 Are accessible document-preview alternatives and safe screen-reader mask labels specified? [Accessibility Coverage, UX Contract]
- [x] CHK018 Are modal focus/destructive confirmation, mobile reading order, no-core-horizontal-scroll, and long-mask behavior addressed? [Responsive/Accessibility, UX Contract]

## Reference Consistency

- [x] CHK019 Are all known legacy image conflicts explicitly overridden by canonical Owner-only payout, IBAN-first, no create-primary, exact-mask, and independent-track requirements? [Conflict Resolution, UX Contract §Canonical Image Discrepancies]
- [x] CHK020 Is it explicit that attached/repository images do not define authorization, fields, endpoint paths, lifecycle, or readiness truth? [Authority/Traceability, UX Contract §Reference Inventory]

## Notes

- Completion means the written requirements are sufficient; it does not claim a frontend exists or has been visually tested.
- Validation 2026-08-13: PASS, 20/20. Provider/Staff states, exact role projections, Arabic/RTL, keyboard/focus/announcement behavior, responsive constraints, transient reveal safety, and all known legacy-image discrepancies are explicitly reconciled in `ux-design.md`.
