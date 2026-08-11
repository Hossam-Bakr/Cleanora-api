# Integration Tests

Exercise the composed Express application, PostgreSQL boundaries,
authorization, migrations, and external adapter contracts. Use isolated test
databases and deterministic cleanup.

## Provider (R1-P05) fixtures

Provider suites use helpers under `tests/helpers/`:

- `provider-fixtures.ts` — Individual/Company/Staff/invitee and media metadata
- `provider-concurrency.ts` — barriers and mutual latches (no sleeps)
- `fake-provider-email.ts` — closed-template and one-shot invitation delivery fakes
- `fake-provider-media.ts` — opaque media lifecycle without Cloudinary

Always bind the approved isolated proof database URL. Never point Provider
integration suites at a production-looking database name or real SMTP/Cloudinary
credentials.
