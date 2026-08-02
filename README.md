# Cleanora Backend

Cleanora is a standalone marketplace for professional home cleaning and
housekeeping services. This repository contains its TypeScript API, PostgreSQL
schema, Prisma migrations, authentication system, tests, and API documentation.

The backend is one deployable modular monolith: straightforward to run today,
while preserving clear module ownership for later booking, provider,
notification, payment, and operations capabilities.

## Current capabilities

- Versioned Express REST API under `/api/v1`
- PostgreSQL with Prisma 7 and additive migrations
- Country, currency, and effective-configuration foundations
- Email-based signup verification for all self-signup categories
- Password login, rotating refresh sessions, logout, and logout-all
- Current-user bootstrap through `GET /auth/me`
- Password recovery, reset, and authenticated password change
- Google OpenID Connect sign-in, linking, and unlinking
- Suspended and banned identity enforcement
- Request IDs, secure headers, CORS, validation, and rate limiting
- Morgan HTTP access logs and secret-redacting application logs
- OpenAPI 3.1 and interactive Swagger documentation

Phone ownership verification and a real SMS provider are intentionally deferred
to R1-P26. Google identities with a Google-verified email do not enter a phone
verification gate in the current approved contract.

## Architecture

The normal request path is intentionally short:

```text
src/routes/index.ts
  -> module route
  -> controller
  -> service
  -> Prisma repository
```

```text
src/
├── app.ts                 Express middleware and route composition
├── server.ts              Environment, database, HTTP server, shutdown
├── config/                Environment validation and constants
├── database/              One Prisma client and lifecycle
├── middlewares/           Global HTTP middleware
├── modules/
│   ├── admin/             Audit behavior
│   ├── authentication/    Authentication HTTP and business logic
│   └── configuration/     Country/configuration behavior
├── integrations/          Current email, Google, crypto, JWT, rate-limit adapters
├── routes/                The complete visible route map and system routes
├── shared/                Small business-neutral errors, responses, utilities
└── swagger/               OpenAPI document and Swagger router
```

`app.ts` exports an Express application and never opens a port. `server.ts`
creates a Node HTTP server with `createServer(app)`, which is the future
attachment point for Socket.IO without redesigning Express.

See [docs/architecture/modular-monolith.md](docs/architecture/modular-monolith.md)
for the concise architecture and extension guide.

## API surface

### System and documentation

| Method | Path |
|---|---|
| GET | `/api/v1/system/health/live` |
| GET | `/api/v1/system/health/ready` |
| GET | `/api/v1/system/health/database` |
| GET | `/api/v1/docs` |
| GET | `/api/v1/docs/openapi.json` |

### Authentication

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/auth/signup` | Create a self-signup identity |
| POST | `/api/v1/auth/account-categories` | Enroll an authenticated category |
| POST | `/api/v1/auth/otp/request` | Request or resend verification |
| POST | `/api/v1/auth/otp/verify` | Verify the submitted code |
| POST | `/api/v1/auth/login` | Create a password session |
| POST | `/api/v1/auth/refresh` | Rotate the refresh session |
| POST | `/api/v1/auth/logout` | Revoke the current session |
| POST | `/api/v1/auth/logout-all` | Revoke all user sessions |
| GET | `/api/v1/auth/me` | Return the safe current user |
| POST | `/api/v1/auth/password/forgot` | Start recovery safely |
| POST | `/api/v1/auth/password/reset` | Complete password reset |
| POST | `/api/v1/auth/password/change` | Change an authenticated password |
| GET | `/api/v1/auth/google` | Return Google authorization information |
| GET | `/api/v1/auth/google/browser` | Start the browser OAuth flow |
| GET | `/api/v1/auth/google/callback` | Handle the provider callback |
| GET | `/api/v1/auth/google/link` | Start authenticated Google linking |
| DELETE | `/api/v1/auth/social/google` | Unlink Google safely |

The OpenAPI document is the authoritative request/response reference. API
responses preserve the common envelopes:

```json
{
  "success": true,
  "data": {},
  "requestId": "request-identifier"
}
```

```json
{
  "success": false,
  "error": {
    "code": "STABLE_ERROR_CODE",
    "statusCode": 400,
    "message": "Safe description"
  },
  "requestId": "request-identifier"
}
```

## Local setup

Requirements: Node.js 24+, npm, PostgreSQL/Neon, SMTP credentials for email
flows, and Google OAuth credentials when Google sign-in is enabled.

```bash
npm ci
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate:deploy
npm run seed
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.
Never commit `.env` or print database URLs, JWT secrets, SMTP credentials,
passwords, OTPs, cookies, or tokens.

Local resources:

```text
API:      http://localhost:8000/api/v1
Swagger:  http://localhost:8000/api/v1/docs
OpenAPI:  http://localhost:8000/api/v1/docs/openapi.json
Health:   http://localhost:8000/api/v1/system/health/live
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run TypeScript locally |
| `npm run build` | Generate Prisma Client and compile production code |
| `npm run start` | Start `dist/server.js` |
| `npm run typecheck` | Check strict TypeScript |
| `npm run lint` | Run ESLint |
| `npm run test:unit` | Run fast unit tests |
| `npm run test:integration` | Run Express/PostgreSQL integration tests |
| `npm run test:coverage` | Run coverage thresholds |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run docs:check` | Validate documentation references |
| `npm run openapi:validate` | Validate OpenAPI |
| `npm run email:check` | Verify SMTP configuration without sending |

Automated database tests require an isolated approved test database and never
fall back to the normal `DATABASE_URL`.

## Deployment

For Railway:

- Build with `npm ci --include=dev && npm run build`.
- Start with `node dist/server.js`.
- Set the health check to `/api/v1/system/health/live`.
- Let Railway provide `PORT`; the server binds to `0.0.0.0`.
- Configure production CORS origins and secure cookies.
- Provide the complete database, authentication, SMTP, and optional Google
  environment groups shown in `.env.example`.
- Apply reviewed migrations as a controlled pre-deploy step.
- Never run development migrations, test seeds, or tests against production.

## Extending the monolith

### Add a normal module

Create only the files the capability needs:

```text
src/modules/example/
├── example.routes.ts
├── example.controller.ts
├── example.service.ts
├── example.repository.ts
└── example.schema.ts
```

Then mount its router explicitly in `src/routes/index.ts`. Do not add dynamic
discovery, a DI container, or placeholder files.

### Add Socket.IO later

Attach it to the `httpServer` created in `server.ts`. A single instance needs
no Redis. Horizontal Socket.IO scaling may later add a Redis adapter; socket
presence and critical notification state must not live only in memory.

### Add notifications later

Create `src/modules/notifications` only when its phase begins. Non-critical
notification delivery can react to committed domain events; authentication
must not contain notification business logic.

### Add Paymob later

Create `src/modules/payments` only in its owning phase. Paymob webhook handling
must verify HMAC signatures, be idempotent, tolerate duplicate delivery, use
database transactions, model explicit payment states, and trust webhooks
instead of frontend redirects.

## Security and ownership

- Passwords use Argon2.
- Refresh sessions rotate and are revocable.
- OAuth state is validated; provider tokens are never put in frontend URLs.
- Morgan never logs bodies, query strings, authorization headers, or cookies.
- Application log context recursively redacts authentication and personal data.
- PostgreSQL remains authoritative for identity and session state.
- No stored-value user wallet exists.

Cleanora is private software. No open-source license is granted unless a
license file is added explicitly.
