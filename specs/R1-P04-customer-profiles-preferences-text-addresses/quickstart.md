# Phase 1 Validation Guide — R1-P04

**Status:** Validation design under **DEC-031** and **DEC-033**. T001–T120
checked after validation (2026-08-08). Historical implementation review
**`CHANGES REQUIRED`**; historical first re-review **`BLOCKED`**; latest
independent re-review **`CHANGES REQUIRED`**. Live Cloudinary smoke **PASS**
with response-derived evidence
(`specs/R1-P04-customer-profiles-preferences-text-addresses/cloudinary-smoke-evidence.json`).
SC-008 concurrent 25×40 harness **PASS** (~37.7s; ≤2s ratio 0.976). Proof DB:
`cleanora_r1_p04_clean_proof`. Cleanora DB incident recorded — owner decision
required. Next gate: fresh independent read-only final re-review. Phase
**In Progress** — **not** Complete.

## Prerequisites

- Approved `spec.md` remains frozen product authority
- R1-P03A Complete; R1-P04 sole active planning phase
- Disposable test database only when implementation begins
- Customers runtime env must provide positive integer
  `PRIVACY_REQUEST_TERMINAL_RETENTION_DAYS` (no default)
- Media features require **DEC-033** Cloudinary env when composed:
  `MEDIA_STORAGE_PROVIDER=cloudinary`, Cloudinary credentials/folder/TTL,
  `MEDIA_IMAGE_MAX_BYTES=5242880`. **`MEDIA_STORAGE_ROOT` superseded.**

## Planning-time checks (now)

```bash
npm run docs:check
npm run prisma:validate
git diff --check
```

Parse `.spec-context.json` and the P04 OpenAPI YAML. Scan for stale AppConfig
retention keys, unresolved role mapping, alternate purge engines, unused
preference enums, and accidental `tasks.md` / `src/` / `prisma/` edits.

## Static validation (when implementation authorized)

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
npm run docs:check
npm run prisma:validate
npx prisma generate
git diff --check
```

## R1-P04 database commands (fail-closed — T113)

Never run raw `prisma migrate` or `npm run seed` against R1-P04 disposable targets
without explicit CLI URLs. The runner validates the database name, rejects
`Cleanora`, R1-P02 CI, and production-like targets, and never falls back to
`.env`.

```bash
# Supply all three URLs explicitly on the command line (never logged).
npm run r1-p04:migrate:deploy -- \
  --database-url="$DATABASE_URL" \
  --test-database-url="$TEST_DATABASE_URL" \
  --test-migration-database-url="$TEST_MIGRATION_DATABASE_URL"

npm run r1-p04:migrate:status -- \
  --database-url="$DATABASE_URL" \
  --test-database-url="$TEST_DATABASE_URL" \
  --test-migration-database-url="$TEST_MIGRATION_DATABASE_URL"

npm run r1-p04:seed -- \
  --database-url="$DATABASE_URL" \
  --test-database-url="$TEST_DATABASE_URL" \
  --test-migration-database-url="$TEST_MIGRATION_DATABASE_URL"
