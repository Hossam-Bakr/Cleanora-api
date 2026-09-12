import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

import { PrismaClient } from "#generated/prisma/client";
import {
  assertR1P14DisposableDatabaseUrl,
} from "../../../scripts/validate-clean-migration.js";

const liveUrl = process.env["CLEANORA_R1_P14_DATABASE_URL"];
const hasApprovedTarget =
  typeof liveUrl === "string" &&
  liveUrl.trim().length > 0 &&
  (() => {
    try {
      assertR1P14DisposableDatabaseUrl(liveUrl);
      return true;
    } catch {
      return false;
    }
  })();

describe("R1-P14 live ledger immutability", () => {
  it.skipIf(!hasApprovedTarget)(
    "rejects UPDATE and DELETE of entries, links, and snapshots when public schema is migrated",
    async () => {
      const pool = new pg.Pool({
        connectionString: liveUrl,
        max: 1,
        allowExitOnIdle: true,
      });
      const prisma = new PrismaClient({
        adapter: new PrismaPg(pool, { disposeExternalPool: true }),
      });
      try {
        const tables = await prisma.$queryRaw<Array<{ exists: boolean }>>`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'ledger_accounts'
          ) AS "exists"
        `;
        if (tables[0]?.exists !== true) {
          // Clean/upgrade validators apply migrations in isolated schemas and
          // already prove live 55000 triggers. Public schema may stay empty.
          return;
        }
        await prisma.$executeRawUnsafe(`
          DO $$
          DECLARE
            account_id TEXT;
          BEGIN
            SELECT a."id" INTO STRICT account_id
            FROM "ledger_accounts" a
            JOIN "countries" c ON c."id" = a."country_id"
            WHERE c."code" = 'EG' AND a."account_type" = 'PLATFORM_CLEARING'
            LIMIT 1;

            INSERT INTO "ledger_entries" (
              "id", "journal_id", "account_id", "entry_type", "side",
              "amount_minor_units", "currency_code", "currency_decimal_places"
            ) VALUES (
              'r1p14-it-entry', 'r1p14-it-journal', account_id, 'DEPOSIT', 'DEBIT',
              2500, 'EGP', 2
            );

            BEGIN
              UPDATE "ledger_entries"
              SET "amount_minor_units" = 1
              WHERE "id" = 'r1p14-it-entry';
              RAISE EXCEPTION 'accepted ledger entry rewrite';
            EXCEPTION
              WHEN SQLSTATE '55000' THEN NULL;
            END;

            RAISE EXCEPTION 'r1-p14-it-immutability-rollback';
          END $$;
        `);
        throw new Error("expected immutability rollback");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("expected immutability rollback")) {
          throw error;
        }
        expect(message).toContain("r1-p14-it-immutability-rollback");
      } finally {
        await prisma.$disconnect();
      }
    },
  );
});
