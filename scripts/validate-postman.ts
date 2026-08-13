import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { cleanoraOpenApiDocument } from "../src/swagger/openapi.document.js";

interface PostmanRequest {
  readonly method: string;
  readonly url: string | { readonly raw?: string };
  readonly body?: unknown;
}

interface PostmanItem {
  readonly name: string;
  readonly request?: PostmanRequest;
  readonly response?: readonly {
    readonly name?: string;
    readonly code?: number;
    readonly body?: string;
    readonly originalRequest?: PostmanRequest;
  }[];
  readonly item?: readonly PostmanItem[];
}

interface PostmanCollection {
  readonly info: { readonly schema: string };
  readonly item: readonly PostmanItem[];
  readonly variable?: readonly EnvironmentValue[];
}

interface EnvironmentValue {
  readonly key: string;
  readonly value: unknown;
}

interface PostmanEnvironment {
  readonly values: readonly EnvironmentValue[];
}

function rawUrl(request: PostmanRequest): string {
  return typeof request.url === "string" ? request.url : (request.url.raw ?? "");
}

function normalizeCollectionRoute(url: string): string {
  return url
    .replace(/^\{\{hostUrl\}\}/u, "")
    .replace(/^\{\{baseUrl\}\}/u, "")
    .replace(/\{\{([^{}]+)\}\}/gu, "{$1}");
}

function runtimeCustomerOperations(): string[] {
  return Object.entries(cleanoraOpenApiDocument.paths)
    .filter(([path]) => path.startsWith("/customers/"))
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => ["get", "post", "put", "delete"].includes(method))
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    )
    .sort();
}

function runtimeAuthenticationOperations(): string[] {
  return Object.entries(cleanoraOpenApiDocument.paths)
    .filter(
      ([path]) =>
        path.startsWith("/auth/") && !path.startsWith("/auth/role-grants/"),
    )
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) =>
          ["get", "post", "put", "patch", "delete"].includes(method),
        )
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    )
    .sort();
}

function assertMirroredEnvironments(input: {
  readonly label: string;
  readonly collection: PostmanCollection;
  readonly expectedOperations: readonly string[];
}): number {
  const expectedFolders = ["Hosted (Not hosted yet)", "Local"];
  assert(
    input.collection.item.map((item) => item.name).join("|") ===
      expectedFolders.join("|"),
    `${input.label} must contain Hosted (Not hosted yet) and Local top-level folders`,
  );
  let total = 0;
  for (const environmentFolder of input.collection.item) {
    const requestItems = collectRequestItems(environmentFolder.item ?? []);
    const requests = requestItems.flatMap((item) =>
      item.request === undefined ? [] : [item.request],
    );
    total += requests.length;
    const expectedUrlPrefix =
      environmentFolder.name === "Local" ? "{{baseUrl}}" : "{{hostUrl}}";
    for (const request of requests) {
      assert(
        rawUrl(request).startsWith(expectedUrlPrefix),
        `${input.label} ${environmentFolder.name} request must start with ${expectedUrlPrefix}: ${rawUrl(request)}`,
      );
    }
    const operations = requests
      .map(
        (request) =>
          `${request.method.toUpperCase()} ${normalizeCollectionRoute(rawUrl(request))}`,
      )
      .sort();
    assert(
      JSON.stringify(operations) ===
        JSON.stringify([...input.expectedOperations].sort()),
      `${input.label} ${environmentFolder.name} operations differ from the expected contract.\nPostman: ${JSON.stringify(operations)}\nExpected: ${JSON.stringify([...input.expectedOperations].sort())}`,
    );
    for (const item of requestItems) {
      const successExample = (item.response ?? []).find((example) =>
        example.name?.startsWith("Success"),
      );
      assert(
        successExample !== undefined,
        `${input.label} ${environmentFolder.name}/${item.name} is missing a Success saved example`,
      );
      if (item.request?.body !== undefined) {
        assert(
          JSON.stringify(successExample.originalRequest?.body) ===
            JSON.stringify(item.request.body),
          `${input.label} ${environmentFolder.name}/${item.name} Success example must preserve the required request body`,
        );
      }
    }
  }
  return total;
}

