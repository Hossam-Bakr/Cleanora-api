# Cleanora — Standalone Project Boundary

## Rule

Cleanora is a standalone greenfield project.

The repository must contain everything required to understand, build, test, migrate, and deploy the application, except explicitly documented external services and credentials.

## No external application dependency

The implementation must not require:

- Another source-code repository
- Another Prisma schema
- Another migration history
- Another application database
- Undocumented modules or APIs
- Compatibility with an unavailable system
- Data import from another product

## Database starting point

- Cleanora starts with its own initial Prisma migration.
- Every later phase updates the same Cleanora `schema.prisma`.
- Every database change is delivered through a Cleanora phase-owned migration.
- Migration history begins and remains inside the Cleanora repository.

## AI instruction

When an AI works on a phase, it must use only the current Cleanora repository, the current Cleanora Prisma schema, the Cleanora migration history, and the approved documentation.

If required information is missing, the AI must identify the gap. It must not assume that the answer exists in another application.
