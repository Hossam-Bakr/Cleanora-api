# R1-P06 Implementation Handoff Prompt

> **Prepared handoff only. Do not execute this prompt until the human owner explicitly authorizes R1-P06 implementation.** The documentation workflow that created it stops before T001.

You are Cursor Auto implementing the sole active Cleanora phase:

`R1-P06 — Provider Verification & External Payout Destinations`

Repository: `D:\new_repos\Cleanora_R1`

## Authority and Required Reading

Read in this exact order before editing:

1. `AGENTS.md`
2. `docs/ai/context-router.md`
3. `docs/product/current.md`
4. `docs/product/vision.md` only where routed for R1-P06
5. `docs/product/decision-log.md` DEC-003, DEC-014, DEC-036, and DEC-037
6. `docs/product/open-questions.md` OQ-009 and OQ-011 boundaries
7. `docs/product/roadmap.md` R1-P06 only
8. `specs/R1-P06-provider-verification-external-payout-destinations/spec.md`
9. every R1-P06 planning artifact:
   - `plan.md`
   - `research.md`
   - `data-model.md`
   - `migration-plan.md`
   - `security-design.md`
   - `ux-design.md`
   - `test-strategy.md`
   - `operations-runbook.md`
   - `quickstart.md`
   - all files under `contracts/`
   - all files under `checklists/`
10. `tasks.md`
11. the smallest matching repository rules/skills routed by `docs/ai/context-router.md`

Canonical product documents and the clarified specification override plan/tasks/UX references if any future drift is discovered. Stop and report a contradiction rather than choosing silently.

## Objective

Implement tasks T001–T137 in dependency order and satisfy all 166 functional requirements, 42 success criteria, 10 user stories, migration/security/privacy gates, and Definition of Done without adding later-phase behavior.

Use the existing TypeScript 6 / Node 24 / Express 5 / Prisma 7 / PostgreSQL modular monolith. Extend the existing Providers module; do not create a new deployable or generic business module.

## Locked Product Rules

- Provider-specific work starts only after application `APPROVED`; operational suspension permits authorized remediation/review.
- `INDIVIDUAL_TEAM` has no document requirement: `documentsVerified = NOT_REQUIRED`, satisfied; badge `NOT_ELIGIBLE`.
- `REGISTERED_COMPANY` uses the current immutable effective-dated country/kind policy. The initial EG baseline contains exactly required `COMMERCIAL_REGISTRATION` and `TAX_REGISTRATION`.
- Exact active Provider `OWNER|ADMIN` manage Company document drafts/evidence/submission/history. Only capable active Staff Admin decides verification.
- Evidence is exactly one private PDF <=15 MiB and <=10 pages, or 1–10 ordered JPEG/PNG pages <=5 MiB each and <=20 MiB total. `image/jpeg` includes `.jpg` and `.jpeg`. Media verifies signatures/decoded content, malware/safety, PDF restrictions, orientation/metadata, and READY status.
- Submitted document metadata/evidence is immutable. Corrections/renewals/replacements create linked successors; voluntary continuity and Staff challenge/expiry follow the exact matrix.
- Only exact active Provider Owner mutates payout destinations/primary. Provider Admin receives the smaller masked read-only projection with no holder name.
- Support only `MOBILE_WALLET` and IBAN-first `BANK_ACCOUNT`. Operator/bank values come from active country-scoped registries; never infer/free-text them. Do not request redundant account/branch/SWIFT fields.
- Do not request or accept wallet/bank ownership-evidence files.
- Staff manual verification happens outside Cleanora. Do not integrate a bank/wallet rail, send verification money, complete a transfer, execute/schedule/reconcile a payout, or persist settlement.
- Use the exact nine-state payout matrix, at most five active chains, one open successor, and at most one global current approved primary. No unrelated auto-failover.
- Owner submission/successor submission/primary/withdrawal/removal use Authentication-owned re-authentication no older than 10 minutes.
- Every full payout identifier and holder legal name is AES-256-GCM encrypted before persistence with a unique field nonce and canonical AAD. No plaintext column or fallback exists.
- Duplicate identity uses only the separate versioned domain-separated HMAC-SHA-256 key ring; wallet identity excludes operator. Compare every enabled lookup key during rotation.
- Provider identifiers are write-only and exactly masked after write, including DRAFT. A changed value requires complete re-entry.
- Full reveal is one exact `PENDING_VERIFICATION` version for capable Staff after a <=5-minute purpose/request-bound step-up and meaningful reason. The exact version lock and actor-serialized accepted audit commit in one short transaction before a non-cacheable plaintext response. Maximum five accepted reveals per Staff actor in a rolling 10 minutes. No bulk/export/reuse/approved/terminal reveal.
- Four external key-ring settings have no default; readiness fails closed for malformed/weak/reused/missing/inconsistent keys. Rotation is bounded/resumable and retirement needs zero references plus explicit human approval.
- Safe immutable history/audit/outbox may contain only allowlisted IDs, versions, state/method/reason, timestamps, approved masks where allowed, request IDs, and non-secret key IDs where required. Never include document bytes/keys, full identifiers/names, ciphertext, nonce/tag, fingerprint, proof, token, raw body, or key material.
- R1-P06 can update only `documentsVerified` and `payoutDestinationReady`. It cannot make the Provider `LIVE`, public, payable, or finally marketplace eligible.