function collectRequestItems(items: readonly PostmanItem[]): PostmanItem[] {
  return items.flatMap((item) => [
    ...(item.request === undefined ? [] : [item]),
    ...collectRequestItems(item.item ?? []),
  ]);
}

function runtimeProviderOperations(): string[] {
  return Object.entries(cleanoraOpenApiDocument.paths)
    .filter(
      ([path]) =>
        path.startsWith("/providers") ||
        path.startsWith("/provider-admin-invitations") ||
        path.startsWith("/staff/providers"),
    )
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) =>
          ["get", "post", "put", "patch", "delete"].includes(method),
        )
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    )
    .sort();
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function parseJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function main(): Promise<void> {
  const postmanDirectory = resolve("postman");
  const files = await readdir(postmanDirectory);
  const jsonFiles = files.filter((file) => file.endsWith(".json"));

  for (const file of jsonFiles) {
    await parseJson<unknown>(resolve(postmanDirectory, file));
  }

  const collectionPath = resolve(
    postmanDirectory,
    "R1-P04-customer-self-service.postman_collection.json",
  );
  const collection = await parseJson<PostmanCollection>(collectionPath);
  assert(
    collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P04 collection must use Postman collection schema v2.1.0",
  );

  const runtimeOperations = runtimeCustomerOperations();
  const r1P04RequestCount = assertMirroredEnvironments({
    label: "R1-P04",
    collection,
    expectedOperations: runtimeOperations,
  });

  const r1P00Collection = await parseJson<PostmanCollection>(
    resolve(postmanDirectory, "R1-P00-foundation.postman_collection.json"),
  );
  const r1P00RequestCount = assertMirroredEnvironments({
    label: "R1-P00",
    collection: r1P00Collection,
    expectedOperations: [
      "GET /system/health/live",
      "GET /system/health/ready",
    ],
  });

  const r1P01Collection = await parseJson<PostmanCollection>(
    resolve(
      postmanDirectory,
      "R1-P01-foundation-country-configuration.postman_collection.json",
    ),
  );
  const r1P01RequestCount = assertMirroredEnvironments({
    label: "R1-P01",
    collection: r1P01Collection,
    expectedOperations: [
      "GET /system/health/live",
      "GET /system/health/ready",
      "GET /system/health/database",
    ],
  });

  const r1P02Collection = await parseJson<PostmanCollection>(
    resolve(postmanDirectory, "R1-P02-authentication.postman_collection.json"),
  );
  const r1P02RequestCount = assertMirroredEnvironments({
    label: "R1-P02",
    collection: r1P02Collection,
    expectedOperations: runtimeAuthenticationOperations(),
  });

  const serializedCollection = await readFile(collectionPath, "utf8");
  for (const forbidden of [
    "CLOUDINARY_API_SECRET",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "DATABASE_URL",
    "Bearer eyJ",
  ]) {
    assert(
      !serializedCollection.includes(forbidden),
      `R1-P04 Postman collection contains forbidden secret material: ${forbidden}`,
    );
  }

  const requiredCustomerVariables = [
    "accessToken",
    "profileImagePath",
    "profileImageAssociationVersion",
    "countryCode",
    "addressId",
    "addressVersion",
    "preferencesVersion",
    "privacyPurpose",
    "privacyRequestId",
  ];
  const secretVariables = [
    "testEmail",
    "testPhone",
    "testPassword",
    "newPassword",
    "emailOtp",
    "challengeId",
    "passwordResetCode",
    "accessToken",
    "providerAdminInvitationToken",
  ];

  const requiredProviderVariables = [
    "baseUrl",
    "localHostUrl",
    "localBaseUrl",
    "hostedHostUrl",
    "hostedBaseUrl",
    "providerKind",
    "alternateProviderKind",
    "providerId",
    "providerVersion",
    "providerDisplayNameAr",
    "providerDisplayNameEn",
    "providerDescriptionAr",
    "providerDescriptionEn",
    "providerOperationalEmail",
    "providerOperationalPhone",
    "providerWhatsApp",
    "providerWebsite",
    "providerLogoPath",
    "providerCoverPath",
    "providerGalleryImagePath",
    "providerGalleryVideoPath",
    "galleryItemId",
    "providerAdminInviteEmail",
    "providerAdminInvitationToken",
    "invitationId",
    "invitedAdminPhone",
    "userId",
    "staffReviewReason",
    "staffRejectionReason",
    "staffLifecycleReason",
  ];

  for (const file of [
    "Cleanora-local.postman_environment.json",
    "Cleanora-railway.postman_environment.json",
  ]) {
    const environment = await parseJson<PostmanEnvironment>(
      resolve(postmanDirectory, file),
    );
    const values = new Map(
      environment.values.map((entry) => [entry.key, entry.value]),
    );
    for (const variable of requiredCustomerVariables) {
      assert(values.has(variable), `${file} is missing ${variable}`);
    }
    for (const variable of requiredProviderVariables) {
      assert(values.has(variable), `${file} is missing ${variable}`);
    }
    for (const variable of secretVariables) {
      assert(values.get(variable) === "", `${file} must export ${variable} empty`);
    }
  }

  const r1P05CollectionPath = resolve(
    postmanDirectory,
    "Cleanora-R1-P05.postman_collection.json",
  );
  const r1P05Collection =
    await parseJson<PostmanCollection>(r1P05CollectionPath);
  assert(
    r1P05Collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P05 collection must use Postman collection schema v2.1.0",
  );
  const r1P05RuntimeOperations = runtimeProviderOperations();
  const r1P05RequestCount = assertMirroredEnvironments({
    label: "R1-P05",
    collection: r1P05Collection,
    expectedOperations: r1P05RuntimeOperations,
  });
  const r1P05Serialized = await readFile(r1P05CollectionPath, "utf8");
  const collectionVariables = new Map(
    (r1P05Collection.variable ?? []).map((entry) => [entry.key, entry.value]),
  );
  const referencedVariables = new Set(
    [...r1P05Serialized.matchAll(/\{\{([^{}]+)\}\}/gu)].map(
      (match) => match[1]!,
    ),
  );
  for (const file of [
    "Cleanora-local.postman_environment.json",
    "Cleanora-railway.postman_environment.json",
  ]) {
    const environment = await parseJson<PostmanEnvironment>(
      resolve(postmanDirectory, file),
    );
    const environmentKeys = new Set(environment.values.map((entry) => entry.key));
    const undefinedVariables = [...referencedVariables].filter(
      (key) => !collectionVariables.has(key) && !environmentKeys.has(key),
    );
    assert(
      undefinedVariables.length === 0,
      `${file} leaves R1-P05 variables undefined: ${undefinedVariables.join(", ")}`,
    );
  }
  assert(
    collectionVariables.get("providerAdminInvitationToken") === "",
    "R1-P05 collection must export providerAdminInvitationToken empty",
  );
  assert(
    r1P05Serialized.includes("body.error.statusCode"),
    "R1-P05 response tests must validate error-envelope statusCode",
  );
  for (const forbidden of [
    "CLOUDINARY_API_SECRET",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "DATABASE_URL",
    "Bearer eyJ",
    "SMTP_PASSWORD",
  ]) {
    assert(
      !r1P05Serialized.includes(forbidden),
      `R1-P05 Postman collection contains forbidden secret material: ${forbidden}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      jsonFiles: jsonFiles.length,
      r1P00Requests: r1P00RequestCount,
      r1P01Requests: r1P01RequestCount,
      r1P02Requests: r1P02RequestCount,
      r1P04Requests: r1P04RequestCount,
      requestsPerEnvironment: {
        r1P00: r1P00RequestCount / 2,
        r1P01: r1P01RequestCount / 2,
        r1P02: r1P02RequestCount / 2,
        r1P04: r1P04RequestCount / 2,
        r1P05: r1P05RuntimeOperations.length,
      },
      r1P05Requests: r1P05RequestCount,
      r1P05RequestsPerEnvironment: r1P05RuntimeOperations.length,
      runtimeParity: true,
      environments: 2,
    })}\n`,
  );
}

void main();
