# Cleanora Migrations

R1-P00 creates no migration because it introduces no product tables.

Every later database-changing phase creates a named migration:

```text
r1_pxx_short_description
```

Generated SQL must be reviewed. Applied migrations are immutable; corrections use forward migrations. The introducing phase owns constraints, indexes, defaults, backfills, compatibility checks, and documentation.
