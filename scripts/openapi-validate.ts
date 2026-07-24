/**
 * @desc Validate the R1-P01 OpenAPI foundation document.
 * @access Maintainer tooling
 * @explanation This script checks that the static OpenAPI file exists and parses
 * as YAML with required OpenAPI version and health paths.
 */
const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const openApiPath = resolve(
  process.cwd(),
  "docs/apis/openapi/r1-p01-foundation.yaml"
);

if (!existsSync(openApiPath)) {
  process.stderr.write(
    `${JSON.stringify({
      ok: false,
      error: "OPENAPI_MISSING",
      path: "docs/apis/openapi/r1-p01-foundation.yaml"
    })}\n`
  );
  process.exitCode = 1;
} else {
  const content = readFileSync(openApiPath, "utf8");
  const hasOpenApi = /openapi:\s*["']?3\./.test(content);
  const requiredPaths = [
    "/api/v1/system/health/live",
    "/api/v1/system/health/ready",
    "/api/v1/system/health/database"
  ];
  const missingPaths = requiredPaths.filter((path) => !content.includes(path));

  if (!hasOpenApi || missingPaths.length > 0) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        error: "OPENAPI_INVALID",
        hasOpenApi,
        missingPaths
      })}\n`
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(
      `${JSON.stringify({ ok: true, path: "docs/apis/openapi/r1-p01-foundation.yaml" })}\n`
    );
  }
}
