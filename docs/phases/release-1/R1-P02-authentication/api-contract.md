# R1-P02 Authentication API Contract

R1-P02 is Complete. R1-P02A changed source structure only and preserved every
authentication method, path, request, response, status, cookie, token, email,
OTP, and Google redirect contract.

Use these current sources:

- Interactive runtime reference: `/api/v1/docs`
- Machine-readable runtime reference: `/api/v1/docs/openapi.json`
- Repository OpenAPI: `docs/apis/openapi/r1-p02-authentication.yaml`
- Frontend summary: `docs/apis/authentication.md`
- Google browser integration: `docs/apis/google-sign-in-frontend.md`
- Importable requests: `postman/`

This phase-navigation file intentionally does not duplicate endpoint schemas or
examples. Keeping one runtime contract prevents old SMS, phone-gate, response,
or folder-layout examples from drifting away from the implementation.
