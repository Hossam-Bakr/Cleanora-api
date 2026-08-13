# Cleanora Postman API Workspace

This directory contains the generated, phase-scoped Postman collections for
the implemented Cleanora Release 1 backend surface.

## Available Collections

| Phase | Collection | Operations per environment | Documentation |
|---|---|---:|---|
| R1-P00 | `R1-P00-foundation.postman_collection.json` | 2 | `readme_R1-P00.md` |
| R1-P01 | `R1-P01-foundation-country-configuration.postman_collection.json` | 3 | `readme_R1-P01.md` |
| R1-P02 + R1-P04A | `R1-P02-authentication.postman_collection.json` | 17 | `readme_R1-P02.md` |
| R1-P04 | `R1-P04-customer-self-service.postman_collection.json` | 21 | `readme_R1-P04.md` |
| R1-P05 | `Cleanora-R1-P05.postman_collection.json` | 41 | `readme_R1-P05.md` |

R1-P03 and R1-P03A privileged role-provisioning operations are intentionally
not duplicated into a public phase collection. Their exposure rules remain
controlled by their internal and owner-only contracts.

## Standard Collection Structure

Every phase collection uses two top-level folders:

```text
Hosted (Not hosted yet)
└── <phase operation groups>

Local
└── <the same phase operation groups>
```

For R1-P00 through R1-P04:

```text
Hosted request prefix: {{hostUrl}}
Local request prefix:  {{baseUrl}}
```

R1-P05 additionally uses its folder pre-request configuration to select the
appropriate local or hosted URL variables while retaining the same operation
contract.

## Saved Examples

Every request in every environment has at least one Saved Success Example.
The example contains:

- the original request method and URL;
- the required JSON or multipart body when applicable;
- the expected HTTP success status;
- a representative Cleanora success envelope or browser redirect.

Authentication signup and category enrollment retain multiple Saved Success
Examples because each supported account category has a strict request body.

## Environments

Import one of:

```text
Cleanora-local.postman_environment.json
Cleanora-railway.postman_environment.json
```

The Local API default is:

```text
http://localhost:8000/api/v1
```

Sensitive values are exported empty and must be entered only in a private
Postman workspace:

```text
testEmail
testPhone
testPassword
newPassword
emailOtp
passwordResetCode
challengeId
accessToken
providerAdminInvitationToken
```

Do not commit or export real passwords, OTPs, access tokens, refresh cookies,
invitation tokens, operational contacts, or private file-system paths.

## Recommended Usage

1. Import the appropriate environment.
2. Import the required phase collection.
3. Start with R1-P00/P01 health requests.
4. Use R1-P02 to create/login an eligible account and capture `accessToken`.
5. Use R1-P04 for customer self-service.
6. Use R1-P05 for Provider onboarding and Staff review.
7. Expand any request and open its Saved Success Example for a copyable request
   body and representative response.
8. Use Swagger as the source of truth for exact runtime error variants.

Local Swagger:

```text
http://localhost:8000/api/v1/docs
```

## Regeneration and Validation

Do not maintain generated collection JSON by hand. Update its generator and
regenerate:

```bash
npm run postman:generate
npm run postman:validate
```

The validator checks both environments independently, verifies method/path
parity with the runtime contract, enforces the requested URL prefix, confirms
that every request has a Saved Success Example, and verifies that examples
preserve required request bodies.
