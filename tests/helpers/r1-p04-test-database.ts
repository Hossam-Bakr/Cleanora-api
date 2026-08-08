import { createRequire } from "node:module";
import { join } from "node:path";

type R1P04TestDatabaseModule = {
  APPROVED_R1_P04_PROOF_NAME: string;
  parseDatabaseName: (url: string | undefined) => string | undefined;
  isForbiddenDatabaseName: (name: string) => boolean;
  isApprovedR1P04ProofName: (name: string) => boolean;
  requireR1P04TestDatabase: (env?: NodeJS.ProcessEnv) => {
    readonly databaseName: string;
  };
  hasR1P04TestDatabaseReady: (env?: NodeJS.ProcessEnv) => boolean;
};

const require = createRequire(join(process.cwd(), "package.json"));
const helper = require("./scripts/r1-p04-test-database.cjs") as R1P04TestDatabaseModule;

export const APPROVED_R1_P04_PROOF_NAME = helper.APPROVED_R1_P04_PROOF_NAME;
export const parseDatabaseName = helper.parseDatabaseName;
export const isForbiddenDatabaseName = helper.isForbiddenDatabaseName;
export const isApprovedR1P04ProofName = helper.isApprovedR1P04ProofName;
export const requireR1P04TestDatabase = helper.requireR1P04TestDatabase;
export const hasR1P04TestDatabaseReady = helper.hasR1P04TestDatabaseReady;
