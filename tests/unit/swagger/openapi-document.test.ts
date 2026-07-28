import { cleanoraOpenApiDocument } from '../../../src/swagger/index.js';

interface OpenApiParser {
  validate(document: Readonly<Record<string, unknown>>): Promise<unknown>;
}

const openApiParser = require('@apidevtools/swagger-parser') as OpenApiParser;

describe('Cleanora Swagger OpenAPI document', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    await expect(
      openApiParser.validate(cleanoraOpenApiDocument),
    ).resolves.toBeDefined();
  });

  it('documents every implemented system, authentication, and docs operation', () => {
    const operationIds = Object.values(cleanoraOpenApiDocument.paths).flatMap(
      (pathItem) =>
        Object.values(pathItem)
          .map((operation) => operation.operationId)
          .filter((value): value is string => typeof value === 'string'),
    );

    expect(operationIds).toHaveLength(22);
    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/auth/google/result",
    );
  });

  it('does not contain usable secrets in examples', () => {
    const serialized = JSON.stringify(cleanoraOpenApiDocument);

    expect(serialized).not.toContain('JWT_ACCESS_SECRET');
    expect(serialized).not.toContain('JWT_REFRESH_SECRET');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toMatch(/Bearer eyJ/);
  });
});
