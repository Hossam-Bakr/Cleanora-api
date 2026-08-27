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

    expect(operationIds).toHaveLength(148);
    expect(new Set(operationIds).size).toBe(operationIds.length);
    expect(cleanoraOpenApiDocument.paths).toHaveProperty(
      "/staff/providers/{providerId}/suspend",
    );
    expect(cleanoraOpenApiDocument.paths).toHaveProperty(
      "/staff/providers/{providerId}/reinstate",
    );
    expect(cleanoraOpenApiDocument.paths).toHaveProperty(
      "/providers/{providerId}/workers",
    );
    expect(cleanoraOpenApiDocument.paths).toHaveProperty(
      "/providers/{providerId}/teams/{teamId}/membership-commands",
    );
    expect(cleanoraOpenApiDocument.paths).toHaveProperty("/workers/me/leave");
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/auth/google/result",
    );
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/auth/contact-verifications/email/request",
    );
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/auth/contact-verifications/phone/request",
    );
    expect(cleanoraOpenApiDocument.paths).not.toHaveProperty(
      "/auth/contact-verifications/verify",
    );
  });

  it("documents category-aware email-only signup schemas", () => {
    const signupSchema = cleanoraOpenApiDocument.components.schemas
      .SignupRequest as {
      readonly oneOf: readonly { readonly $ref: string }[];
      readonly discriminator: { readonly propertyName: string };
    };
    expect(signupSchema.discriminator.propertyName).toBe("accountCategory");
    expect(signupSchema.oneOf.map((branch) => branch.$ref)).toEqual([
      "#/components/schemas/IndividualSignupRequest",
      "#/components/schemas/CompanySignupRequest",
      "#/components/schemas/EngineerSignupRequest",
      "#/components/schemas/ProviderOwnerSignupRequest",
    ]);
    expect(
      cleanoraOpenApiDocument.components.schemas.IndividualSignupRequest
        .required,
    ).toEqual([
      "accountCategory",
      "fullName",
      "phone",
      "email",
      "password",
    ]);
    expect(
      cleanoraOpenApiDocument.components.schemas.CompanySignupRequest.required,
    ).toEqual([
      "accountCategory",
      "companyName",
      "representativeFullName",
      "phone",
      "email",
      "password",
    ]);
    expect(
      cleanoraOpenApiDocument.components.schemas.EngineerSignupRequest.required,
    ).toEqual([
      "accountCategory",
      "fullName",
      "professionalTitle",
      "phone",
      "email",
      "password",
    ]);

    type JsonRequestBody = {
      readonly content: {
        readonly "application/json": {
          readonly schema: { readonly $ref: string };
          readonly examples?: Readonly<Record<string, unknown>>;
        };
      };
    };
    const signupRequestBody = cleanoraOpenApiDocument.paths["/auth/signup"]
      .post.requestBody as JsonRequestBody;
    expect(
      Object.keys(
        signupRequestBody.content["application/json"].examples ?? {},
      ),
    ).toEqual(["individual", "company", "engineer", "providerOwner"]);

    expect(
      cleanoraOpenApiDocument.paths["/auth/signup"].post.description,
    ).toContain("Every supported category currently receives its blocking OTP by email");
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

    expect(customerOperations).toHaveLength(21);
    expect(new Set(customerOperations).size).toBe(21);

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
