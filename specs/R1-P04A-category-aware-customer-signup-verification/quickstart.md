# Quickstart: R1-P04A

## Local configuration

```dotenv
AUTH_ENABLED=true
EMAIL_AUTH_ENABLED=true
SMS_AUTH_ENABLED=false
```

Supply the existing complete JWT/auth secret and SMTP groups. No SMS provider
variables exist in the current phase. Restart after changing environment values.

## Signup examples

Individual:

```json
{ "accountCategory": "INDIVIDUAL", "fullName": "Mona Ali", "phone": "+201000000001", "email": "mona@example.com", "password": "safe-passphrase" }
```

Company:

```json
{ "accountCategory": "COMPANY", "companyName": "Clean Co", "representativeFullName": "Omar Ali", "phone": "+201000000002", "email": "ops@example.com", "password": "safe-passphrase" }
```

Engineer:

```json
{ "accountCategory": "ENGINEER", "fullName": "Sara Hassan", "professionalTitle": "Civil Engineer", "phone": "+201000000003", "email": "sara@example.com", "password": "safe-passphrase" }
```

Every accepted response returns `channel: EMAIL`. Verify using the existing
`POST /api/v1/auth/otp/verify` endpoint. Phone remains unverified.

Use runtime Swagger at `/api/v1/docs` and the canonical Auth Postman collection.
Run database suites only against the approved isolated test database.
