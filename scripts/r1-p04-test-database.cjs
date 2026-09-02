"use strict";

/* global URL */

/**
 * Fail-closed R1-P04 disposable test-database gate.
 * Never logs credentials or complete database URLs.
 */

const APPROVED_R1_P04_PROOF_NAME = "cleanora_r1_p04_clean_proof";
const APPROVED_R1_P04_CURRENT_PROOF_NAME = "cleanora_r1_p04_current_proof";
const APPROVED_NAME_PATTERN = /^cleanora_r1_p04_[a-z0-9_]+_proof$/u;
const APPROVED_R1_P07_COMPATIBILITY_PATTERN =
  /^cleanora_r1_p07(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/u;
const FORBIDDEN_NAME_PATTERNS = [
  /r1_p02/iu,
  /_ci(?:_|$)/iu,
  /production/iu,
  /prod(?:_|$)/iu,
  /railway/iu,
  /^Cleanora$/u,
];

/**
 * @param {string | undefined} url
 * @returns {string | undefined}
 */
function parseDatabaseName(url) {
  if (typeof url !== "string" || url.length === 0) {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.replace(/^\//u, "").split("/")[0];
    return name.length > 0 ? decodeURIComponent(name) : undefined;
  } catch {
    const match = url.match(/\/([A-Za-z0-9_]+)(?:\?|$)/u);
    return match?.[1];
  }
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isForbiddenDatabaseName(name) {
  return FORBIDDEN_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isApprovedR1P04ProofName(name) {
  return APPROVED_NAME_PATTERN.test(name) && !isForbiddenDatabaseName(name);
}

/**
 * A later-phase disposable target may run R1-P04 regressions only when the
 * caller explicitly attests that the target contains R1-P07 migrations.
 * This never makes the target eligible for R1-P04 migration commands by name
 * alone and does not accept arbitrary future or shared databases.
 *
 * @param {string} name
 * @param {NodeJS.ProcessEnv} env
 * @returns {boolean}
 */
function isApprovedR1P07CompatibilityTarget(name, env) {
  return env.TEST_DATABASE_HAS_R1_P07 === "true" &&
    APPROVED_R1_P07_COMPATIBILITY_PATTERN.test(name) &&
    !isForbiddenDatabaseName(name);
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   ready: boolean,
 *   databaseName: string | undefined,
 *   pooledName: string | undefined,
 *   migrationName: string | undefined,
 * }}
 */
function inspectR1P04TestDatabase(env = process.env) {
  const pooledName = parseDatabaseName(env.TEST_DATABASE_URL);
  const migrationName = parseDatabaseName(env.TEST_MIGRATION_DATABASE_URL);
  return {
    ready: false,
    databaseName: pooledName,
    pooledName,
    migrationName,
  };
}

/**
 * Validates R1-P04 disposable DB readiness. Throws redacted errors only.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ databaseName: string }}
 */
function requireR1P04TestDatabase(env = process.env) {
  if (env.TEST_DATABASE_HAS_R1_P04 !== "true") {
    throw new Error(
      "R1-P04 database suites require TEST_DATABASE_HAS_R1_P04=true. " +
        "Silent skip is not permitted for release gates. " +
        `Point TEST_DATABASE_URL and TEST_MIGRATION_DATABASE_URL at ${APPROVED_R1_P04_PROOF_NAME}.`,
    );
  }

  const pooledName = parseDatabaseName(env.TEST_DATABASE_URL);
  const migrationName = parseDatabaseName(env.TEST_MIGRATION_DATABASE_URL);

  if (pooledName === undefined) {
    throw new Error(
      "TEST_DATABASE_URL is required when TEST_DATABASE_HAS_R1_P04=true (database name redacted).",
    );
  }
  if (migrationName === undefined) {
    throw new Error(
      "TEST_MIGRATION_DATABASE_URL is required when TEST_DATABASE_HAS_R1_P04=true (database name redacted).",
    );
  }
  if (pooledName !== migrationName) {
    throw new Error(
      "TEST_DATABASE_URL and TEST_MIGRATION_DATABASE_URL must refer to the same R1-P04 proof database name " +
        `(pooled='${pooledName}', migration='${migrationName}').`,
    );
  }
  if (isForbiddenDatabaseName(pooledName)) {
    throw new Error(
      `Rejected unsafe test database name '${pooledName}'. ` +
        "R1-P02 CI, production-like, Railway, and shared app databases are forbidden.",
    );
  }
  if (
    !isApprovedR1P04ProofName(pooledName) &&
    !isApprovedR1P07CompatibilityTarget(pooledName, env)
  ) {
    throw new Error(
      `Rejected unapproved R1-P04 database name '${pooledName}'. ` +
        `Expected disposable proof name matching cleanora_r1_p04_*_proof ` +
        `(canonical: ${APPROVED_R1_P04_PROOF_NAME}) or an explicitly attested R1-P07 disposable target.`,
    );
  }

  return { databaseName: pooledName };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
function hasR1P04TestDatabaseReady(env = process.env) {
  try {
    requireR1P04TestDatabase(env);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  APPROVED_R1_P04_PROOF_NAME,
  APPROVED_R1_P04_CURRENT_PROOF_NAME,
  parseDatabaseName,
  isForbiddenDatabaseName,
  isApprovedR1P04ProofName,
  inspectR1P04TestDatabase,
  requireR1P04TestDatabase,
  hasR1P04TestDatabaseReady,
};
