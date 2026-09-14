import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

import { cleanoraOpenApiDocument } from "../src/swagger/openapi.document.js";
import { loadR1P06OpenApiSource, r1P06OperationInventory } from "../src/swagger/r1-p06-openapi.paths.js";
import { R1_P05_IMPLEMENTED_OPERATIONS } from "../src/swagger/r1-p05-openapi.paths.js";
import { R1_P07_OPENAPI_OPERATIONS } from "../src/swagger/r1-p07-openapi.paths.js";
import {
  createWorkerSchema,
  invitationAcceptSchema,
  invitationEmailVerificationSchema,
  invitationOnboardingStartSchema,
  invitationProofSchema,
  replaceTeamNameSchema,
  replaceWorkerProfileSchema,
  teamDraftSchema,
  teamLifecycleCommandSchema,
  teamMembershipCommandSchema,
  teamSupervisorCommandSchema,
  workerAdminMembershipCommandSchema,
  workerAvatarCommandSchema,
  workerLeaveCommandSchema,
  workerLifecycleCommandSchema,
  workerLoginAccessCommandSchema,
} from "../src/modules/providers/provider-workforce.schema.js";

interface PostmanBody {
  readonly mode?: string;
  readonly raw?: string;
  readonly formdata?: readonly {
    readonly key: string;
    readonly type?: string;
    readonly src?: string;
    readonly value?: string;
  }[];
}

interface PostmanRequest {
  readonly method: string;
  readonly url: string | { readonly raw?: string };
  readonly body?: PostmanBody;
}

interface PostmanEvent {
  readonly listen?: string;
  readonly script?: { readonly exec?: readonly string[] };
}

interface PostmanItem {
  readonly name: string;
  readonly request?: PostmanRequest;
  readonly response?: readonly {
    readonly name?: string;
    readonly code?: number;
    readonly body?: string;
    readonly originalRequest?: PostmanRequest;
  }[];
  readonly item?: readonly PostmanItem[];
  readonly event?: readonly PostmanEvent[];
}

interface PostmanCollection {
  readonly info: { readonly schema: string };
  readonly item: readonly PostmanItem[];
  readonly variable?: readonly EnvironmentValue[];
  readonly event?: readonly PostmanEvent[];
}

interface EnvironmentValue {
  readonly key: string;
  readonly value: unknown;
}

interface PostmanEnvironment {
  readonly values: readonly EnvironmentValue[];
}

function rawUrl(request: PostmanRequest): string {
  return typeof request.url === "string" ? request.url : (request.url.raw ?? "");
}

