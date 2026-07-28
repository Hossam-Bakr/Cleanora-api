# Cleanora

> A trusted, operations-controlled marketplace for professional home cleaning
> and housekeeping services.

Cleanora connects customers with verified cleaning providers while giving
providers, workers, marketers, and Cleanora staff the tools required to manage
the complete service journey safely.

The platform is launching in Egypt with a country-aware foundation designed to
support additional markets later. Cleanora is a standalone greenfield product:
its application, database, migrations, APIs, tests, and operational rules are
owned entirely by this repository.

## Project status

| Area | Status |
|---|---|
| Product and database architecture | Complete |
| Project foundation and country configuration | Complete |
| Authentication and identity | In progress |
| Initial market | Egypt (`EG`) |
| Client strategy | Responsive web first |
| Backend architecture | TypeScript modular monolith |

The current implementation provides the platform foundation and the Release 1
authentication system. Booking, provider operations, payments, reviews,
support, marketer features, and other marketplace capabilities are delivered
incrementally through later roadmap phases.

## Product vision

Cleanora is designed as a controlled multi-sided marketplace for:

- Customers: individuals, companies, compounds, and engineers.
- Service providers: provider owners, teams, workers, supervisors, and provider
  administrators.
- Marketers: approved affiliates who refer eligible customers.
- Cleanora staff: administration, operations, support, and finance.

The backend remains authoritative for identity, eligibility, pricing, payment
state, order transitions, and financial records. Sensitive actions are
permission-controlled and auditable.

The broader product supports two service-discovery journeys:

- **Browse:** customers select an eligible service provider and schedule.
- **Recommended:** eligible providers can accept, reject, or counter a customer
  request before the customer confirms an offer.

Cleanora deliberately does not provide stored-value user wallets. Payments and
payouts use approved external rails, while the platform maintains auditable,
decimal-safe financial records.

## Implemented capabilities

### Foundation

- Versioned REST API under `/api/v1`.
- PostgreSQL database managed through incremental Prisma migrations.
- Country and currency configuration with deterministic global/country
  resolution.
- Structured success and error envelopes with request IDs.
- Readiness, liveness, and database health endpoints.
- Structured Pino request and application logging.
- Secure headers, credential-aware CORS, input limits, and rate limiting.
- Interactive Swagger UI and an OpenAPI 3.1 document.

### Authentication and identity

- Signup for the approved self-registration account categories.
- Six-digit verification challenges with bounded attempts and expiration.
- Email delivery through SMTP/Nodemailer.
- Development-only phone OTP delivery through a controlled email fallback.
- Phone/password login.
- Short-lived JWT access tokens.
- Rotating refresh sessions stored in an HTTP-only cookie.
- Current-user session bootstrap through `/auth/me`.
- Refresh, logout, and logout-all flows.
- Forgot-password, reset-password, and authenticated password change.
- Account-category enrollment with category-specific verification.
- Google browser sign-in for individual accounts.
- Secure OAuth state validation and allowlisted frontend handoff.
- Google account linking and unlinking.
- Required phone verification after Google sign-in.
- Suspended and banned identity enforcement.
- Enumeration-safe recovery behavior and privacy-aware error handling.

## Authentication overview

```text
Email/phone signup
    -> verification challenge
    -> OTP verification
    -> login
    -> access token + HTTP-only refresh cookie
    -> /auth/me

Google sign-in
    -> Google authorization
    -> backend callback
    -> allowlisted frontend callback
    -> refresh-cookie bootstrap
    -> required phone verification when incomplete
    -> full authenticated session
```

The browser never receives OAuth provider tokens in a redirect URL. Refresh
credentials remain in an HTTP-only cookie, and the frontend retrieves the safe
user representation through authenticated API calls.

## Architecture

Cleanora is one deployable modular monolith. Each business module owns its
behavior and persistence access and exposes an explicit public contract.

```text
src/
|-- config/          Environment validation and application configuration
|-- core/            Shared HTTP, logging, health, error, and security contracts
|-- integrations/    PostgreSQL, email, Google, SMS, logging, and security adapters
|-- modules/         Business modules and their public boundaries
|-- routes/          Approved module registration
|-- swagger/         Runtime OpenAPI and Swagger documentation
|-- app.ts           Express application composition
`-- server.ts        Process, database, and graceful-shutdown lifecycle
```

The current authentication module follows this dependency direction:

```text
HTTP -> Application -> Domain
                    -> Infrastructure adapters
```

Infrastructure details are not exported through the module's public API.
Cross-module behavior uses explicit contracts rather than importing another
module's internal files.

## Technology

| Concern | Technology |
|---|---|
| Runtime | Node.js 24+ |
| Language | TypeScript |
| HTTP framework | Express 5 |
| Database | PostgreSQL |
| ORM and migrations | Prisma 7 |
| Validation | Zod |
| Authentication | JWT, Argon2, HTTP-only cookies |
| Google authentication | OpenID Connect |
| Email | Nodemailer with SMTP |
| Logging | Pino |
| Testing | Vitest, Supertest, V8 coverage |
| API documentation | OpenAPI 3.1 and Swagger UI |

## Getting started

### Prerequisites

- Node.js `24` or later
- npm
- PostgreSQL or a Neon PostgreSQL database
- SMTP credentials when testing email delivery
- Google OAuth credentials when testing Google sign-in

### 1. Install dependencies

```bash
npm install
```

### 2. Create the local environment

Copy `.env.example` to `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

