# Cleanora Swagger Documentation

Status: Implemented in completed R1-P02. R1-P02A preserved the runtime
documentation contract while simplifying the source structure.

## Runtime endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/docs` | Professional interactive Swagger UI |
| `GET` | `/api/v1/docs/openapi.json` | Complete machine-readable OpenAPI 3.1 contract |

The runtime contract is defined in
`src/swagger/openapi.document.ts`. It documents every currently implemented
public system-health and R1-P02 authentication endpoint.

## Documentation conventions

- Every operation has a stable `operationId`, summary, detailed description,
  access model, request contract, success response, relevant failure responses,
  and frontend usage guidance.
- JSON responses follow the Cleanora success/failure envelope and include
  `requestId`.
- Bearer and refresh-cookie authentication are documented separately.
- Passwords, OTPs, reset credentials, access tokens, cookies, provider secrets,
  connection strings, and internal errors never appear as usable examples.
- Google browser endpoints document redirects rather than pretending the
  callback is a normal JSON API.
- The interactive page does not persist Swagger authorization between reloads.

## Local use

Start the server:

```bash
npm run dev
```

Open:

```text
http://localhost:8000/api/v1/docs
```

Swagger UI assets are loaded from the pinned
`swagger-ui-dist@5.17.14` browser distribution because local npm package
installation is not available in the current environment. The OpenAPI document
and documentation endpoints themselves are served locally by Cleanora.