function normalizeCollectionRoute(url: string): string {
  return url
    .replace(/^\{\{hostUrl\}\}/u, "")
    .replace(/^\{\{baseUrl\}\}/u, "")
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

function runtimeAuthenticationOperations(): string[] {
  return Object.entries(cleanoraOpenApiDocument.paths)
    .filter(
      ([path]) =>
        path.startsWith("/auth/") &&
        !path.startsWith("/auth/role-grants/") &&
        path !== "/auth/sensitive-action-proofs",
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

function runtimeBrowseOperations(): string[] {
  return Object.entries(cleanoraOpenApiDocument.paths)
    .filter(([path]) => path.startsWith("/browse/"))
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => ["get", "post", "put", "patch", "delete"].includes(method))
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    )
    .sort();
}

function runtimeBookingOperations(): string[] {
  return Object.entries(cleanoraOpenApiDocument.paths)
    .filter(([path]) => path === "/bookings" || path.startsWith("/bookings/"))
    .flatMap(([path, pathItem]) =>
      Object.entries(pathItem)
        .filter(([method]) => ["get", "post", "put", "patch", "delete"].includes(method))
        .map(([method]) => `${method.toUpperCase()} ${path}`),
    )
    .sort();
}

function eventScript(events: readonly PostmanEvent[] | undefined): string {
  return (events ?? []).flatMap((event) => event.script?.exec ?? []).join("\n");
}

function assertR1P12Collection(collection: PostmanCollection): number {
  const expectedFolders = ["Hosted (Not hosted yet)", "Local"];
  assert(
    collection.item.map((item) => item.name).sort().join("|") ===
      expectedFolders.sort().join("|"),
    "R1-P12 must contain mirrored Local and Hosted folders",
  );
  const expectedOperations = runtimeBrowseOperations();
  let total = 0;
  for (const folder of collection.item) {
    const requests = collectRequestItems(folder.item ?? []);
    total += requests.length;
    const prefix = folder.name === "Local" ? "{{baseUrl}}" : "{{hostUrl}}";
    for (const item of requests) {
      assert(
        item.request !== undefined && rawUrl(item.request).startsWith(prefix),
        `R1-P12 ${folder.name}/${item.name} must start with ${prefix}`,
      );
    }
    const primaryOperations = requests
      .filter(
        (item) =>
          !item.name.startsWith("Validation error") &&
          !item.name.startsWith("Not found"),
      )
      .map((item) => {
        const request = item.request!;
        const route = normalizeCollectionRoute(rawUrl(request))
          .split("?")[0]!
          .replace(/^\/api\/v1/u, "");
        return `${request.method.toUpperCase()} ${route}`;
      })
      .sort();
    assert(
      JSON.stringify(primaryOperations) === JSON.stringify(expectedOperations),
      `R1-P12 ${folder.name} operations differ from runtime OpenAPI.\nPostman: ${JSON.stringify(primaryOperations)}\nExpected: ${JSON.stringify(expectedOperations)}`,
    );
    const validationScript = eventScript(
      requests.find((item) => item.name.startsWith("Validation error"))?.event,
    );
    assert(
      validationScript.includes("400") && validationScript.includes("VALIDATION_FAILED"),
      `R1-P12 ${folder.name} must assert the validation failure contract`,
    );
    const notFoundScript = eventScript(
      requests.find((item) => item.name.startsWith("Not found"))?.event,
    );
    assert(
      notFoundScript.includes("404") &&
        notFoundScript.includes("BROWSE_PROVIDER_NOT_FOUND"),
      `R1-P12 ${folder.name} must assert the non-enumerating not-found contract`,
    );
  }
  const collectionScript = eventScript(collection.event);
  assert(
    collectionScript.includes("body.requestId") &&
      collectionScript.includes("body.error.statusCode") &&
      collectionScript.includes("body.success"),
    "R1-P12 collection tests must assert success/error envelopes and requestId",
  );
  return total;
}

function assertR1P13Collection(collection: PostmanCollection): number {
  const expectedFolders = ["Hosted (Not hosted yet)", "Local"];
  assert(
    collection.item.map((item) => item.name).sort().join("|") ===
      expectedFolders.sort().join("|"),
    "R1-P13 must contain mirrored Local and Hosted folders",
  );
  const expectedOperations = runtimeBookingOperations();
  let total = 0;
  for (const folder of collection.item) {
    const requests = collectRequestItems(folder.item ?? []);
    total += requests.length;
    const prefix = folder.name === "Local" ? "{{baseUrl}}" : "{{hostUrl}}";
    for (const item of requests) {
      assert(
        item.request !== undefined && rawUrl(item.request).startsWith(prefix),
        `R1-P13 ${folder.name}/${item.name} must start with ${prefix}`,
      );
    }
    const primaryOperations = requests
      .filter(
        (item) =>
          !item.name.startsWith("Validation error") &&
          !item.name.startsWith("Not found"),
      )
      .map((item) => {
        const request = item.request!;
        const route = normalizeCollectionRoute(rawUrl(request))
          .split("?")[0]!
          .replace(/^\/api\/v1/u, "");
        return `${request.method.toUpperCase()} ${route}`;
      })
      .sort();
    assert(
      JSON.stringify(primaryOperations) === JSON.stringify(expectedOperations),
      `R1-P13 ${folder.name} operations differ from runtime OpenAPI.\nPostman: ${JSON.stringify(primaryOperations)}\nExpected: ${JSON.stringify(expectedOperations)}`,
    );
    const validationScript = eventScript(
      requests.find((item) => item.name.startsWith("Validation error"))?.event,
    );
    assert(
      validationScript.includes("400") && validationScript.includes("VALIDATION_FAILED"),
      `R1-P13 ${folder.name} must assert the validation failure contract`,
    );
    const notFoundScript = eventScript(
      requests.find((item) => item.name.startsWith("Not found"))?.event,
    );
    assert(
      notFoundScript.includes("404") && notFoundScript.includes("NOT_FOUND"),
      `R1-P13 ${folder.name} must assert the non-enumerating not-found contract`,
    );
  }
  const collectionScript = eventScript(collection.event);
  assert(
    collectionScript.includes("body.requestId") &&
      collectionScript.includes("body.error.statusCode") &&
      collectionScript.includes("body.success"),
    "R1-P13 collection tests must assert success/error envelopes and requestId",
  );
  return total;
}

function assertMirroredEnvironments(input: {
  readonly label: string;
  readonly collection: PostmanCollection;
  readonly expectedOperations: readonly string[];
}): number {
  const expectedFolders = ["Hosted (Not hosted yet)", "Local"];
  assert(
    input.collection.item.map((item) => item.name).join("|") ===
      expectedFolders.join("|"),
    `${input.label} must contain Hosted (Not hosted yet) and Local top-level folders`,
  );
  let total = 0;
  for (const environmentFolder of input.collection.item) {
    const requestItems = collectRequestItems(environmentFolder.item ?? []);
    const requests = requestItems.flatMap((item) =>
      item.request === undefined ? [] : [item.request],
    );
    total += requests.length;
    const expectedUrlPrefix =
      environmentFolder.name === "Local" ? "{{baseUrl}}" : "{{hostUrl}}";
    for (const request of requests) {
      assert(
        rawUrl(request).startsWith(expectedUrlPrefix),
        `${input.label} ${environmentFolder.name} request must start with ${expectedUrlPrefix}: ${rawUrl(request)}`,
      );
    }
    const operations = requests
      .map(
        (request) =>
          `${request.method.toUpperCase()} ${normalizeCollectionRoute(rawUrl(request))}`,
      )
      .sort();
    assert(
      JSON.stringify(operations) ===
        JSON.stringify([...input.expectedOperations].sort()),
      `${input.label} ${environmentFolder.name} operations differ from the expected contract.\nPostman: ${JSON.stringify(operations)}\nExpected: ${JSON.stringify([...input.expectedOperations].sort())}`,
    );
    for (const item of requestItems) {
      const successExample = (item.response ?? []).find((example) =>
        example.name?.startsWith("Success"),
      );
      assert(
        successExample !== undefined,
        `${input.label} ${environmentFolder.name}/${item.name} is missing a Success saved example`,
      );
      if (item.request?.body !== undefined) {
        assert(
          JSON.stringify(successExample.originalRequest?.body) ===
            JSON.stringify(item.request.body),
          `${input.label} ${environmentFolder.name}/${item.name} Success example must preserve the required request body`,
        );
      }
    }
  }
  return total;
}

function collectRequestItems(items: readonly PostmanItem[]): PostmanItem[] {
  return items.flatMap((item) => [
    ...(item.request === undefined ? [] : [item]),
    ...collectRequestItems(item.item ?? []),
  ]);
}

function runtimeProviderOperations(): string[] {
  return [...R1_P05_IMPLEMENTED_OPERATIONS].sort();
}

const r1P07RequestSchemas = {
  createProviderWorkerDraft: createWorkerSchema,
  replaceProviderWorkerProfile: replaceWorkerProfileSchema,
  removeProviderWorkerAvatar: workerAvatarCommandSchema,
  commandProviderWorkerLifecycle: workerLifecycleCommandSchema,
  commandProviderWorkerLoginAccess: workerLoginAccessCommandSchema,
  commandProviderWorkerAdminMembership: workerAdminMembershipCommandSchema,
  createProviderTeamDraft: teamDraftSchema,
  replaceProviderTeamName: replaceTeamNameSchema,
  commandProviderTeamLifecycle: teamLifecycleCommandSchema,
  commandProviderTeamMembership: teamMembershipCommandSchema,
  commandProviderTeamSupervisor: teamSupervisorCommandSchema,
  leaveCurrentProvider: workerLeaveCommandSchema,
  inspectWorkerInvitation: invitationProofSchema,
  startWorkerInvitationOnboarding: invitationOnboardingStartSchema,
  verifyWorkerInvitationEmail: invitationEmailVerificationSchema,
  acceptWorkerInvitation: invitationAcceptSchema,
} as const;

const r1P07SampleVariables: Readonly<Record<string, string>> = {
  workerId: "synthetic-worker-id",
  workerOperationalPhone: "+201012345678",
  workerInvitationEmail: "worker@example.test",
  recentAuthenticationProof: "synthetic-recent-authentication-proof",
  invitationProof: "synthetic-invitation-proof",
  workerPassword: "Synthetic-Password-Only!",
  workerInvitationChallengeId: "synthetic-challenge-id",
  workerEmailCode: "123456",
};

function materializeR1P07Sample(value: unknown): unknown {
  if (typeof value === "string") {
    const exactVariable = /^\{\{([^{}]+)\}\}$/u.exec(value)?.[1];
    if (exactVariable === undefined) return value;
    const materialized = r1P07SampleVariables[exactVariable];
    assert(materialized !== undefined, `R1-P07 request body references unsupported sample variable: ${exactVariable}`);
    return materialized;
  }
  if (Array.isArray(value)) return value.map(materializeR1P07Sample);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, materializeR1P07Sample(entry)]));
  }
  return value;
}

