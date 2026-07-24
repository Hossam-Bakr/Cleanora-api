# Postman

Import:

1. `Cleanora-local.postman_environment.json`
2. The collection for the phase being tested

Collections:

- `R1-P00-foundation.postman_collection.json` — implemented system endpoints
- `R1-P01-foundation-country-configuration.postman_collection.json` —
  implemented health trio with envelope and `requestId` checks
- `R1-P02-authentication.postman_collection.json` — prepared auth contract;
  endpoints are not implemented yet

For R1-P01, import the local environment first and then the P01 collection.
Configuration and audit are in-process module contracts in this phase; they do
not expose Postman CRUD requests.

Postman keeps the refresh cookie in its cookie jar. Do not paste real refresh
tokens, JWT secrets, database URLs, OTPs, or provider credentials into exported
environment or collection files.
