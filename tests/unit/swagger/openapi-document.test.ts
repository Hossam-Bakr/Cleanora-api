import { cleanoraOpenApiDocument } from '../../../src/swagger/openapi.document.js';

interface OpenApiParser {
  validate(document: Readonly<Record<string, unknown>>): Promise<unknown>;
}

const openApiParser = require('@apidevtools/swagger-parser') as OpenApiParser;

describe('Cleanora Swagger OpenAPI document', () => {
  it('is a valid OpenAPI 3.1 document', async () => {
    await expect(
      openApiParser.validate(structuredClone(cleanoraOpenApiDocument)),
    ).resolves.toBeDefined();
  });

  it('documents every implemented system, authentication, and docs operation', () => {
    const operationIds = Object.values(cleanoraOpenApiDocument.paths).flatMap(
      (pathItem) =>
        Object.values(pathItem)
          .map((operation) => operation.operationId)
          .filter((value): value is string => typeof value === 'string'),
    );

    expect(operationIds).toHaveLength(46);
    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/auth/google/result",
    );
  });

  it('documents R1-P03A paths and excludes obsolete bootstrap routes', () => {
    expect(cleanoraOpenApiDocument.paths).toHaveProperty(
      "/auth/role-grants/commands",
    );
    expect(cleanoraOpenApiDocument.paths).toHaveProperty(
      "/internal/owner/staff-admins",
    );
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/auth/first-staff-admin/bootstrap",
    );
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/internal/first-staff-admin/bootstrap",
    );
  });

  it('documents every R1-P04 customer operation and its locked request semantics', () => {
    const customerOperations = Object.entries(cleanoraOpenApiDocument.paths)
      .filter(([path]) => path.startsWith('/customers/'))
      .flatMap(([path, pathItem]) =>
        Object.entries(pathItem)
          .filter(([method]) => ['get', 'post', 'put', 'delete'].includes(method))
          .map(([method]) => `${method.toUpperCase()} ${path}`),
      );

    expect(customerOperations).toHaveLength(22);
    expect(new Set(customerOperations).size).toBe(22);

    expect(
      cleanoraOpenApiDocument.paths['/customers/me/overview'].get.responses,
    ).toHaveProperty('200');
    expect(
      cleanoraOpenApiDocument.components.schemas.CustomerOverviewData.required,
    ).toEqual([
      'identity',
      'profiles',
      'profileImage',
      'contactState',
      'preferences',
      'addresses',
    ]);

    const preferences =
      cleanoraOpenApiDocument.components.schemas.PreferencesPutRequest;
    expect(preferences.required).toContain('mandatory');
    expect(preferences.properties.mandatory).toEqual({
      $ref: '#/components/schemas/MandatoryNotices',
    });

    const mandatory =
      cleanoraOpenApiDocument.components.schemas.MandatoryNotices;
    expect(mandatory.required).toEqual([
      'security',
      'activeService',
    ]);
    expect(
      mandatory.properties.security.properties.sms,
    ).toEqual({ const: true });

    expect(
      cleanoraOpenApiDocument.paths['/customers/privacy-requests'].post
        .responses,
    ).toHaveProperty('201');
    expect(
      cleanoraOpenApiDocument.paths['/customers/addresses/{addressId}'].put
        .responses,
    ).toHaveProperty('404');
    expect(
      cleanoraOpenApiDocument.paths['/customers/profile-image'].delete
        .responses,
    ).toHaveProperty('404');
  });

  it('does not contain usable secrets in examples', () => {
    const serialized = JSON.stringify(cleanoraOpenApiDocument);

    expect(serialized).not.toContain('JWT_ACCESS_SECRET');
    expect(serialized).not.toContain('JWT_REFRESH_SECRET');
    expect(serialized).not.toContain('DATABASE_URL');
    expect(serialized).not.toMatch(/Bearer eyJ/);
  });
});
