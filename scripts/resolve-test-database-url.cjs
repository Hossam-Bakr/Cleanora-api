"use strict";

/**
 * Resolve the approved database URL for automated tests.
 * Only TEST_DATABASE_URL is an approved automated-test target. Ordinary
 * DATABASE_URL is never selected implicitly.
 */

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ url: string | undefined, source: "TEST_DATABASE_URL" | undefined }}
 */
function resolveTestDatabaseUrl(env = process.env) {
  const testUrl = env.TEST_DATABASE_URL;
  if (typeof testUrl === "string" && testUrl.length > 0) {
    return { url: testUrl, source: "TEST_DATABASE_URL" };
  }

  return { url: undefined, source: undefined };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {boolean}
 */
function hasApprovedTestDatabaseUrl(env = process.env) {
  return resolveTestDatabaseUrl(env).url !== undefined;
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ url: string, source: "TEST_DATABASE_URL" }}
 */
function requireApprovedTestDatabaseUrl(env = process.env) {
  const resolved = resolveTestDatabaseUrl(env);
  if (resolved.url === undefined || resolved.source === undefined) {
    throw new Error(
      "Approved test database URL is required for database-backed tests. Set TEST_DATABASE_URL. Ordinary DATABASE_URL is not an approved test target."
    );
  }
  return { url: resolved.url, source: resolved.source };
}

/**
 * Point process DATABASE_URL at the approved test target for Vitest composition.
 * Does not fall back to ordinary DATABASE_URL.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ url: string | undefined, source: "TEST_DATABASE_URL" | undefined }}
 */
function applyTestDatabaseEnv(env = process.env) {
  const resolved = resolveTestDatabaseUrl(env);

  if (resolved.url !== undefined) {
    env.DATABASE_URL = resolved.url;
  }

  return resolved;
}

module.exports = {
  resolveTestDatabaseUrl,
  hasApprovedTestDatabaseUrl,
  requireApprovedTestDatabaseUrl,
  applyTestDatabaseEnv
};
