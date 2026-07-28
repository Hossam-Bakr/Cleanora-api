import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client.js";

const environment = z
  .object({
    NODE_ENV: z.literal("development"),
    DATABASE_URL: z.string().min(1),
    AUTH_STATUS_FIXTURE_USER_ID: z.string().min(1),
    AUTH_STATUS_FIXTURE_STATUS: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
  })
  .parse(process.env);

async function updateStatusFixture(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: environment.DATABASE_URL }),
  });
  try {
    const now = new Date();
    const updated = await prisma.user.updateMany({
      where: { id: environment.AUTH_STATUS_FIXTURE_USER_ID },
      data: {
        status: environment.AUTH_STATUS_FIXTURE_STATUS,
        statusChangedAt: now,
        suspendedUntil:
          environment.AUTH_STATUS_FIXTURE_STATUS === "SUSPENDED"
            ? new Date(now.getTime() + 15 * 60 * 1000)
            : null,
      },
    });
    if (updated.count !== 1) throw new Error("AUTH_STATUS_FIXTURE_USER_NOT_FOUND");
    process.stdout.write("PASS STATUS_UPDATED\n");
  } finally {
    await prisma.$disconnect();
  }
}

void updateStatusFixture().catch((error: unknown) => {
  process.stderr.write(
    `FAIL ${error instanceof Error ? error.name : "STATUS_FIXTURE_FAILED"}\n`,
  );
  process.exitCode = 1;
});
