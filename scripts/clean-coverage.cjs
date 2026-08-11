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
  // Windows path comparisons are case-insensitive; normalize before equality.
  if (requestedRoot.toLowerCase() !== REPOSITORY_ROOT.toLowerCase()) {
    throw new Error("Refusing to delete coverage outside repository root");
  }
  const coverageDir = resolve(REPOSITORY_ROOT, "coverage");
  const rootPrefix = `${REPOSITORY_ROOT}${sep}`.toLowerCase();
  if (
    coverageDir.toLowerCase() !== resolve(REPOSITORY_ROOT, "coverage").toLowerCase() ||
    !coverageDir.toLowerCase().startsWith(rootPrefix)
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
