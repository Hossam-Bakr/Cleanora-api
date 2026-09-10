# Review resolution — R1-P12

Date: 2026-09-10  
Result: **All Phase 12 BLOCKER/MAJOR findings resolved**

| Finding | Severity | Resolution | Regression evidence |
|---|---|---|---|
| Fresh Eligibility `resultHash` invalidated page 2 | MAJOR | Frozen five-minute server snapshot bound to the signed full-context digest; cursor replay retained for retries | Bookings unit + Express pagination integration |
| Media signing/enrichment occurred before pagination | MAJOR | Text-only search enrichment; signed media only for returned page/detail; preview concurrency capped at 16 | Bookings + Provider projection tests |
| No real HTTP integration suite | MAJOR | Added actual Express router/service integration covering guest flow and negative cases | `tests/integration/bookings/browse-flow.test.ts` |
| Guest Provider list/detail had no rate limiter | MAJOR | Existing fail-closed limiter reused with HMAC-hashed IP subjects and explicit policies | HTTP integration 429/retry-after proof |
| OpenAPI/Postman were shallow and Postman validator ignored P12 | MAJOR | Added operation-specific schemas/errors/examples and executable Local/Hosted/runtime/assertion parity | `openapi:validate`, `postman:validate` |
| Dependency/Zod errors could become generic 500s | MAJOR | Stable Bookings error mapping for Catalog, Configuration, Eligibility, and Zod | Bookings service/controller unit tests |
| Runtime composition required Prisma binding too early | MAJOR | Runtime client passed into Configuration factories without connecting | 9-file / 47-test focused regression set |
| Eligibility internal error-helper import | MINOR | Re-exported and consumed through `eligibility.public` | Static module-boundary scan |
| Historical tests prohibited later authorized phases | MINOR | Preserved phase-specific protection assertions while allowing R1-P12 | P08–P10 boundary/OpenAPI tests |

| Combined-tree OVERFLOW still reached candidate rules / failed typecheck | MAJOR | Throw before candidate evaluation; remove dead OVERFLOW branches | `eligibility.rules.test.ts`, `npm run typecheck` |
| Pricing-policy public factory bound Prisma at construction | MAJOR | Lazy `getPrismaClient()` on first read | `r1-p09-configuration-public-contract.test.ts` |
| P11 follow-up branch coverage 72.47% | MAJOR | Added rule-bundle, SQLSTATE, and hash-canonical branch tests | `npm run test:coverage:r1-p11` 76.07% branches |

No finding was rejected without evidence. No Phase 12 or P11-follow-up BLOCKER or MAJOR remains.
The owner-authorized combined Git scope is now technically ready. This review staged, unstaged, committed, and pushed nothing; publication still requires exactly `commit and push`.
