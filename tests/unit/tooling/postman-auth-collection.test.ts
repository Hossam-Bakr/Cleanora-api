import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";

type PostmanItem = {
  readonly name?: string;
  readonly request?: {
    readonly method?: string;
    readonly url?: string | { readonly raw?: string };
    readonly body?: { readonly raw?: string };
  };
  readonly response?: readonly {
    readonly name?: string;
    readonly originalRequest?: {
      readonly body?: { readonly raw?: string };
    };
    readonly body?: string;
  }[];
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
                .replace("{{hostUrl}}", "")
                .replace("{{baseUrl}}", "")
                .split("?")[0]!
                .replace(/\/+$/u, ""),
            },
          ];
    return [...own, ...walk(item.item, path)];
  });
}

function flatten(items: readonly PostmanItem[] = []): PostmanItem[] {
  return items.flatMap((item) => [
    ...(item.request === undefined ? [] : [item]),
    ...flatten(item.item),
  ]);
}

function parseObject(raw: string | undefined): Record<string, unknown> {
  if (raw === undefined) throw new Error("Expected a JSON example body");
  return JSON.parse(raw) as Record<string, unknown>;
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

  it("contains every genuine Auth operation once per Hosted and Local environment", async () => {
    const path = resolve(
      "postman/R1-P02-authentication.postman_collection.json",
    );
    const document = JSON.parse(
      await readFile(path, "utf8"),
    ) as PostmanDocument;
    expect(document.item?.map((item) => item.name)).toEqual([
      "Hosted (Not hosted yet)",
      "Local",
    ]);
    for (const environmentFolder of document.item ?? []) {
      const requests = walk(environmentFolder.item);
      const keys = requests.map(
        (request) => `${request.method} ${request.route}`,
      );

      expect(requests).toHaveLength(17);
      expect(new Set(keys).size).toBe(keys.length);
      expect(
        requests.filter((request) => request.folder.includes("Google Authentication")),
      ).toHaveLength(5);
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
      for (const request of flatten(environmentFolder.item)) {
        expect(request.response?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it("keeps complete saved email-only signup variants", async () => {
    const document = JSON.parse(
      await readFile(
        resolve("postman/R1-P02-authentication.postman_collection.json"),
        "utf8",
      ),
    ) as PostmanDocument;
    const requests = flatten(document.item);
    const signups = requests.filter((item) => item.name === "Signup");
    expect(signups).toHaveLength(2);
    const signup = signups[0];
    expect(signup?.response).toHaveLength(3);

    const variants = signup?.response?.map((example) =>
      parseObject(example.originalRequest?.body?.raw),
    );
    expect(variants?.map((variant) => variant["accountCategory"])).toEqual([
      "INDIVIDUAL",
      "COMPANY",
      "ENGINEER",
    ]);
    expect(variants?.[0]).toHaveProperty("fullName");
    expect(variants?.[1]).toMatchObject({
      companyName: "{{companyName}}",
      representativeFullName: "{{representativeFullName}}",
    });
    expect(variants?.[2]).toMatchObject({
      fullName: "{{engineerFullName}}",
      professionalTitle: "{{professionalTitle}}",
    });

    const signupResponses = signup?.response?.map((example) => {
      const envelope = parseObject(example.body);
      return envelope["data"] as Record<string, unknown>;
    });
    expect(signupResponses?.map((response) => response["channel"])).toEqual([
      "EMAIL",
      "EMAIL",
      "EMAIL",
    ]);
    for (const response of signupResponses ?? []) {
      expect(response).toEqual(
        expect.objectContaining({
          accepted: true,
          challengeId: "<challenge-id>",
          nextAction: "VERIFY_ACCOUNT",
          purpose: "CATEGORY_VERIFICATION",
          maskedDestination: expect.any(String),
          expiresAt: expect.any(String),
          resendAvailableAt: expect.any(String),
        }),
      );
    }

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
      "commercialRegistrationNumber",
      "taxRegistrationNumber",
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
