# R1-P06 UI pages and API flows

This folder contains the complete visual handoff for **R1-P06 — Provider Verification & External Payout Destinations**. The screens use the implemented `/api/v1` contract and keep the Provider, System, and `STAFF_ADMIN` responsibilities separate.

## Recommended reading order

### Provider verification documents

1. `01-provider-verification-overview-api.png` — combined verification and payout-readiness overview.
2. `02-company-document-checklist-api.png` — effective company-document requirements and current versions.
3. `03-document-metadata-form-api.png` — document draft and structured metadata.
4. `04-document-evidence-manager-api.png` — private evidence upload, removal, and ordering.
5. `05-document-submit-successor-history-api.png` — submission, immutable versions, successors, and history.

### Staff document work

6. `06-staff-document-review-api.png` — Staff queue, exact-version dossier, and decisions.
7. `07-staff-document-policy-management-api.png` — effective-dated policy drafts and publication.

### Provider payout destinations

8. `08-payout-destinations-dashboard-api.png` — masked destination list and readiness.
9. `09-mobile-wallet-form-api.png` — Mobile Wallet draft contract.
10. `10-bank-account-form-api.png` — Bank Account and Egyptian IBAN draft contract.
11. `11-payout-submit-primary-remove-api.png` — re-authentication, submission, primary selection, and removal.
12. `12-payout-successor-history-api.png` — safe replacement continuity and immutable history.

### Staff payout work

13. `13-staff-payout-queue-api.png` — masked queue and masked exact-version dossier.
14. `14-staff-payout-reveal-decision-api.png` — step-up proof, reasoned one-time reveal, manual external check, and decision.
15. `15-staff-payout-conflict-resolution-api.png` — cross-Provider active-fingerprint conflict resolution.

### Full workflows

16. `16-full-document-verification-flow-api.png` — end-to-end document workflow.
17. `17-full-payout-destination-flow-api.png` — end-to-end payout-destination workflow.
18. `18-complete-r1-p06-phase-flow-api.png` — both independent tracks and the final R1-P06 readiness facts.

## Locked interpretation shown in the images

- R1-P06 opens only after the Provider application is `APPROVED`.
- Company documents and payout destinations are independent readiness tracks.
- `REGISTERED_COMPANY` requires the effective company-document policy; `INDIVIDUAL_TEAM` has documents `NOT_REQUIRED` and badge `NOT_ELIGIBLE`.
- Provider `OWNER` and `ADMIN` may administer documents, but only `STAFF_ADMIN` makes document decisions.
- Only the Provider `OWNER` mutates sensitive payout destinations. Provider `ADMIN` receives reduced masked read-only information.
- Wallet numbers and IBANs are masked immediately after every write. Provider-facing APIs never reveal the complete identifier.
- Staff reveal is one-response, exact-version, reasoned, step-up protected, and audited before plaintext is returned.
- Cleanora does not store the name displayed by the external wallet or bank during Staff's manual check.
- R1-P06 computes verification and payout-readiness facts; it does not make the Provider operational/public and it does not execute settlements.

The 15 operational screens collectively map all **37 implemented R1-P06 API operations**; the three workflow images repeat only the key operations needed to understand each flow.
