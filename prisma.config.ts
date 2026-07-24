import { loadEnvFile } from "node:process";

import { defineConfig } from "prisma/config";

try {
  loadEnvFile();
} catch (error: unknown) {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;

  if (code !== "ENOENT") {
    throw error;
  }
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts"
  },
  datasource: {
    // Schema-only commands must run on clean CI workers without a database.
    // Port 1 is deliberately unreachable; commands that connect still fail
    // safely unless the caller supplies an explicit DATABASE_URL.
    url:
      process.env["DATABASE_URL"] ??
      "postgresql://unconfigured:unconfigured@127.0.0.1:1/cleanora_unconfigured"
  }
});
