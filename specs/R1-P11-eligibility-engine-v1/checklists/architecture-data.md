# Architecture & Data Checklist: R1-P11

**Purpose**: Ownership, transaction, determinism, and migration checks.  
**Created**: 2026-09-09  
**Updated**: 2026-09-09 (repair)  
**Refs**: [plan.md](../plan.md), [data-model.md](../data-model.md), [dependency-readers.md](../contracts/dependency-readers.md)

## Ownership (preparation-verifiable)

- [x] `eligibility` owns three tables and policies. — Evidence: `plan.md`, `data-model.md`, DEC-063
- [x] Providers/Catalog/Configuration retain fact ownership. — Evidence: `dependency-readers.md`
- [x] No Eligibility imports of foreign private services/repositories/Prisma (specified). — Evidence: contracts + boundary task T006/T020
- [x] Public entry is `eligibility.public.ts`. — Evidence: DEC-083 / T007

## Transaction & determinism (preparation-verifiable design)

- [x] One Eligibility-owned `RepeatableRead` transaction binds discovery, reads, and successful persistence. — Evidence: `plan.md`
- [x] Public factories expose opaque transaction-bound paths; bound readers must not nest txs (DEC-079). — Evidence: `dependency-readers.md`
- [x] Semantic equality excludes generated IDs, trace IDs, execution durations, and **persistence** timestamps; `evaluatedAt` remains semantic (DEC-081). — Evidence: public contract + test-strategy
- [x] Metadata includes rule checksum, input/evidence/result hashes, discovery scope. — Evidence: public contract
- [x] `evaluatedAt` captured once before retry loop. — Evidence: `plan.md`, DEC-081

## Crew / capacity (specified; runtime pending)

- [x] Crew preferences `all_male` / `all_female` / `any` specified.
- [x] Gender filter applies to cleaner aggregates only.
- [x] Escorts add no capacity units, still required available.
- [x] Capacity recomputed after crew filter and capped by simultaneous-Team limit.
- [x] Provider/Team eligibility algebra frozen (DEC-080). — Evidence: `reason-codes.md`
- [ ] Runtime implementation + tests prove the above. — Pending Batch D/E

## Performance (specified; runtime pending)

- [x] Seed gate disabled by default → `NOT_APPLICABLE`, port not called.
- [x] Enabled missing/insufficient/stale evidence → informational `NOT_EVALUATED`, not FAIL / not exclusion.
- [x] Enabled-gate below-threshold → `PERFORMANCE_GATE_FAILED` excludes Provider and Teams.
- [ ] Runtime enabled-gate fixtures pass. — Pending Batch D

## Bounds & failures (specified; runtime pending)

- [x] 500 / 5000 overflow → `EVALUATION_LIMIT_EXCEEDED` (no silent truncation).
- [x] Business exclusions continue; hard failures abort whole evaluation.
- [x] ≤3 transaction retries for recognised conflicts; same `evaluatedAt`.
- [x] P09 CONFLICT preserved as technical failure.
- [ ] Runtime overflow/retry tests pass. — Pending Batch E

## Migration (specified; runtime pending)

- [x] Migration name `r1_p11_eligibility_engine_v1`.
- [x] Physical types, XOR, partial uniques, required Provider summaries, no live provider/team FK documented (DEC-082).
- [x] Seed identity `r1-v1` / EG / `2026-09-09T00:00:00.000Z`; full immutable-field verify.
- [ ] Clean + populated-P10 upgrade proofs on disposable DBs. — Pending Batch G
- [x] Applied migrations never edited (policy).

