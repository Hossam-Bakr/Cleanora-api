# UX Contract and Reference Reconciliation — R1-P06

**Scope**: backend/frontend behavior contract only; this repository currently implements no R1-P06 frontend.
**Authority order**: canonical product docs and [spec.md](./spec.md), then this plan, then attached/repository images as non-authoritative visual references.

## Shared Experience Rules

- Document and payout work are independent after application approval.
- Every state/action is driven by server capability flags and stable codes; hiding a control is not authorization.
- R1-P06 gate satisfaction never says Provider `LIVE`, public, payable, or phase Complete.
- Ordinary views never receive full payout identifiers. Private document facts appear only in authorized document detail/review.
- Owner/Admin/Staff use distinct DTOs; the frontend must not receive a broad DTO and hide fields locally.
- Server errors remain safe and stable; the frontend localizes codes without interpolating submitted secrets.

## Provider Information Architecture

### 1. Verification overview

Show application prerequisite, `documentsVerified`, protected badge truth, `payoutDestinationReady`, safe blockers, and two independent navigation cards.

- `INDIVIDUAL_TEAM`: documents `NOT_REQUIRED`, badge `NOT_ELIGIBLE`, no upload CTA.
- `REGISTERED_COMPANY`: checklist based on current effective country/kind policy.
- Payout card is available to the active Owner after approval regardless of document completion; Admin receives read-only status.

API: `GET /providers/{providerId}/verification`.

### 2. Registered Company document checklist/detail

Show policy version/effective date, required type cards, current effective and candidate version states, history, and safe next action. Draft form fields:

- authoritative locked country;
- document number;
- legal name;
- issuer name;
- issue date;
- optional expiry.

Evidence uses exactly one PDF or 1–10 ordered JPEG/PNG images. `.jpg` and `.jpeg` are both `image/jpeg`. Display per-item processing state; submission remains disabled until the complete set is READY. Reorder offers buttons as well as drag. Submitted content is read-only; correction/renewal creates a successor and explains whether predecessor credit continues.

APIs: requirements, document list/detail/create/update, evidence add/remove/order, submit, successor, history.

### 3. Payout dashboard

Show active chain use `n / 5`, terminal history separately, exact mask, institution label, lifecycle, primary, successor state, and safe blockers.

- Owner: create/edit draft, submit, successor, remove/withdraw, select primary when legal.
- Admin: type/mask/status/primary/safe timestamps only; no holder name or mutation.
- Pending/draft cannot be primary.

APIs: options, list/detail, history.

### 4. Destination choice and draft

Only two choices exist.

**Mobile Wallet**: country locked; E.164 wallet entry; operator from active registry; full holder legal name; exactly one relationship. Do not infer operator, compare to Authentication phone, or require phone verification.

**Bank Account**: country locked; configured currency read-only; bank from active registry; normalized IBAN; full holder legal name; relationship. Do not ask for domestic account number, branch, or caller-entered SWIFT/BIC.

Both forms distinguish Save Draft from Submit. After any write, display only the exact mask; changing identifier requires explicit complete re-entry. Neither form uploads ownership evidence or offers “make primary.” Submission requires fresh Owner re-authentication and enters PENDING_VERIFICATION.

### 5. Primary, replacement, and removal

- First approval becomes primary only if none exists.
- Later unrelated approvals need explicit Owner primary selection.
- Voluntary successor explains that unchallenged approved predecessor remains effective through review.
- Staff challenge explains immediate readiness/primary loss and no automatic failover.
- Removing a primary when another approved destination exists requires choosing the replacement in the same confirmation.
- Removing the last approved primary requires explicit acknowledgement, fresh re-authentication, and a warning that readiness becomes unsatisfied.

### 6. Provider history

Show safe type/mask/state/primary/reason/timestamp/actor-category events. Never show holder name, full identifier, fingerprint, encryption envelope, proof, or key IDs not expressly needed.

## Staff Information Architecture

### Document queue and dossier

