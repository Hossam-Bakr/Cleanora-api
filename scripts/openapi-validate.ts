/**
 * @desc Validate the R1-P01 OpenAPI foundation document.
 * @access Maintainer tooling
 * @explanation Parses YAML and validates the complete OpenAPI schema instead
 * of relying on text matches. An optional path supports isolated regressions.
 */
import { relative, resolve } from "node:path";

interface OpenApiParser {
  validate(documentPath: string): Promise<unknown>;
}

const openApiParser = require("@apidevtools/swagger-parser") as OpenApiParser;
const defaultDocumentPath = "docs/apis/openapi/r1-p01-foundation.yaml";

async function main(): Promise<void> {
  const requestedPath = process.argv[2] ?? defaultDocumentPath;
  const documentPath = resolve(process.cwd(), requestedPath);

  try {
    await openApiParser.validate(documentPath);
    process.stdout.write(
      `${JSON.stringify({
        ok: true,
        path: relative(process.cwd(), documentPath).replaceAll("\\", "/")
      })}\n`
    );
  } catch (error: unknown) {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        error: "OPENAPI_INVALID",
        path: relative(process.cwd(), documentPath).replaceAll("\\", "/"),
        message: error instanceof Error ? error.message : "Validation failed"
      })}\n`
    );
    process.exitCode = 1;
  }
}

void main();
