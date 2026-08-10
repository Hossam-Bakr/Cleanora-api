# API Contract: R1-P04A

All responses keep the standard Cleanora envelope and request ID.

## `POST /api/v1/auth/signup`

Strict request variants:

```json
{ "accountCategory": "INDIVIDUAL", "fullName": "Ada Lovelace", "phone": "+201000000001", "email": "ada@example.com", "password": "safe-passphrase" }
```

```json
{ "accountCategory": "COMPANY", "companyName": "Clean Co", "representativeFullName": "Mona Ali", "phone": "+201000000002", "email": "ops@example.com", "password": "safe-passphrase" }
```

```json
{ "accountCategory": "ENGINEER", "fullName": "Omar Hassan", "professionalTitle": "Civil Engineer", "phone": "+201000000003", "email": "omar@example.com", "password": "safe-passphrase" }
```

Provider Owner retains category, phone, email, and password. Every `202`
challenge has `purpose: CATEGORY_VERIFICATION`, `channel: EMAIL`, and a masked
email destination.

## `POST /api/v1/auth/account-categories`

Authenticated full session. Uses the same category-specific profile fields and
returns an email challenge. Profile and enrollment are atomic.

## Current verification boundary

Use the existing OTP request/verify endpoints. There are no current
contact-verification endpoints for profile email/phone actions, and no SMS
response example. Successful password-based activation verifies email only.

## `PUT /api/v1/customers/profiles/company`

The verified Company owner may replace:

```json
{
  "companyName": "Clean Co",
  "representativeFullName": "Mona Ali",
  "commercialRegistrationNumber": "123456",
  "taxRegistrationNumber": "987654321"
}
```

Each regulatory field is required in the full-replacement body as a trimmed
non-blank string up to 100 characters or `null`. New Company responses expose
both as `null`.