function assertR1P07RequestBodies(collection: PostmanCollection): number {
  let validated = 0;
  for (const item of collectRequestItems(collection.item)) {
    const request = item.request;
    if (request === undefined || request.body === undefined) continue;

    if (item.name === "uploadProviderWorkerAvatar") {
      assert(request.body.mode === "formdata", "R1-P07 uploadProviderWorkerAvatar must use multipart form-data");
      const formdata = new Map((request.body.formdata ?? []).map((entry) => [entry.key, entry]));
      assert(formdata.get("file")?.type === "file", "R1-P07 uploadProviderWorkerAvatar must include a file part");
      const avatarResult = workerAvatarCommandSchema.safeParse({
        expectedVersion: Number(formdata.get("expectedVersion")?.value),
        idempotencyKey: formdata.get("idempotencyKey")?.value,
      });
      assert(
        avatarResult.success,
        `R1-P07 uploadProviderWorkerAvatar multipart command fails runtime validation: ${avatarResult.error?.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ")}`,
      );
      validated += 1;
      continue;
    }

    const schema = r1P07RequestSchemas[item.name as keyof typeof r1P07RequestSchemas];
    assert(schema !== undefined, `R1-P07 ${item.name} has a body but no runtime-schema validation mapping`);
    assert(request.body.mode === "raw" && typeof request.body.raw === "string", `R1-P07 ${item.name} must use a raw JSON body`);
    const result = schema.safeParse(materializeR1P07Sample(JSON.parse(request.body.raw)));
    assert(
      result.success,
      `R1-P07 ${item.name} request body fails runtime validation: ${result.error?.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ")}`,
    );
    validated += 1;
  }
  return validated;
}

