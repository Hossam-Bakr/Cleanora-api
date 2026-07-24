# Database and Prisma

Cleanora uses one PostgreSQL database and one centralized `prisma/schema.prisma`. The Prisma client is generated to `src/generated/prisma` and instantiated once through `PrismaLifecycle`.

R1-P00 defines no models and creates no migration. Every later database-changing phase:

1. Inspects the current schema and all migrations.
2. Adds only active-phase models and changes.
3. Creates `r1_pxx_short_description`.
4. Reviews generated SQL, defaults, backfills, indexes, constraints, and compatibility.
5. Regenerates the client and validates clean migration application.

Applied migrations are immutable. Corrections use forward migrations. Financial records are never hard-deleted and use Prisma Decimal/database decimal types when introduced. Raw Prisma types do not cross module APIs.
