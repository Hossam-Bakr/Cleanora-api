import { PrismaLifecycle } from "./prisma-lifecycle.js";

import type { PrismaClient } from "#generated/prisma/client";

let prismaClient: PrismaClient | undefined;

/**
 * Return the process-wide Prisma client for infrastructure repositories.
 * The application lifecycle owns connection management; this accessor only
 * creates the same adapter-backed client lazily for module API consumers.
 */
export function getPrismaClient(): PrismaClient {
  if (prismaClient !== undefined) {
    return prismaClient;
  }

  const connectionString = process.env.DATABASE_URL;
  if (connectionString === undefined || connectionString.length === 0) {
    throw new Error("DATABASE_URL is required for database repositories");
  }

  prismaClient = new PrismaLifecycle(connectionString).client;
  return prismaClient;
}