function assertR1P16Collection(collection: PostmanCollection): number {
  const expectedFolders = ["Hosted (Not hosted yet)", "Local"];
  assert(
    collection.item.map((item) => item.name).sort().join("|") ===
      expectedFolders.sort().join("|"),
    "R1-P16 must contain mirrored Local and Hosted folders",
  );
  const expectedOperations = [
    "GET /api/v1/bookings/cancellation-reasons",
    "GET /api/v1/bookings/{bookingId}",
    "POST /api/v1/bookings/{bookingId}/cancel",
    "GET /api/v1/providers/{providerId}/bookings/{bookingId}",
    "POST /api/v1/providers/{providerId}/bookings/{bookingId}/accept",
    "POST /api/v1/providers/{providerId}/bookings/{bookingId}/cancel",
    "POST /api/v1/providers/{providerId}/bookings/{bookingId}/reject",
    "GET /api/v1/providers/{providerId}/bookings/inbox",
    "GET /api/v1/staff/bookings/{bookingId}",
    "POST /api/v1/staff/bookings/{bookingId}/cancel",
  ].sort();
  let total = 0;
  for (const folder of collection.item) {
    const requests = collectRequestItems(folder.item ?? []);
    total += requests.length;
    const prefix = folder.name === "Local" ? "{{baseUrl}}" : "{{hostUrl}}";
    for (const item of requests) {
      assert(
        item.request !== undefined && rawUrl(item.request).startsWith(prefix),
        `R1-P16 ${folder.name}/${item.name} must start with ${prefix}`,
      );
    }
    const operations = requests
      .map((item) => {
        const request = item.request!;
        return `${request.method.toUpperCase()} ${normalizeCollectionRoute(rawUrl(request)).split("?")[0]!}`;
      })
      .sort();
    assert(
      JSON.stringify(operations) === JSON.stringify(expectedOperations),
      `R1-P16 ${folder.name} operations differ from the expected contract.\nPostman: ${JSON.stringify(operations)}\nExpected: ${JSON.stringify(expectedOperations)}`,
    );
  }
  return total;
}

