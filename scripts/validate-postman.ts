import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { cleanoraOpenApiDocument } from "../src/swagger/openapi.document.js";

interface PostmanRequest {
  readonly method: string;
  readonly url: string | { readonly raw?: string };
}

interface PostmanItem {
  readonly name: string;
  readonly request?: PostmanRequest;
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

function collectRequests(items: readonly PostmanItem[]): PostmanRequest[] {
  return items.flatMap((item) => [
    ...(item.request === undefined ? [] : [item.request]),
    ...collectRequests(item.item ?? []),
  ]);
}

function rawUrl(request: PostmanRequest): string {
  return typeof request.url === "string" ? request.url : (request.url.raw ?? "");
}

function normalizeCollectionRoute(url: string): string {
  return url
    .replace(/^\{\{hostUrl\}\}/u, "")
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

  const collectionOperations = collectRequests(collection.item)
    .map(
      (request) =>
        `${request.method.toUpperCase()} ${normalizeCollectionRoute(rawUrl(request))}`,
    )
    .sort();
  const runtimeOperations = runtimeCustomerOperations();

  assert(
    collectionOperations.length === 21,
    `R1-P04 Postman collection must contain 21 requests; found ${collectionOperations.length}`,
  );
  assert(
    new Set(collectionOperations).size === collectionOperations.length,
    "R1-P04 Postman collection contains duplicate method/path entries",
  );
  assert(
    JSON.stringify(collectionOperations) === JSON.stringify(runtimeOperations),
    `R1-P04 Postman operations differ from runtime Swagger.\nPostman: ${JSON.stringify(collectionOperations)}\nSwagger: ${JSON.stringify(runtimeOperations)}`,
  );

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
  const r1P05Requests = collectRequests(r1P05Collection.item);
  assert(
    r1P05Requests.length === 41,
    `R1-P05 Postman collection must contain 41 requests; found ${r1P05Requests.length}`,
  );
  const r1P05CollectionOperations = r1P05Requests
    .map(
      (request) =>
        `${request.method.toUpperCase()} ${normalizeCollectionRoute(rawUrl(request))}`,
    )
    .sort();
  const r1P05RuntimeOperations = runtimeProviderOperations();
  assert(
    new Set(r1P05CollectionOperations).size ===
      r1P05CollectionOperations.length,
    "R1-P05 Postman collection contains duplicate method/path entries",
  );
  assert(
    JSON.stringify(r1P05CollectionOperations) ===
      JSON.stringify(r1P05RuntimeOperations),
    `R1-P05 Postman operations differ from runtime Swagger.\nPostman: ${JSON.stringify(r1P05CollectionOperations)}\nSwagger: ${JSON.stringify(r1P05RuntimeOperations)}`,
  );
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
      r1P04Requests: collectionOperations.length,
      r1P05Requests: r1P05CollectionOperations.length,
      runtimeParity: true,
      environments: 2,
    })}\n`,
  );
}

void main();
