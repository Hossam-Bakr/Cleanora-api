import { createRequire } from "node:module";
import { join } from "node:path";

export type TestDatabaseUrlSource = "TEST_DATABASE_URL" | "CI_DATABASE_URL";

export type ResolvedTestDatabaseUrl = {
  readonly url: string | undefined;
  readonly source: TestDatabaseUrlSource | undefined;
};

export type RequiredTestDatabaseUrl = {
  readonly url: string;
  readonly source: TestDatabaseUrlSource;
};

type ResolveTestDatabaseUrlModule = {
  resolveTestDatabaseUrl: (env?: NodeJS.ProcessEnv) => ResolvedTestDatabaseUrl;
  hasApprovedTestDatabaseUrl: (env?: NodeJS.ProcessEnv) => boolean;
  requireApprovedTestDatabaseUrl: (
    env?: NodeJS.ProcessEnv
  ) => RequiredTestDatabaseUrl;
  applyTestDatabaseEnv: (env?: NodeJS.ProcessEnv) => ResolvedTestDatabaseUrl;
};

// Resolve from repo root so Vitest transforms cannot lose __filename.
const require = createRequire(join(process.cwd(), "package.json"));
const resolver = require("./scripts/resolve-test-database-url.cjs") as ResolveTestDatabaseUrlModule;

export const resolveTestDatabaseUrl = resolver.resolveTestDatabaseUrl;
export const hasApprovedTestDatabaseUrl = resolver.hasApprovedTestDatabaseUrl;
export const requireApprovedTestDatabaseUrl =
  resolver.requireApprovedTestDatabaseUrl;
export const applyTestDatabaseEnv = resolver.applyTestDatabaseEnv;
