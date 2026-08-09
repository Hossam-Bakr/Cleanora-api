import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

type PostmanItem = {
  readonly name?: string;
  readonly request?: {
    readonly method?: string;
    readonly url?: string | { readonly raw?: string };
  };
  readonly item?: readonly PostmanItem[];
};

type PostmanDocument = {
  readonly item?: readonly PostmanItem[];
  readonly values?: readonly { readonly key?: string }[];
};

function walk(
  items: readonly PostmanItem[] = [],
  parents: readonly string[] = [],
): Array<{ name: string; folder: string; method: string; route: string }> {
  return items.flatMap((item) => {
    const path = [...parents, item.name ?? "unnamed"];
    const raw =
      typeof item.request?.url === "string"
        ? item.request.url
        : item.request?.url?.raw;
    const own =
      item.request?.method === undefined || raw === undefined
        ? []
        : [
            {
              name: item.name ?? "unnamed",
              folder: parents.join(" / "),
              method: item.request.method.toUpperCase(),
              route: raw
                .replace(/\{\{(?:hostUrl|hostedUrl|localUrl)\}\}/u, "")
                .split("?")[0]!
                .replace(/\/+$/u, ""),
            },
          ];
    return [...own, ...walk(item.item, path)];
  });
}

describe("canonical Auth Postman artifacts", () => {
  it("parses every Postman JSON artifact", async () => {
    const files = (await readdir(resolve("postman"))).filter((file) =>
      file.endsWith(".json"),
    );
    for (const file of files) {
      await expect(
        readFile(resolve("postman", file), "utf8").then((text) =>
          JSON.parse(text),
        ),
      ).resolves.toBeDefined();
    }
  });

  it("contains every genuine Auth operation once with one Google folder", async () => {
    const path = resolve(
      "postman/R1-P02-authentication.postman_collection.json",
    );
    const document = JSON.parse(
      await readFile(path, "utf8"),
    ) as PostmanDocument;
    const requests = walk(document.item);
    const keys = requests.map(
      (request) => `${request.method} ${request.route}`,
    );

    expect(document.item?.map((item) => item.name)).toEqual(["Hosted", "Local"]);
    expect(requests).toHaveLength(34);
    for (const target of ["Hosted", "Local"]) {
      const targetRequests = requests.filter((request) =>
        request.folder.startsWith(`${target} /`),
      );
      const targetKeys = targetRequests.map(
        (request) => `${request.method} ${request.route}`,
      );
      expect(targetRequests).toHaveLength(17);
      expect(new Set(targetKeys).size).toBe(targetKeys.length);
    }
    expect(
      requests.filter((request) =>
        request.folder.includes("Google Authentication"),
      ),
    ).toHaveLength(10);
    expect(
      requests.filter((request) => request.folder.includes("Google")),
    ).toHaveLength(10);
    expect(keys).toEqual(
      expect.arrayContaining([
        "POST /auth/signup",
        "POST /auth/login",
        "POST /auth/refresh",
        "GET /auth/google/browser",
        "GET /auth/google/callback",
      ]),
    );
    expect(keys).not.toContain("GET /auth/google/result");
    expect(
      requests.map((request) => request.name).join("\n"),
    ).not.toMatch(
      /Duplicate|Invalid Login|Reject Multiple|Reject Predictable|Worker Self-Signup/iu,
    );
  });

  it("has no second Auth or Google collection and shares the canonical environment", async () => {
    const files = await readdir(resolve("postman"));
    expect(
      files.filter((file) =>
        /R1-P02-(?:authentication|google).*collection\.json$/iu.test(file),
      ),
    ).toEqual(["R1-P02-authentication.postman_collection.json"]);

    const environmentPath = resolve(
      "postman/Cleanora-local.postman_environment.json",
    );
    const environment = JSON.parse(
      await readFile(environmentPath, "utf8"),
    ) as PostmanDocument;
    expect(environment.values?.map((value) => value.key)).toEqual([
      "hostUrl",
      "hostedUrl",
      "localUrl",
      "swaggerUrl",
      "frontendUrl",
      "origin",
      "testEmail",
      "testPhone",
      "testPassword",
      "newPassword",
      "emailOtp",
      "challengeId",
      "passwordResetCode",
      "accessToken",
      "individualFullName",
      "companyName",
      "representativeFullName",
      "engineerFullName",
      "professionalTitle",
      "profileImagePath",
      "profileImageAssociationVersion",
      "countryCode",
      "city",
      "district",
      "addressText",
      "building",
      "floor",
      "addressNotes",
      "addressId",
      "addressVersion",
      "preferencesVersion",
      "privacyPurpose",
      "privacyRequestId",
    ]);
    expect(basename(environmentPath)).toBe(
      "Cleanora-local.postman_environment.json",
    );

    const railwayEnvironment = JSON.parse(
      await readFile(
        resolve("postman/Cleanora-railway.postman_environment.json"),
        "utf8",
      ),
    ) as PostmanDocument;
    expect(railwayEnvironment.values?.map((value) => value.key)).toEqual(
      environment.values?.map((value) => value.key),
    );
  });

  // R1-P03 is internal only: it adds no request to any published collection.
  it("adds no R1-P03 role, permission, or audit request", async () => {
    const files = (await readdir(resolve("postman"))).filter((file) =>
      file.endsWith(".json"),
    );

    for (const file of files) {
      const document = JSON.parse(
        await readFile(resolve("postman", file), "utf8"),
      ) as PostmanDocument;

      for (const request of walk(document.item)) {
        expect(request.route).not.toMatch(
          /\/(roles?|permissions?|user-roles|privileged|audit)\b/iu,
        );
      }
    }
  });
});
