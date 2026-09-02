import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  loadR1P08OpenApiSource,
  R1_P08_PROTECTED_PATH_PREFIX,
} from "../../../src/swagger/r1-p08-openapi.paths.js";

interface PostmanHeader {
  readonly key: string;
  readonly value: string;
}

interface PostmanFormField {
  readonly key: string;
  readonly value?: string;
  readonly src?: string | readonly string[];
}

interface PostmanRequest {
  readonly method: string;
  readonly header?: readonly PostmanHeader[];
  readonly url: string | { readonly raw?: string };
  readonly body?: {
    readonly mode?: string;
    readonly raw?: string;
    readonly formdata?: readonly PostmanFormField[];
  };
}

interface PostmanItem {
  readonly name: string;
  readonly request?: PostmanRequest;
  readonly item?: readonly PostmanItem[];
}

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete"]);
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const COLLECTION_PATH = resolve(
  "postman/Cleanora-R1-P08-Catalog-Management.postman_collection.json",
);

function flattenRequests(items: readonly PostmanItem[]): PostmanItem[] {
  return items.flatMap((item) => [
    ...(item.request === undefined ? [] : [item]),
    ...flattenRequests(item.item ?? []),
  ]);
}

function requestUrl(request: PostmanRequest): string {
  return typeof request.url === "string" ? request.url : (request.url.raw ?? "");
}

function toOpenApiPath(url: string): string {
  const withoutBase = url
    .replace(/^\{\{(?:baseUrl|hostUrl)\}\}\/api\/v1/u, "")
    .split("?")[0]!;
  return withoutBase.replace(/\{\{([A-Za-z0-9_]+)\}\}/gu, "{$1}");
}

function sourceMethodPathPairs(
  paths: Readonly<Record<string, unknown>>,
): ReadonlySet<string> {
  const pairs = new Set<string>();
  for (const [path, methods] of Object.entries(paths)) {
    for (const method of Object.keys(
      methods as Readonly<Record<string, unknown>>,
    )) {
      if (HTTP_METHODS.has(method)) {
        pairs.add(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return pairs;
}

function bodyContainsKey(request: PostmanRequest, key: string): boolean {
  if (request.body?.mode === "raw" && typeof request.body.raw === "string") {
    return request.body.raw.includes(`"${key}"`);
  }
  if (request.body?.mode === "formdata") {
    return (request.body.formdata ?? []).some((field) => field.key === key);
  }
  return false;
}

describe("R1-P08 Postman schema parity", () => {
  it("ships a protected staff Catalog collection aligned to the OpenAPI source", () => {
    const serialized = readFileSync(COLLECTION_PATH, "utf8");
    const collection = JSON.parse(serialized) as {
      readonly variable: ReadonlyArray<{
        readonly key: string;
        readonly value: string;
      }>;
      readonly item: readonly PostmanItem[];
    };
    const source = loadR1P08OpenApiSource();
    const sourcePairs = sourceMethodPathPairs(source.paths);
    const requests = flattenRequests(collection.item);

    expect(
      collection.variable.find((entry) => entry.key === "baseUrl")?.value,
    ).toBe("http://localhost:8000");
    expect(
      collection.variable.find((entry) => entry.key === "hostUrl")?.value,
    ).toBe("https://YOUR-HOSTED-DOMAIN.example");
    expect(collection.item.map((folder) => folder.name)).toEqual([
      "Hosted (Not hosted yet)",
      "Local",
    ]);
    expect(requests.length).toBeGreaterThan(0);

    const hostedRequests = flattenRequests(collection.item[0]?.item ?? []);
    const localRequests = flattenRequests(collection.item[1]?.item ?? []);
    expect(hostedRequests.map((item) => item.name)).toEqual(
      localRequests.map((item) => item.name),
    );
    for (const item of hostedRequests) {
      expect(requestUrl(item.request!)).toMatch(/^\{\{hostUrl\}\}\//u);
    }
    for (const item of localRequests) {
      expect(requestUrl(item.request!)).toMatch(/^\{\{baseUrl\}\}\//u);
    }

    const postmanPairs = new Set<string>();
    for (const item of requests) {
      const request = item.request!;
      const url = requestUrl(request);
      const openApiPath = toOpenApiPath(url);
      const method = request.method.toUpperCase();
      const pair = `${method} ${openApiPath}`;

      expect(url).toMatch(
        /^\{\{(?:baseUrl|hostUrl)\}\}\/api\/v1\/staff\/catalog\//u,
      );
      expect(openApiPath.startsWith(R1_P08_PROTECTED_PATH_PREFIX)).toBe(true);
      expect(request.header ?? []).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "Authorization",
            value: "Bearer {{accessToken}}",
          }),
        ]),
      );

      if (WRITE_METHODS.has(method)) {
        expect(bodyContainsKey(request, "idempotencyKey")).toBe(true);
        expect(bodyContainsKey(request, "reasonCode")).toBe(true);
      }

      postmanPairs.add(pair);
      expect(sourcePairs.has(pair), pair).toBe(true);
    }

    expect([...postmanPairs].sort()).toEqual([...sourcePairs].sort());

    expect(serialized).not.toMatch(/"src"\s*:\s*\[\]/u);
    for (const item of requests) {
      for (const field of item.request?.body?.formdata ?? []) {
        if (field.src !== undefined) {
          expect(typeof field.src).toBe("string");
        }
      }
    }

    expect(serialized).not.toMatch(/\/api\/v1\/catalog\/services/u);
    expect(serialized).not.toMatch(/\{\{baseUrl\}\}\/api\/v1\/catalog\//u);
    expect(serialized).not.toMatch(/cloudinary\.com/iu);
    expect(serialized).not.toMatch(/res\.cloudinary/iu);
    expect(serialized).not.toMatch(/\b(sk_|api[_-]?key|secret|password)\b/iu);
    expect(serialized).not.toMatch(/https?:\/\/[^\s"]+\/(upload|delivery)\//iu);
    expect(postmanPairs.size).toBeGreaterThan(0);
  });
});