Oldest eligible submissions first with filters, exact version, metadata, policy snapshot, ordered private Media delivery, predecessor/effective context, and required meaningful decision reason. Actions are exact-version approve, reject, request replacement, and approved-version invalidate.

### Payout queue and safe dossier

Queue/detail is masked by default and omits holder name. Show type, institution, relationship, authoritative comparison-source availability, state, predecessor/primary context, and safe history.

### One-version reveal

Reveal is a separate write action. Require reason and fresh step-up; return one exact pending version only after accepted audit. Plaintext is transient, cleared on navigation/error/purpose completion, excluded from analytics/session replay/client persistence, and never bulk-selectable/exportable. Copy describes “five accepted reveals per 10 minutes”; the five-minute proof age is not a reusable reveal timer.

The externally displayed bank/wallet name is not stored. Staff records a safe match/mismatch/unverifiable reason code and bounded note without repeating names or identifiers.

### Decision

Require exact expected version, valid verification method, outcome, and meaningful note. Clearly state that the Staff member performs a manual beneficiary lookup or begins but does not complete an external transfer; Cleanora does not contact the rail, send money, or record settlement.

## Accessibility, Arabic/RTL, and Responsive Contract

- Page-level `dir=rtl` for Arabic and `dir=ltr` for English.
- E.164, IBAN, codes, request IDs, and machine tokens use isolated LTR spans (`bdi dir=ltr`) to prevent bidi confusion.
- Persistent labels; placeholders are examples only.
- Programmatically associated errors and first-invalid focus while preserving all API issues.
- Full keyboard use for steppers, tabs, radios, registry selects, upload/order controls, dialogs, decisions, and reveal.
- Move Up/Move Down alternatives for page ordering.
- Visible focus, practical pointer targets, no color-only state; text/icon/state code remain available.
- Live announcements for upload processing, submission, decision, readiness, and retry outcomes.
- Screen-reader mask labels such as “wallet ending 5678,” never hidden full values.
- Accessible evidence alternatives: safe filename, type, page count/order, and authorized open/download when inline preview is unavailable.
- Correct modal focus trap/return; explicit destructive confirmations.
- Desktop grids collapse to one logical reading order; core actions require no horizontal scrolling.
- Long masks preserve LTR order and exact grouping on narrow screens.
- Plaintext inputs/reveal use browser persistence/autocomplete controls where practical and are excluded from analytics/session replay.

## Canonical Image Discrepancies

| Reference behavior | Canonical correction |
|---|---|
| Legacy full flow labels payout creation OWNER/ADMIN | Only active exact Owner mutates; Admin has reduced masked status read. |
| Legacy company form omits `legalName`/`issuerName` and implies direct upload | All five metadata fields plus optional expiry; Media-owned staged private evidence. |
| Wallet/bank forms offer create-time primary checkbox | Draft/pending cannot be primary; first approval initializes only if absent. |
| Legacy bank form requests account number/branch/SWIFT | IBAN-first; no redundant fields when registry/IBAN suffice. |
| Images imply documents must finish before payout | Both tracks proceed independently after application approval. |
| Approximate masks | Exact algorithms in `security-design.md` govern. |
| Old flow endpoints | Contract artifacts, not mockup text, define routes. |
| “Verified/ready” appears equivalent to launch | R1-P06 gates do not grant LIVE/public/payable/final eligibility. |
| Staff reveal countdown looks reusable | Each reveal is one request; proof freshness does not create a reusable grant. |
| Staff mock says five attempts | Limit is five accepted reveals; denied attempts are audited. |
| Staff mock asks for externally displayed name | Do not persist the name; record safe outcome/note. |
| Payout ownership evidence implied | No wallet or bank ownership-evidence upload exists. |

## Reference Inventory

The nine attached images were hash-matched to the repository copies under `docs/design/r1-p06/`. Seven repository v2 images were also inspected. They support layout/state discussion only and are not API, authorization, schema, or lifecycle authority.
