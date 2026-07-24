import type { PrismaClient } from "#generated/prisma/client";

let prismaClient: PrismaClient | undefined;

/**
 * Bind the application-composed Prisma client before module registration.
 * Rebinding the same identity is harmless; replacing it is rejected so health,
 * repositories, and shutdown cannot drift onto different connection pools.
 */
export function bindPrismaClient(client: PrismaClient): void {
  if (prismaClient === undefined) {
    prismaClient = client;
    return;
  }

  if (prismaClient !== client) {
    throw new Error("A different process-wide Prisma client is already bound");
  }
}

/** Return the process-wide client after composition has explicitly bound it. */
export function getPrismaClient(): PrismaClient {
  if (prismaClient === undefined) {
    throw new Error(
      "Prisma client is not bound; compose the database lifecycle before repository access"
    );
  }

  return prismaClient;
}

/**
 * Reset only explicit test composition. Production code cannot silently clear
 * the process-wide identity and trigger a fallback client because none exists.
 */
export function resetPrismaClientForTests(
  runtimeEnvironment: string | undefined = process.env["NODE_ENV"]
): void {
  if (runtimeEnvironment !== "test") {
    throw new Error("Prisma client reset is available only in test composition");
  }

  prismaClient = undefined;
}
