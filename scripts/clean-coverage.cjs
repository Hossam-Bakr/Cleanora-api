"use strict";

const { existsSync, rmSync } = require("node:fs");
const { resolve, sep } = require("node:path");

const REPOSITORY_ROOT = resolve(__dirname, "..");

/**
 * Resolve the repository-local coverage directory without deleting anything.
 * Safe to call from unit tests during an active Vitest coverage run.
 */
function resolveCoverageDirectory(cwd = process.cwd()) {
  const requestedRoot = resolve(cwd);
  if (requestedRoot !== REPOSITORY_ROOT) {
    throw new Error("Refusing to delete coverage outside repository root");
  }
  const coverageDir = resolve(REPOSITORY_ROOT, "coverage");
  if (
    coverageDir !== resolve(REPOSITORY_ROOT, "coverage") ||
    !coverageDir.startsWith(`${REPOSITORY_ROOT}${sep}`)
  ) {
    throw new Error("Refusing to delete coverage outside repository root");
  }
  return coverageDir;
}

/**
 * Remove the repository-local coverage directory once before Vitest starts.
 * This prevents stale coverage output from inflating thresholds after an
 * interrupted run. Never call this from tests during an active Vitest run.
 */
function cleanCoverageDirectory(cwd = process.cwd()) {
  const coverageDir = resolveCoverageDirectory(cwd);
  if (existsSync(coverageDir)) {
    rmSync(coverageDir, { recursive: true, force: true });
  }
  return coverageDir;
}

if (require.main === module) {
  cleanCoverageDirectory();
}

module.exports = {
  resolveCoverageDirectory,
  cleanCoverageDirectory,
};
