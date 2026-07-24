# Transactions

The application service that owns a workflow owns its transaction.

- Keep transactions short and database-focused.
- Pass a transaction-aware repository context rather than exposing Prisma globally.
- A module never writes another module's tables through direct Prisma access.
- For atomic cross-module work, document the coordinating service, participating public contracts, lock/concurrency strategy, and failure semantics.
- Do not call slow external providers inside an open database transaction.
- Use an outbox or equivalent only when a phase proves the need and defines delivery semantics.
