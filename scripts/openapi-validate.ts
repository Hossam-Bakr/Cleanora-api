/** Validate every phase-owned OpenAPI document, or one explicitly requested path. */
import { relative, resolve } from 'node:path';
import { cleanoraOpenApiDocument } from '../src/swagger/openapi.document.js';

interface OpenApiParser {
  validate(document: string | Readonly<Record<string, unknown>>): Promise<unknown>;
}
const openApiParser = require('@apidevtools/swagger-parser') as OpenApiParser;
const defaults = [
  'docs/apis/openapi/r1-p01-foundation.yaml',
  'docs/apis/openapi/r1-p02-authentication.yaml',
  'docs/apis/openapi/r1-p03a-staff-admin-role-management.yaml',
  'docs/apis/openapi/r1-p03a-owner-staff-admins.yaml',
  'docs/apis/openapi/r1-p04-customer-self-service.yaml',
  'docs/apis/openapi/r1-p05-provider-onboarding-profile-lifecycle.yaml',
  'docs/apis/openapi/r1-p06-provider-verification-external-payout-destinations.yaml',
];

async function main(): Promise<void> {
  const paths = process.argv[2] === undefined ? defaults : [process.argv[2]];
  try {
    for (const value of paths) await openApiParser.validate(resolve(process.cwd(), value!));
    await openApiParser.validate(cleanoraOpenApiDocument);
    process.stdout.write(`${JSON.stringify({ ok: true, paths: paths.map((value) => relative(process.cwd(), resolve(process.cwd(), value!)).replaceAll('\\', '/')), runtimeDocument: 'src/swagger/openapi.document.ts' })}\n`);
  } catch (error: unknown) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: 'OPENAPI_INVALID', paths, message: error instanceof Error ? error.message : 'Validation failed' })}\n`);
    process.exitCode = 1;
  }
}

void main();
