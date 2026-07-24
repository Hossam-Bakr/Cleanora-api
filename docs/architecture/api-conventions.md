# API Conventions

- Use REST unless an approved Release 3 feature requires realtime behavior.
- Place versioned system endpoints under `${API_PREFIX}/system`; business routes
  belong to their module under the same configured API prefix.
- Validate params, query, and body with Zod before application logic.
- Controllers receive validated data and trusted identity context.
- Return stable response contracts, not Prisma records.
- Follow `docs/standards/api-response-and-errors.md` for every success and failure.
- Do not trust client prices, eligibility, payment status, actor IDs, or state transitions.
- Apply authorization and ownership checks server-side.
- Register signed webhook routes through the app's pre-parser `rawBodyRegistrars`; each attaches a narrow raw parser so verification receives untouched bytes. Ordinary module routes run after the global JSON parser.
