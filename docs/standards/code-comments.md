# Code Comment Standard

Comments use easy English and explain intent, security, ownership, or a
non-obvious decision. They must not repeat the code line by line.

Every exported route handler, controller, middleware, use case, repository
operation, integration boundary, and maintenance script must have a short
JSDoc block.

```ts
/**
 * @desc Register a new user.
 * @route POST /api/v1/auth/signup
 * @access Public
 * @explanation This function validates the signup request and asks the
 * authentication use case to create the user. It never stores a plain password.
 */
```

Rules:

- Use `@desc`, `@route`, `@access`, and `@explanation` for HTTP handlers.
- Omit `@route` for helpers that are not HTTP endpoints.
- Keep comments accurate when behavior changes.
- Explain why a security, transaction, idempotency, or compatibility rule exists.
- Do not place secrets, credentials, personal data, or real endpoint values in comments.
- Do not comment imports, simple assignments, or obvious syntax.
- Business rules still belong in the phase specification and tests; comments
  are not a substitute.
