import { readFile } from "node:fs/promises";
import { join } from "node:path";


interface PostmanItem {
  readonly name: string;
  readonly request?: { readonly url?: string };
  readonly response?: Array<{ readonly name?: string }>;
  readonly item?: PostmanItem[];
  readonly event?: Array<{
    readonly listen: string;
    readonly script?: { readonly exec?: string[] };
  }>;
}

describe("R1-P01 Postman collection", () => {
  it("asserts status, envelopes, and correlated request IDs for the health trio", async () => {
    const collection = JSON.parse(
      await readFile(
        join(
          process.cwd(),
          "postman/R1-P01-foundation-country-configuration.postman_collection.json"
        ),
        "utf8"
      )
    ) as { readonly item: PostmanItem[] };
    expect(collection.item.map((item) => item.name)).toEqual([
      "Hosted (Not hosted yet)",
      "Local",
    ]);
    for (const environmentFolder of collection.item) {
      const healthFolder = environmentFolder.item?.find(
        (item) => item.name === "System Health",
      );
      expect(healthFolder).toBeDefined();

      for (const name of ["Live", "Ready", "Database"]) {
        const request = healthFolder?.item?.find((item) => item.name === name);
        const testScript = request?.event
          ?.find((event) => event.listen === "test")
          ?.script?.exec?.join("\n");

        expect(testScript, `${name} test script`).toContain("pm.response.code");
        expect(testScript, `${name} success envelope`).toContain("body.success");
        expect(testScript, `${name} requestId body`).toContain("body.requestId");
        expect(testScript, `${name} requestId header`).toContain("x-request-id");
        expect(request?.response?.some((example) => example.name === "Success")).toBe(
          true,
        );
        expect(String(request?.request?.url)).toContain(
          environmentFolder.name === "Local" ? "{{baseUrl}}" : "{{hostUrl}}",
        );
      }

      const readyScript = healthFolder?.item
        ?.find((item) => item.name === "Ready")
        ?.event?.[0]?.script?.exec?.join("\n");
      const databaseScript = healthFolder?.item
        ?.find((item) => item.name === "Database")
        ?.event?.[0]?.script?.exec?.join("\n");
      expect(readyScript).toContain("DEPENDENCY_NOT_READY");
      expect(databaseScript).toContain("DATABASE_UNAVAILABLE");
    }
  });
});
