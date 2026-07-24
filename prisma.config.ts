import { loadEnvFile } from "node:process";

import { defineConfig, env } from "prisma/config";

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
    url: env("DATABASE_URL")
  }
});
