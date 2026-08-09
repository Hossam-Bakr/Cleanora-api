import { readFile } from "node:fs/promises";
import { join } from "node:path";


interface PostmanItem {
  readonly name: string;
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
    expect(collection.item.map((item) => item.name)).toEqual(["Hosted", "Local"]);

    for (const target of ["Hosted", "Local"]) {
      const targetFolder = collection.item.find((item) => item.name === target);
      const healthFolder = targetFolder?.item?.find(
        (item) => item.name === "System health",
      );
      expect(healthFolder).toBeDefined();

      for (const name of ["Live", "Ready", "Database"]) {
        const request = healthFolder?.item?.find((item) => item.name === name);
        const testScript = request?.event
          ?.find((event) => event.listen === "test")
          ?.script?.exec?.join("\n");

        expect(testScript, `${target} ${name} test script`).toContain(
          "pm.response.code",
        );
        expect(testScript, `${target} ${name} success envelope`).toContain(
          "body.success",
        );
        expect(testScript, `${target} ${name} requestId body`).toContain(
          "body.requestId",
        );
        expect(testScript, `${target} ${name} requestId header`).toContain(
          "x-request-id",
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
