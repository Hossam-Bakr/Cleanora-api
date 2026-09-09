# API & Security Checklist: R1-P11

**Purpose**: Internal API, privacy, no-route, and consumer-projection checks.  
**Created**: 2026-09-09  
**Updated**: 2026-09-09 (repair)  
**Contracts**: [http-api.md](../contracts/http-api.md), [security-design.md](../security-design.md), [browse-consumer-contract.md](../contracts/browse-consumer-contract.md)

## Internal API (preparation-verifiable)

- [x] Public surface is in-process only via `eligibility.public.ts`. — Evidence: `http-api.md`, public contract
- [x] `evaluateEligibility`, `getStandardBrowseCandidates`, `purgeExpiredEvaluations` signatures frozen in Markdown TypeScript. — Evidence: `eligibility-public-contract.md`
- [x] Explicit-provider evaluation is separate non-HTTP entry; Browse forbids `providerIds`. — Evidence: DEC-079 contracts
- [x] Composition is the sole trusted wiring path. — Evidence: plan + browse contract
- [ ] Runtime exports and composition wiring exist. — Pending Batch A/F

## No-route / HTTP (preparation-verifiable design; runtime pending)

- [x] Zero new eligibility HTTP routes specified.
- [x] OpenAPI/Postman explicitly non-deliverables for eligibility evaluation.
- [ ] Boundary test asserts absence of eligibility route mounts (T006). — Pending Batch A
- [ ] OpenAPI unchanged for eligibility operations after implementation. — Pending Batch F/G

## Privacy & projection (preparation-verifiable design; runtime pending)

- [x] Browse projection allowlist frozen; omits exclusion diagnostics and member-level evidence. — Evidence: browse-consumer-contract
- [x] Persistence / diagnostics / projection / logs are **separate** allowlists. — Evidence: `security-design.md`
- [x] Worker IDs explicitly prohibited in persistence, diagnostics, projection, and routine logs. — Evidence: security-design + DEC-079
- [x] `eligibleForPublicBrowse: false` placeholder is not used as an exclusion filter (specified).
- [ ] Privacy negative tests pass (`privacy-negatives.test.ts`). — Pending Batch F
- [ ] Composed Browse integration proof passes. — Pending Batch F

## Authz misconceptions

- [x] Caller role strings / evaluation IDs are not treated as credentials (specified).
- [x] No “internal-secret” eligibility HTTP workaround (specified).

## Retention (preparation-verifiable design; runtime pending)

- [x] 30-day purge semantics: fixed cutoff, `(expiresAt, id)` order, batch 100/500, counts + `moreRemaining`. — Evidence: ops runbook + public contract
- [x] Rule versions retained across purge.
- [x] Logging emits safe operational metadata only (specified).
- [ ] Retention tests pass. — Pending Batch G

