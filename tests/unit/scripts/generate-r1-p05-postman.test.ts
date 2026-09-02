import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PostmanItem {
  readonly name: string;
  readonly request?: {
    readonly method: string;
    readonly url: string | { readonly raw?: string };
    readonly body?: {
      readonly mode?: string;
      readonly raw?: string;
      readonly formdata?: ReadonlyArray<{
        readonly key: string;
        readonly type: string;
        readonly src?: string;
        readonly value?: string;
      }>;
    };
  };
  readonly response?: ReadonlyArray<{
    readonly name: string;
    readonly code: number;
    readonly body: string;
    readonly originalRequest?: {
      readonly method: string;
      readonly body?: { readonly raw?: string; readonly mode?: string };
    };
  }>;
  readonly item?: readonly PostmanItem[];
}

function collectRequests(items: readonly PostmanItem[]): PostmanItem[] {
  return items.flatMap((item) => [
    ...(item.request === undefined ? [] : [item]),
    ...collectRequests(item.item ?? []),
  ]);
}

describe("generate-r1-p05-postman (T147)", () => {
  const collectionPath = resolve(
    "postman/Cleanora-R1-P05-Provider-Onboarding.postman_collection.json",
  );

  it("ships identical 41-request Hosted and Local trees aligned to the R1-P05 contract", () => {
    const collection = JSON.parse(
      readFileSync(collectionPath, "utf8"),
    ) as {
      info: { schema: string; name: string };
      item: PostmanItem[];
      variable: Array<{ key: string; value: string }>;
    };

    expect(collection.info.schema).toContain(
      "collection/v2.1.0/collection.json",
    );
    expect(collection.item.map((item) => item.name)).toEqual([
      "Hosted (Not hosted yet)",
      "Local",
    ]);
    for (const environmentFolder of collection.item) {
      const environmentRequests = collectRequests(environmentFolder.item ?? []);
      expect(environmentRequests).toHaveLength(41);
      const expectedPrefix =
        environmentFolder.name === "Local" ? "{{baseUrl}}" : "{{hostUrl}}";
      for (const request of environmentRequests) {
        expect(String(request.request?.url)).toMatch(
          new RegExp(`^${expectedPrefix.replace(/[{}]/gu, "\\$&")}`),
        );
      }
    }
    const requests = collectRequests(collection.item);
    expect(requests).toHaveLength(82);
    for (const request of requests) {
      expect(request.response).toHaveLength(1);
      expect(request.response?.[0]?.name).toBe("Success");
      expect(JSON.parse(request.response?.[0]?.body ?? "{}")).toEqual(
        expect.objectContaining({
          success: true,
          data: expect.anything(),
          requestId: "request_example_01",
        }),
      );
      expect(request.response?.[0]?.originalRequest?.method).toBe(
        request.request?.method,
      );
      if (request.request?.body?.raw !== undefined) {
        expect(request.response?.[0]?.originalRequest?.body?.raw).toBe(
          request.request.body.raw,
        );
      }
    }
    expect(collection.variable).toEqual(
      expect.arrayContaining([
        { key: "providerId", value: "", type: "string" },
        {
          key: "providerAdminInvitationToken",
          value: "",
          type: "string",
        },
      ]),
    );

    const suspend = requests.find((item) => item.name === "Suspend Provider");
    const reinstate = requests.find(
      (item) => item.name === "Reinstate Provider",
    );
    expect(suspend?.request?.method).toBe("POST");
    expect(String(suspend?.request?.url)).toContain(
      "/staff/providers/{{providerId}}/suspend",
    );
    expect(reinstate?.request?.method).toBe("POST");
    expect(String(reinstate?.request?.url)).toContain(
      "/staff/providers/{{providerId}}/reinstate",
    );

    const create = requests.find(
      (item) => item.name === "Create Provider Application",
    );
    expect(create?.request?.body?.raw).toContain('"providerKind"');
    expect(create?.request?.body?.raw).not.toMatch(/"kind"\s*:/);

    const upload = requests.find((item) => item.name === "Replace Logo");
    expect(upload?.request?.body?.mode).toBe("formdata");
    expect(upload?.request?.body?.formdata).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "file", type: "file" }),
        expect.objectContaining({
          key: "expectedVersion",
          value: "{{providerVersion}}",
        }),
      ]),
    );

    const serialized = readFileSync(collectionPath, "utf8");
    for (const forbidden of [
      "CLOUDINARY_API_SECRET",
      "JWT_ACCESS_SECRET",
      "JWT_REFRESH_SECRET",
      "DATABASE_URL",
      "Bearer eyJ",
      "SMTP_PASSWORD",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
