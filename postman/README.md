# Postman

Import:

1. `Cleanora-local.postman_environment.json`
2. The collection for the phase being tested

Collections:

- `R1-P00-foundation.postman_collection.json` — implemented system endpoints
- `R1-P02-authentication.postman_collection.json` — prepared auth contract;
  endpoints are not implemented yet

Postman keeps the refresh cookie in its cookie jar. Do not paste real refresh
tokens, JWT secrets, database URLs, OTPs, or provider credentials into exported
environment or collection files.
