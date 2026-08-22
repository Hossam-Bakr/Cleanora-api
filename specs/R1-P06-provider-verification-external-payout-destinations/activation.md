# R1-P06 Activation — Provider Verification & External Payout Destinations

**Activated:** 2026-08-13
**Authorized by:** Human product owner in the active Codex task
**Status:** **Complete**
**Completed:** 2026-08-14
**Feature directory:** `specs/R1-P06-provider-verification-external-payout-destinations`

## Activation evidence

- R1-P05 is Complete with tasks T001–T159 closed, independent review `PASS`,
  and human completion authorization recorded.
- The R1-P05 handoff commit was pushed and merged into remote `main`; the local
  R1-P05 tree and merged remote tree were verified as identical before this
  activation.
- The worktree was clean before R1-P06 activation.
- `docs/product/current.md` recorded no active phase before this activation.
- No R1-P06 feature directory or specification existed before this run.
- R1-P06 is now the sole active roadmap phase.

## Authorized work (historical initial activation)

The human message `ACTIVATE R1-P06 AND RUN SPECKIT SPECIFY ONLY` authorizes only:

1. Canonical reconciliation for the approved R1-P06 product baseline.
2. Activation of R1-P06 in the current-phase pointer and roadmap.
3. Creation and specification-stage validation of `spec.md`.
4. Creation and validation of `checklists/requirements.md`.
5. Updating `.specify/feature.json` to this exact feature directory.
6. Running the mandatory SpecKit Companion `after_specify` hook.
7. Reporting the specify-only result and stopping before clarification.

## Approved product baseline

- Provider ownership and administration use Provider-domain `OWNER` and
  `ADMIN` membership. The approved product model has no `PROVIDER_OWNER`
  account category or global role.
- `INDIVIDUAL_TEAM` requires no verification documents. Its
  `documentsVerified` readiness gate is `NOT_REQUIRED`, is satisfied, and does
  not affect `profileCompletion`.
- `REGISTERED_COMPANY` initially requires exactly two configurable document
  types: `COMMERCIAL_REGISTRATION` and `TAX_REGISTRATION`.
- R1-P06 supports exactly two external payout-destination types:
  `MOBILE_WALLET` and `BANK_ACCOUNT`.
- Card destinations, InstaPay, payout execution, settlement scheduling,
  internal wallets, stored balances, and ledger balances are excluded.
- R1-P06 may update only the existing `documentsVerified` and
  `payoutDestinationReady` gates. It cannot make a Provider operationally
  `LIVE` or publicly browseable.
- Private contacts, documents, full payout details, storage keys, and raw
  secrets remain private and excluded from public surfaces and general logs.

## Initial canonical reconciliation completed

- DEC-037 records the approved R1-P06 baseline and the specification-only
  activation boundary.
- OQ-007 is resolved with the kind-specific document checklist above.
- OQ-011 is partially resolved with the two supported destination types; the
  payout and settlement schedule remains open for a later execution phase.
- The R1-P06 roadmap section now excludes cards, InstaPay, money movement, and
  internal balances and names the inherited readiness gates.
- The current-phase pointer identifies R1-P06 as active for specification only.

## Inherited ownership and public-contract boundaries

- Providers owns Provider-document associations, verification workflow and
  truth, verification history, payout-destination lifecycle, primary-policy
  enforcement, and the two R1-P06 readiness projections.
- Media continues to own `media_files`, upload/storage lifecycle, processing,
  storage keys, and private delivery. Providers must use a Media-owned public
  contract and must not query or mutate Media persistence directly.
- Authentication continues to own account identity, activity, session
  capability, and global staff authorization. Providers consumes those facts
  through an Authentication-owned public contract.
- Configuration continues to own active-country and applicable configuration
  facts. Providers must not query Configuration persistence directly.
- Admin audit continues to own the business-neutral privileged-audit surface;
  Provider-owned domain history and privileged audit remain distinct.
- Customers continues to own Company profile facts. Any new regulatory fact
  required across the boundary must be exposed through an approved public
  contract rather than direct persistence access.

## Historical clarification queue

The specification preserves the following decisions for the separately
authorized `speckit-clarify` stage, where exactly one question will be asked and
persisted at a time:

1. Privileged document-review and payout-verification authority.
2. Timing relative to provider-application approval.
3. Document configuration, country applicability, and retroactivity.
4. Commercial Registration and Tax Registration metadata.
5. Upload formats, limits, page rules, and safety validation.
6. Document lifecycle, expiry, replacement, concurrency, and retry behavior.
7. Verification-badge timing and visibility boundary.
8. Mobile Wallet and IBAN-first Bank Account field schemas and type-specific
   manual Staff verification; neither destination type accepts an uploaded
   ownership-evidence file.
9. A maximum-five-chain immutable destination lifecycle, one explicit global
   primary, risk-aware replacement continuity, recent Owner re-authentication,
   safe durable notifications, and the final transition matrix.
10. AES-256-GCM protection for recoverable payout fields, a separate versioned
    HMAC-SHA-256 duplicate-lookup key ring, exact Owner/Admin masks and views,
    purpose-bound five-minute-step-up Staff reveal with audit-before-return and
    a five-per-10-minute actor limit, fail-closed Release 1 external key-ring
    configuration, and resumable human-approved key rotation. Private document
    files remain Media-owned.

## Explicitly unauthorized in the initial specify-only run

- `speckit-clarify`, including asking or persisting any clarification answer.
- `speckit-plan`, research, data model, contracts, quickstart, or `plan.md`.
- `speckit-tasks`, `speckit-analyze`, or implementation prompts.
- Product code, tests, Prisma/schema changes, migrations, seeds, or database
  access.
- Git branch creation or switching, staging, commit, push, merge, force-push,
  or history rewriting.
- Deployment, production migration, credentials, provider configuration, or
  external-provider actions.
- R1-P07 or later phase activation or implementation.

## Subsequent documentation authorization and result

After the original specify-only activation, the human owner separately
authorized clarification, technical planning, mandatory Companion captures,
focused checklists, tasks, consistency analysis/remediation, and an
implementation handoff, with a hard stop before implementation.

- All 12 material clarification decisions are approved and canonical.
- `plan.md` and all plan-owned research/data/API/security/UX/migration/test/
  operations artifacts are complete.
- The mandatory after-plan and after-tasks hooks succeeded.
- The general requirements checklist is 25/25 and four focused checklists are
  80/80, for 105/105 checked quality items.
- `tasks.md` contains continuous T001–T137 across all 10 stories.
- `speckit-analyze` iteration 2 is clean with 208/208 requirement keys covered.
- `implementation-prompt.md` was used for the subsequently authorized implementation; T001–T137 are complete, including the approved disposable clean/upgrade database proofs and final current-phase validation handoff.

## Completion gate

Implementation was separately authorized and all T001–T137 tasks are complete.
The explicitly approved local disposable R1-P06 database proved clean
install, populated R1-P05 upgrade compatibility, seed idempotency, constraints,
five-destination enforcement, and reveal serialization; the temporary server is
stopped and its evidence directory retained. T136 first updated the current-
phase pointer to request human validation, and the implementation Companion
hook recorded `implemented` with 137/137 tasks. On 2026-08-14, the human product
owner then explicitly approved R1-P06 as Complete. The terminal Companion hook
records `completed`. Git actions, deployment, production configuration or
migration, destructive operations, and R1-P07 activation remain unauthorized.