## Module Ownership

- Providers owns R1-P06 business policy, persistence, transactions, chains/versions, decisions/history, readiness/badge, primary, conflicts, outbox intents, and rotation progress.
- Media owns file bytes, validation receipts, processing, storage keys, Cloudinary lifecycle, cleanup, and signed private delivery.
- Authentication owns identity/session/capability and recent-proof/step-up facts.
- Customers owns authoritative company and Owner legal names.
- Configuration owns generic active country/currency facts.
- Admin owns generic privileged/denial audit and the transaction-participating reveal audit/rate gate.

Use public contracts only. Never query/mutate a foreign module's Prisma model from Providers. Keep external/slow I/O outside database transactions.

## Execution Rules

1. Snapshot the current status/diff and preserve all pre-existing human work. Do not reset/revert/reformat/stage unrelated files.
2. Work from `tasks.md` T001 upward. Mark a task checked only after its exact implementation and proportional validation pass.
3. Write each story's focused tests before implementation and establish the expected failure without weakening the assertion.
4. Use exact expected versions, stable command IDs, database constraints/locks, and matching-retry idempotency. No in-memory-only concurrency guarantee.
5. Create the phase-owned forward migration only; never edit an applied migration or use destructive `db push`/reset.
6. Review SQL before applying. Database commands require an explicitly named disposable isolated target. Never connect to an ambiguous, shared, historical, or production database.
7. Use synthetic operator/bank fixtures. Do not invent a production Egypt registry manifest. Treat the approved manifest as a human-controlled pre-launch prerequisite.
8. Establish the initial EG document policy only through the human-invoked active-Staff/reason/effective-time bootstrap using the same policy service; never fabricate publication provenance in migration SQL.
9. Keep runtime OpenAPI and Postman inventory exactly aligned with implemented operations and use synthetic examples only.
10. Run database-backed suites sequentially unless each worker has a genuinely isolated database.
11. Record exact commands, exit codes, test counts, migration evidence, privacy scan, and limitations truthfully in the phase implementation evidence.

## Required Validation

Follow `test-strategy.md` and `quickstart.md`. At minimum, after focused gates:

```text
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:coverage
npm run db:validate-clean-migration   # disposable isolated DB only
npm run openapi:validate
npm run postman:validate
npm run docs:check
npm run build
```

Also prove clean R1-P05 upgrade compatibility, constraint/concurrency behavior, exact masks, no plaintext persistence, forced audit-before-return failure, six concurrent reveal behavior, mixed-key rotation/resume/retirement, `.jpg`/`.jpeg` acceptance, and the forbidden-sentinel scan.

## Hard Stops

This implementation authorization, if later granted, still does not authorize:

- Git branch creation/switching, staging, commit, push, merge, force-push, or history rewriting unless separately authorized by the repository's exact Git phrase;
- deployment, production migration, production secrets/configuration, real operator/bank credentials, or live external-provider actions;
- destructive database/filesystem actions;
- phase completion without explicit human approval;
- R1-P07 or any later phase;
- Docker/cloud work before Release 3.

If an authoritative operator/bank manifest, safe isolated DB, malware scanner capability, retained key, legal-name fact, or product decision is missing, continue all other safe in-scope work, document the exact blocker, and stop before inventing or bypassing it.

## Handoff Result

When implementation tasks and validations are genuinely complete, report:

- tasks completed and any blocked task IDs;
- exact files/schema/migration/API changes;
- exact validation evidence and environment limits;
- privacy/key/rotation/audit/concurrency evidence;
- confirmation that no payout execution, internal wallet, future phase, Git, deployment, or production operation occurred;
- readiness for independent review and human decision, not automatic phase completion.
