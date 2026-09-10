# API & security checklist — R1-P12

- [x] Optional auth: missing token allowed; invalid token rejected
- [x] No trusted client-supplied actor ids or eligible id lists
- [x] Contact-free allowlist enforced in tests (forbidden markers)
- [x] Rate limit guest list/detail (reuse existing limiter patterns if available)
- [x] Signed media URLs expire; no raw storage keys
- [x] OpenAPI security schemes document optional bearer correctly
- [x] Postman assertions cover 200 guest happy path + validation + not-found
- [x] Error envelope matches API standard
- [x] No secrets in collections or examples
