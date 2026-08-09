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
  readonly response?: readonly { readonly name?: string }[];
  readonly item?: readonly PostmanItem[];
}

interface PostmanCollection {
  readonly info: { readonly schema: string };
  readonly item: readonly PostmanItem[];
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
    .replace(/^\{\{(?:hostUrl|hostedUrl|localUrl)\}\}/u, "")
    .replace(/\{\{([^{}]+)\}\}/gu, "{$1}");
}

function targetFolder(
  collection: PostmanCollection,
  name: "Hosted" | "Local",
): PostmanItem {
  const folder = collection.item.find((item) => item.name === name);
  assert(folder !== undefined, `Collection is missing the ${name} folder`);
  return folder;
}

function assertSavedExamples(
  collectionName: string,
  items: readonly PostmanItem[],
): void {
  for (const item of items) {
    if (item.request !== undefined) {
      assert(
        item.response?.some((response) => response.name === "Success") === true,
        `${collectionName} / ${item.name} is missing the Success example`,
      );
      if (item.request.body !== undefined) {
        assert(
          item.response?.some(
            (response) => response.name === "Sample of correct body",
          ) === true,
          `${collectionName} / ${item.name} is missing Sample of correct body`,
        );
      }
    }
    assertSavedExamples(collectionName, item.item ?? []);
  }
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
  for (const target of ["Hosted", "Local"] as const) {
    const collectionOperations = collectRequests(
      targetFolder(collection, target).item ?? [],
    )
      .map(
        (request) =>
          `${request.method.toUpperCase()} ${normalizeCollectionRoute(rawUrl(request))}`,
      )
      .sort();
    assert(
      collectionOperations.length === 22,
      `R1-P04 ${target} folder must contain 22 requests; found ${collectionOperations.length}`,
    );
    assert(
      new Set(collectionOperations).size === collectionOperations.length,
      `R1-P04 ${target} folder contains duplicate method/path entries`,
    );
    assert(
      JSON.stringify(collectionOperations) === JSON.stringify(runtimeOperations),
      `R1-P04 ${target} operations differ from runtime Swagger.\nPostman: ${JSON.stringify(collectionOperations)}\nSwagger: ${JSON.stringify(runtimeOperations)}`,
    );
  }
  assertSavedExamples("R1-P04", collection.item);

  for (const file of [
    "R1-P00-foundation.postman_collection.json",
    "R1-P01-foundation-country-configuration.postman_collection.json",
    "R1-P02-authentication.postman_collection.json",
  ]) {
    const phaseCollection = await parseJson<PostmanCollection>(
      resolve(postmanDirectory, file),
    );
    targetFolder(phaseCollection, "Hosted");
    targetFolder(phaseCollection, "Local");
    assertSavedExamples(file, phaseCollection.item);
  }

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
    assert(
      values.get("hostedUrl") ===
        "https://cleanora-production.up.railway.app/api/v1",
      `${file} has an invalid hostedUrl`,
    );
    assert(
      values.get("localUrl") === "http://localhost:8000/api/v1",
      `${file} has an invalid localUrl`,
    );
    for (const variable of requiredCustomerVariables) {
      assert(values.has(variable), `${file} is missing ${variable}`);
    }
    for (const variable of secretVariables) {
      assert(values.get(variable) === "", `${file} must export ${variable} empty`);
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      jsonFiles: jsonFiles.length,
      r1P04RequestsPerTarget: runtimeOperations.length,
      targets: ["Hosted", "Local"],
      runtimeParity: true,
      environments: 2,
    })}\n`,
  );
}

void main();