```

The runner prints only the parsed safe database name (for example
`cleanora_r1_p04_clean_proof`). Incident record:
`docs/ai/incidents/r1-p04-cleanora-database-incident.md`.

## Unit test matrix

| Area | Cases |
|---|---|
| FR-028 policy helper | ACTIVE verified / pending-only / suspended / banned / missing category |
| Profile field rules | Trim, blank reject, category isolation, unapproved fields |
| Preferences policy | Mandatory notices non-disableable; optional default off at row create; DEC-032 full-replace PUT (version + language AR/EN/null + all four booleans required; omit rejected); version start=1 / increment / stale conflict |
| Address validation | countryCode→active country_id; geo rejection; no default flag; version CAS |
| Privacy lifecycle | Legal transitions; terminal immutability; cancel PENDING only |
| Outcome codes | COMPLETED↔REQUEST_FULFILLED; REJECTED↔REQUEST_REJECTED; all other pairs rejected |
| Processor capability | Trusted `privacy.requests.process` accepted; missing/forged rejected |
| Privileged reassign | staff_admin + permission + reason only; other roles denied |
| Error mapping | Stable codes; no sensitive/storage-key leakage |
| Media safety | Multer single-file 5 MiB; Sharp WebP; Cloudinary always-replace; signed URL; no key/credential leakage; CAS; async cleanup |

## Integration / DB matrix

| Area | Cases |
|---|---|
| Profile CRUD | Individual/company/engineer; multi-category isolation; not-created |
| Image association | Add/replace/remove; Sharp/Cloudinary outside TX; failed upload/association/audit rollback; PENDING_UPLOAD/PENDING_DELETE cleanup; concurrent CAS; previous image preserved; always-replace (no hash) |
| Protected signed GET | Signed URL + metadata; explicit absence; no storage key/public_id; FR-035 no business audit on success |
| Contact-state | Verified email; unverified phone; absent contact; identity unchanged |
| Preferences | Unset language via `language: null`; AR/EN; required boolean matrix; omit rejected; concurrency version |
| Addresses | CRUD; ownership denial; peer list; unsupported/inactive country |
| Privacy requests | Submit idempotent; cancel; coexistence; claim/resolve/reassign |
| Retention | Missing/invalid env fails R1-P04 readiness; unrelated tooling without customers runtime does not require env; expiry hidden from reads; bounded startup+hourly sweep; audit rows preserved |
| Migration | Clean apply; FK Restrict/SetNull actions; partial unique active request; lifecycle CHECKs reviewed including CANCELLED ⇒ cancelled_at/terminal_at/purge_after NOT NULL and outcome_code/processor_id/processing_at IS NULL (cancel-from-PENDING only) |

## Authorization / security matrix

| Case | Expected |
|---|---|
| Historical `customer` role present or absent | No eligibility change |
| Client-forged owner/category/permission/processor/capability | No authority |
| Wrong-owner reads/writes | Ownership-safe denial |
| Pending-only shared image/address | Denied |
| Pending-only contact/preferences/privacy | Allowed for SELF |
| Processor without capability | Denied |
| Privileged reassign without staff_admin/permission/reason | Denied |
| Audit samples | No credentials/contacts/full addresses/signed URLs/export payloads/storage keys/public_ids |
| Transactional audit failure | Rolls back every FR-033 mutation family |

## E2E / acceptance matrix

| Criterion | Evidence |
|---|---|
| SC-005 | Executable P01–P20 cohort journey in `tests/integration/customers/sc005-cohort.test.ts`: fixed category/profile assignments, common starting state, profile + language + address journey; **assert ≥19/20 finish correctly within five minutes**; record command/result in `implementation-summary.md` during final validation (T069, T075) |
| SC-008 | Executable canonical exact 1,000-row / 25-lane×40 workload in `tests/integration/customers/sc008-manifest.ts` + `sc008-workload.test.ts`: validate leaf counts and expected outcomes; 10-minute steady-state measurement; **assert ≥95% complete within two seconds** (exclude signed-URL generation latency where locked); **fail when threshold missed**; record measured evidence in `implementation-summary.md` (T070, T071, T075, repair tasks) |
| SC-010 | Regression that `/auth/*` contracts unchanged |
| SC-014–SC-016 | Closed outcomes; processor/privileged paths; retention |
| SC-017–SC-019 | Eligibility loss retention; peer addresses; pending-only limits |

## Regression checks

- No `customer` role provisioning path introduced
- No `resource.self.read` / `resource.self.write` requirement
- No geospatial columns or accepted geo body fields
- No Docker/Testcontainers/queue/job-engine dependency
- No AppConfig key `privacy.request.terminal_retention_days`
- No `MEDIA_STORAGE_ROOT` (DEC-033)
- Module-boundary tests: customers does not import auth/media/admin repositories
- Applied migrations remain immutable

## Definition of Done (implementation gate — future)

- FR-001–FR-048 and SC-001–SC-019 evidenced
- Phase migration reviewed and clean-applied on disposable DB
- Independent implementation re-review PASS
- Human-owner Complete approval

Current repair gate: T001–T100 historical; **T101–T109** validated
(2026-08-08). Final post-tasks `/speckit.analyze` **`CLEAN`** (planning
evidence). Historical implementation review **`CHANGES REQUIRED`**; historical
first re-review **`BLOCKED`**; latest independent re-review **`CHANGES REQUIRED`**.
Next gate: fresh independent read-only implementation re-review. Phase **not**
Complete. Historical analyze/`CHANGES REQUIRED`/`BLOCKED` results preserved as
evidence.
