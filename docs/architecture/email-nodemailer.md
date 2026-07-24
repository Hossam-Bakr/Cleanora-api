# Email and Nodemailer

`EmailPort` is the application boundary. `NodemailerEmailAdapter` adapts an injected transport without owning business templates or credentials.

- Modules provide template intent, not SMTP configuration.
- Credentials come from environment/secret management.
- Log message identifiers and outcomes, not bodies or recipient-sensitive payloads.
- Use idempotency keys and explicit retry policy when queued delivery is introduced.