function assertR1P17Collection(collection: PostmanCollection): number {
  const expectedFolders = ["Hosted (Not hosted yet)", "Local"];
  assert(
    collection.item.map((item) => item.name).sort().join("|") ===
      expectedFolders.sort().join("|"),
    "R1-P17 must contain mirrored Local and Hosted folders",
  );
  const expectedOperations = [
    "GET /api/v1/providers/{providerId}/bookings/{bookingId}/assignments/current",
    "GET /api/v1/providers/{providerId}/bookings/{bookingId}/assignments/history",
    "POST /api/v1/providers/{providerId}/bookings/{bookingId}/assignments/team",
    "POST /api/v1/providers/{providerId}/bookings/{bookingId}/assignments/team/replace",
    "POST /api/v1/providers/{providerId}/bookings/{bookingId}/assignments/workers",
    "POST /api/v1/providers/{providerId}/bookings/{bookingId}/assignments/workers/replace",
    "GET /api/v1/workers/me/assignments",
  ].sort();
  let total = 0;
  for (const folder of collection.item) {
    const requests = collectRequestItems(folder.item ?? []);
    total += requests.length;
    const prefix = folder.name === "Local" ? "{{baseUrl}}" : "{{hostUrl}}";
    for (const item of requests) {
      assert(
        item.request !== undefined && rawUrl(item.request).startsWith(prefix),
        `R1-P17 ${folder.name}/${item.name} must start with ${prefix}`,
      );
    }
    const operations = requests
      .map((item) => {
        const request = item.request!;
        return `${request.method.toUpperCase()} ${normalizeCollectionRoute(rawUrl(request)).split("?")[0]!}`;
      })
      .sort();
    assert(
      JSON.stringify(operations) === JSON.stringify(expectedOperations),
      `R1-P17 ${folder.name} operations differ from the expected contract.\nPostman: ${JSON.stringify(operations)}\nExpected: ${JSON.stringify(expectedOperations)}`,
    );
  }
  return total;
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
    "Cleanora-R1-P04-Customer-Self-Service.postman_collection.json",
  );
  const collection = await parseJson<PostmanCollection>(collectionPath);
  assert(
    collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P04 collection must use Postman collection schema v2.1.0",
  );

  const runtimeOperations = runtimeCustomerOperations();
  const r1P04RequestCount = assertMirroredEnvironments({
    label: "R1-P04",
    collection,
    expectedOperations: runtimeOperations,
  });

  const r1P00Collection = await parseJson<PostmanCollection>(
    resolve(postmanDirectory, "Cleanora-R1-P00-Foundation.postman_collection.json"),
  );
  const r1P00RequestCount = assertMirroredEnvironments({
    label: "R1-P00",
    collection: r1P00Collection,
    expectedOperations: [
      "GET /system/health/live",
      "GET /system/health/ready",
    ],
  });

  const r1P01Collection = await parseJson<PostmanCollection>(
    resolve(
      postmanDirectory,
      "Cleanora-R1-P01-Foundation-Country-Configuration.postman_collection.json",
    ),
  );
  const r1P01RequestCount = assertMirroredEnvironments({
    label: "R1-P01",
    collection: r1P01Collection,
    expectedOperations: [
      "GET /system/health/live",
      "GET /system/health/ready",
      "GET /system/health/database",
    ],
  });

  const r1P02Collection = await parseJson<PostmanCollection>(
    resolve(postmanDirectory, "Cleanora-R1-P02-Authentication.postman_collection.json"),
  );
  const r1P02RequestCount = assertMirroredEnvironments({
    label: "R1-P02",
    collection: r1P02Collection,
    expectedOperations: runtimeAuthenticationOperations(),
  });

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
    "providerAdminInvitationToken",
  ];

  const requiredProviderVariables = [
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
    for (const variable of requiredProviderVariables) {
      assert(values.has(variable), `${file} is missing ${variable}`);
    }
    for (const variable of secretVariables) {
      assert(values.get(variable) === "", `${file} must export ${variable} empty`);
    }
  }

  const r1P05CollectionPath = resolve(
    postmanDirectory,
    "Cleanora-R1-P05-Provider-Onboarding.postman_collection.json",
  );
  const r1P05Collection =
    await parseJson<PostmanCollection>(r1P05CollectionPath);
  assert(
    r1P05Collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P05 collection must use Postman collection schema v2.1.0",
  );
  const r1P05RuntimeOperations = runtimeProviderOperations();
  const r1P05RequestCount = assertMirroredEnvironments({
    label: "R1-P05",
    collection: r1P05Collection,
    expectedOperations: r1P05RuntimeOperations,
  });
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

  const r1P06CollectionPath = resolve(
    postmanDirectory,
    "Cleanora-R1-P06-Provider-Verification.postman_collection.json",
  );
  const r1P06Collection = await parseJson<PostmanCollection>(r1P06CollectionPath);
  assert(
    r1P06Collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P06 collection must use Postman collection schema v2.1.0",
  );
  const r1P06RuntimeOperations = r1P06OperationInventory(loadR1P06OpenApiSource().paths ?? {});
  const r1P06RequestCount = assertMirroredEnvironments({
    label: "R1-P06",
    collection: r1P06Collection,
    expectedOperations: r1P06RuntimeOperations,
  });
  const r1P06Serialized = await readFile(r1P06CollectionPath, "utf8");
  const r1P06Variables = new Map((r1P06Collection.variable ?? []).map((entry) => [entry.key, entry.value]));
  for (const secretVariable of ["accessToken", "currentPassword", "sensitiveActionProof", "revealAttemptId", "verificationEvidenceFile"]) {
    assert(r1P06Variables.get(secretVariable) === "", `R1-P06 collection must export ${secretVariable} empty`);
  }
  const r1P06Referenced = new Set([...r1P06Serialized.matchAll(/\{\{([^{}]+)\}\}/gu)].map((match) => match[1]!));
  const r1P06Undefined = [...r1P06Referenced].filter((key) => !r1P06Variables.has(key) && key !== "$guid");
  assert(r1P06Undefined.length === 0, `R1-P06 collection leaves variables undefined: ${r1P06Undefined.join(", ")}`);
  assert(r1P06Serialized.includes("body.error.statusCode"), "R1-P06 tests must validate error-envelope statusCode");
  for (const forbidden of ["CLOUDINARY_API_SECRET", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL", "Bearer eyJ", "SMTP_PASSWORD", "PAYOUT_DATA_ENCRYPTION_KEYS_JSON", "PAYOUT_LOOKUP_HMAC_KEYS_JSON"]) {
    assert(!r1P06Serialized.includes(forbidden), `R1-P06 collection contains forbidden secret material: ${forbidden}`);
  }

  const r1P07CollectionPath = resolve(postmanDirectory, "Cleanora-R1-P07-Worker-Team-Crew-Management.postman_collection.json");
  const r1P07Collection = await parseJson<PostmanCollection>(r1P07CollectionPath);
  assert(r1P07Collection.info.schema.endsWith("/collection/v2.1.0/collection.json"), "R1-P07 collection must use Postman collection schema v2.1.0");
  const r1P07RuntimeOperations = R1_P07_OPENAPI_OPERATIONS.map(([method, path]) => `${method.toUpperCase()} ${path}`).sort();
  const r1P07RequestCount = assertMirroredEnvironments({
    label: "R1-P07",
    collection: r1P07Collection,
    expectedOperations: r1P07RuntimeOperations,
  });
  const r1P07ValidatedRequestBodies = assertR1P07RequestBodies(r1P07Collection);
  const r1P07Serialized = await readFile(r1P07CollectionPath, "utf8");
  const r1P07Variables = new Map((r1P07Collection.variable ?? []).map((entry) => [entry.key, entry.value]));
  for (const secretVariable of [
    "accessToken", "workerOperationalPhone", "workerInvitationEmail", "recentAuthenticationProof",
    "invitationProof", "workerPassword", "workerInvitationChallengeId", "workerEmailCode", "workerAvatarFile",
  ]) {
    assert(r1P07Variables.get(secretVariable) === "", `R1-P07 collection must export ${secretVariable} empty`);
  }
  const r1P07Referenced = new Set([...r1P07Serialized.matchAll(/\{\{([^{}]+)\}\}/gu)].map((match) => match[1]!));
  const r1P07Undefined = [...r1P07Referenced].filter((key) => !r1P07Variables.has(key) && key !== "$guid");
  assert(r1P07Undefined.length === 0, `R1-P07 collection leaves variables undefined: ${r1P07Undefined.join(", ")}`);
  assert(r1P07Serialized.includes("body.error.statusCode"), "R1-P07 tests must validate error-envelope statusCode");
  for (const forbidden of [
    "CLOUDINARY_API_SECRET", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL", "Bearer eyJ",
    "SMTP_PASSWORD", "r1p07.synthetic.invitation.proof.never-runtime", "+201012345678",
    "R1P07-Synthetic-Password-Only!", "r1p07/synthetic/private-worker-avatar.webp",
  ]) {
    assert(!r1P07Serialized.includes(forbidden), `R1-P07 collection contains forbidden secret material: ${forbidden}`);
  }

  const r1P12CollectionPath = resolve(
    postmanDirectory,
    "Cleanora-R1-P12-Browse-Marketplace.postman_collection.json",
  );
  const r1P12Collection = await parseJson<PostmanCollection>(r1P12CollectionPath);
  assert(
    r1P12Collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P12 collection must use Postman collection schema v2.1.0",
  );
  const r1P12RequestCount = assertR1P12Collection(r1P12Collection);
  const r1P12Variables = new Map(
    (r1P12Collection.variable ?? []).map((entry) => [entry.key, entry.value]),
  );
  assert(
    r1P12Variables.get("accessToken") === "",
    "R1-P12 collection must export accessToken empty",
  );
  const r1P12Serialized = await readFile(r1P12CollectionPath, "utf8");
  for (const forbidden of [
    "CLOUDINARY_API_SECRET",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "DATABASE_URL",
    "Bearer eyJ",
    "storageKey",
  ]) {
    assert(
      !r1P12Serialized.includes(forbidden),
      `R1-P12 collection contains forbidden secret/private material: ${forbidden}`,
    );
  }

  const r1P13CollectionPath = resolve(
    postmanDirectory,
    "Cleanora-R1-P13-Booking-Draft.postman_collection.json",
  );
  const r1P13Collection = await parseJson<PostmanCollection>(r1P13CollectionPath);
  assert(
    r1P13Collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P13 collection must use Postman collection schema v2.1.0",
  );
  const r1P13RequestCount = assertR1P13Collection(r1P13Collection);
  const r1P13Variables = new Map(
    (r1P13Collection.variable ?? []).map((entry) => [entry.key, entry.value]),
  );
  assert(
    r1P13Variables.get("accessToken") === "",
    "R1-P13 collection must export accessToken empty",
  );
  const r1P13Serialized = await readFile(r1P13CollectionPath, "utf8");
  for (const forbidden of [
    "CLOUDINARY_API_SECRET",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "DATABASE_URL",
    "Bearer eyJ",
    "storageKey",
  ]) {
    assert(
      !r1P13Serialized.includes(forbidden),
      `R1-P13 collection contains forbidden secret/private material: ${forbidden}`,
    );
  }

  const r1P16CollectionPath = resolve(
    postmanDirectory,
    "Cleanora-R1-P16-Provider-Booking-Response.postman_collection.json",
  );
  const r1P16Collection = await parseJson<PostmanCollection>(r1P16CollectionPath);
  assert(
    r1P16Collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P16 collection must use Postman collection schema v2.1.0",
  );
  const r1P16RequestCount = assertR1P16Collection(r1P16Collection);
  const r1P16Serialized = await readFile(r1P16CollectionPath, "utf8");
  for (const forbidden of [
    "CLOUDINARY_API_SECRET",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "DATABASE_URL",
    "Bearer eyJ",
    "storageKey",
  ]) {
    assert(
      !r1P16Serialized.includes(forbidden),
      `R1-P16 collection contains forbidden secret/private material: ${forbidden}`,
    );
  }

  const r1P17CollectionPath = resolve(
    postmanDirectory,
    "Cleanora-R1-P17-Worker-Team-Assignment.postman_collection.json",
  );
  const r1P17Collection = await parseJson<PostmanCollection>(r1P17CollectionPath);
  assert(
    r1P17Collection.info.schema.endsWith("/collection/v2.1.0/collection.json"),
    "R1-P17 collection must use Postman collection schema v2.1.0",
  );
  const r1P17RequestCount = assertR1P17Collection(r1P17Collection);
  const r1P17Serialized = await readFile(r1P17CollectionPath, "utf8");
  for (const forbidden of [
    "CLOUDINARY_API_SECRET",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "DATABASE_URL",
    "Bearer eyJ",
    "storageKey",
  ]) {
    assert(
      !r1P17Serialized.includes(forbidden),
      `R1-P17 collection contains forbidden secret/private material: ${forbidden}`,
    );
  }

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      jsonFiles: jsonFiles.length,
      r1P00Requests: r1P00RequestCount,
      r1P01Requests: r1P01RequestCount,
      r1P02Requests: r1P02RequestCount,
      r1P04Requests: r1P04RequestCount,
      requestsPerEnvironment: {
        r1P00: r1P00RequestCount / 2,
        r1P01: r1P01RequestCount / 2,
        r1P02: r1P02RequestCount / 2,
        r1P04: r1P04RequestCount / 2,
        r1P05: r1P05RuntimeOperations.length,
        r1P06: r1P06RuntimeOperations.length,
        r1P07: r1P07RuntimeOperations.length,
        r1P12: runtimeBrowseOperations().length,
        r1P13: runtimeBookingOperations().length,
      },
      r1P05Requests: r1P05RequestCount,
      r1P05RequestsPerEnvironment: r1P05RuntimeOperations.length,
      r1P06Requests: r1P06RequestCount,
      r1P06RequestsPerEnvironment: r1P06RuntimeOperations.length,
      r1P07Requests: r1P07RequestCount,
      r1P07RequestsPerEnvironment: r1P07RuntimeOperations.length,
      r1P07ValidatedRequestBodies,
      r1P12Requests: r1P12RequestCount,
      r1P12RequestsPerEnvironment: r1P12RequestCount / 2,
      r1P13Requests: r1P13RequestCount,
      r1P13RequestsPerEnvironment: r1P13RequestCount / 2,
      r1P16Requests: r1P16RequestCount,
      r1P16RequestsPerEnvironment: r1P16RequestCount / 2,
      r1P17Requests: r1P17RequestCount,
      r1P17RequestsPerEnvironment: r1P17RequestCount / 2,
      runtimeParity: true,
      environments: 2,
    })}\n`,
  );
}

void main();
