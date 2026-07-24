import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";

async function main(): Promise<void> {
  const connectionString = process.env["DATABASE_URL"];
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL is required");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString })
  });

  try {
    const [countries, currencies, appConfigs, countryConfigs, eg, egp] =
      await Promise.all([
        prisma.country.count(),
        prisma.currency.count(),
        prisma.appConfig.count(),
        prisma.countryConfig.count(),
        prisma.country.count({ where: { code: "EG" } }),
        prisma.currency.count({ where: { code: "EGP" } })
      ]);

    process.stdout.write(
      `${JSON.stringify(
        {
          countries,
          currencies,
          appConfigs,
          countryConfigs,
          egRows: eg,
          egpRows: egp
        },
        null,
        2
      )}\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