Git Bash:

```bash
cp .env.example .env
```

Provide real local values for the required database, JWT, authentication,
SMTP, CORS, and optional Google variables. Never commit `.env`, database URLs,
provider credentials, JWT secrets, passwords, OTPs, or access tokens.

### 3. Prepare the database

```bash
npm run prisma:generate
npm run prisma:migrate:deploy
npm run seed
```

Use only an approved non-production database during local development. Review
every migration before applying it. Never edit an already-applied migration.

### 4. Start the server

```bash
npm run dev
```

The default local API address is:

```text
http://localhost:8000/api/v1
```

## API documentation

With the server running:

| Resource | URL |
|---|---|
| Interactive Swagger UI | `http://localhost:8000/api/v1/docs` |
| OpenAPI 3.1 JSON | `http://localhost:8000/api/v1/docs/openapi.json` |
| Liveness | `http://localhost:8000/api/v1/system/health/live` |
| Readiness | `http://localhost:8000/api/v1/system/health/ready` |
| Database health | `http://localhost:8000/api/v1/system/health/database` |

The API uses a consistent success envelope:

```json
{
  "success": true,
  "data": {},
  "requestId": "request-identifier"
}
```

Failures use stable machine-readable error codes:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "statusCode": 400,
    "message": "Safe description",
    "details": {}
  },
  "requestId": "request-identifier"
}
```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Compile the production application |
| `npm run start` | Start the compiled application |
| `npm run typecheck` | Validate TypeScript types |
| `npm run lint` | Run ESLint |
| `npm run test:unit` | Run unit tests |
| `npm run test:integration` | Run integration tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run test:coverage` | Run the complete coverage gate |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate:status` | Inspect migration status |
| `npm run docs:check` | Validate documentation references |
| `npm run openapi:validate` | Validate the OpenAPI document |
| `npm run email:check` | Safely verify SMTP configuration |
| `npm run db:check` | Check development database connectivity |

Automated database tests must use an isolated test database. They must never
fall back to the ordinary development or production database.

## Testing strategy

Cleanora separates tests by responsibility:

```text
tests/
|-- unit/          Domain policies, controllers, middleware, and adapters
|-- integration/   Database behavior, API contracts, and module composition
|-- e2e/           Critical user journeys
`-- helpers/       Test-only environment and application composition
```

Coverage thresholds are enforced globally:

- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

Tests must not weaken public contracts, hide uncovered code with exclusions, or
use the development database as an automated test target.

## Railway deployment

For a Railway service connected to GitHub:

- Use `npm ci && npm run build` as the build process. The npm `prebuild`
  lifecycle generates Prisma Client automatically before TypeScript compiles.
- Use `npm run start` as the start command.
- Configure `/api/v1/system/health/live` as the health-check path.
- Store every secret and connection string in Railway environment variables.
- Set production CORS origins and secure-cookie settings explicitly.
- Use a direct approved database connection for `prisma migrate deploy`.
- Apply reviewed migrations as a controlled release step.
- Do not run `prisma migrate dev`, test seeds, database reset, or test suites
  against the production database.
- Replace the development SMS-to-email fallback with a real SMS provider before
  production launch.

The deployed service must fail closed when required authentication, database,
email, or Google configuration is incomplete.

## Security principles

- Secrets and authentication credentials are never logged.
- Passwords are hashed with Argon2.
- Refresh sessions are revocable and rotate securely.
- OAuth state is validated before accepting callbacks.
- Google provider tokens are not exposed to the frontend.
- Input validation is performed at the HTTP boundary.
- Sensitive endpoints are rate-limited.
- Database errors are mapped to safe API errors.
- Privileged and authentication events are auditable.
- Production cookies require secure transport.

## Repository guide

| Area | Start here |
|---|---|
| Application startup | `src/server.ts` and `src/app.ts` |
| Authentication public API | `src/modules/authentication/index.ts` |
| Authentication structure | `src/modules/authentication/README.md` |
| Database | `prisma/schema.prisma` and `prisma/migrations/` |
| Current delivery status | `docs/product/current.md` |
| Product vision | `docs/product/vision.md` |
| Roadmap | `docs/product/roadmap.md` |
| API documentation | `docs/apis/` and `docs/swagger/` |
| Active phase evidence | `specs/R1-P02-complete-authentication-identity/` |

Generated output such as `node_modules`, `dist`, coverage reports, generated
Prisma Client files, local caches, and runtime-smoke data does not belong in
version control.

## Development governance

Cleanora is delivered phase by phase. Only one roadmap phase may be active at a
time, and every database-changing phase owns an incremental migration.

Phase completion requires:

- Implemented acceptance criteria
- Reviewed migration SQL
- Passing type, lint, build, API, and documentation gates
- Required unit, integration, and end-to-end evidence
- Independent review
- Explicit human-owner approval

Commits, deployments, production migrations, and phase completion remain
human-controlled actions.

## Ownership

Cleanora is currently a private, actively developed product. No open-source
license is granted by this repository unless a license file is added
explicitly.
