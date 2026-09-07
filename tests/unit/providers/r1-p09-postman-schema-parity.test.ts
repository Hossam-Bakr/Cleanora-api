import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  isR1P09ProtectedPath,
  loadR1P09OpenApiSource,
  R1_P09_OPENAPI_OPERATIONS,
} from "../../../src/swagger/r1-p09-openapi.paths.js";

interface PostmanHeader {
  readonly key: string;
  readonly value: string;
}

interface PostmanRequest {
  readonly method: string;
  readonly header?: readonly PostmanHeader[];
  readonly url: string | { readonly raw?: string };
  readonly body?: {
    readonly mode?: string;
    readonly raw?: string;
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
  "postman/Cleanora-R1-P09-Provider-Services.postman_collection.json",
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
  return false;
}

describe("R1-P09 Postman schema parity", () => {
  it("ships a protected Provider-services collection aligned to the OpenAPI source", () => {
    const serialized = readFileSync(COLLECTION_PATH, "utf8");
    const collection = JSON.parse(serialized) as {
      readonly info: { readonly description?: string };
      readonly variable: ReadonlyArray<{
        readonly key: string;
        readonly value: string;
      }>;
      readonly item: readonly PostmanItem[];
    };
    const source = loadR1P09OpenApiSource();
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
    expect(requests.length).toBe(22);
    expect(sourcePairs.size).toBe(11);
    expect(R1_P09_OPENAPI_OPERATIONS).toHaveLength(11);

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
        /^\{\{(?:baseUrl|hostUrl)\}\}\/api\/v1\/(?:providers|staff\/providers)\//u,
      );
      expect(isR1P09ProtectedPath(openApiPath)).toBe(true);
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
        expect(bodyContainsKey(request, "expectedVersion")).toBe(true);
        for (const forbidden of [
          "subtotal",
          "total",
          "tax",
          "fee",
          "discount",
          "commission",
          "deposit",
          "payable",
        ]) {
          expect(bodyContainsKey(request, forbidden)).toBe(false);
        }
      }

      postmanPairs.add(pair);
      expect(sourcePairs.has(pair), pair).toBe(true);
    }

    expect([...postmanPairs].sort()).toEqual([...sourcePairs].sort());

    expect(collection.info.description).toMatch(/No anonymous Browse or Booking/iu);
    expect(serialized).not.toMatch(/\/api\/v1\/browse/iu);
    expect(serialized).not.toMatch(/\/api\/v1\/booking/iu);
    expect(serialized).not.toMatch(/\/api\/v1\/catalog\/services/u);
    expect(serialized).not.toMatch(/\b(sk_|api[_-]?key|secret|password)\b/iu);
  });
});
