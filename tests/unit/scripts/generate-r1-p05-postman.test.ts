import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface PostmanItem {
  readonly name: string;
  readonly request?: {
    readonly method: string;
    readonly url: string | { readonly raw?: string };
    readonly body?: { readonly raw?: string };
  };
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
    "postman/Cleanora-R1-P05.postman_collection.json",
  );

  it("ships 41 safe requests aligned to the R1-P05 contract", () => {
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
    const requests = collectRequests(collection.item);
    expect(requests).toHaveLength(41);
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
