import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadR1P07OpenApiSource, R1_P07_OPENAPI_OPERATIONS } from "../src/swagger/r1-p07-openapi.paths.js";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type OpenApiOperation = {
  readonly operationId?: string;
  readonly description?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
  readonly security?: readonly unknown[];
  readonly responses?: Readonly<Record<string, unknown>>;
};

const commandKey = (index: number) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

function command(index: number) {
  return { expectedVersion: 1, idempotencyKey: commandKey(index) };
}

function jsonBody(operationId: string, index: number): object | undefined {
  switch (operationId) {
    case "createProviderWorkerDraft":
    case "replaceProviderWorkerProfile":
      return {
        ...command(index),
        fullLegalName: "Synthetic Worker",
        gender: "female",
        operationalPhoneE164: "{{workerOperationalPhone}}",
        workerType: "CLEANING_STAFF",
        displayTitle: "Synthetic Cleaner",
        supervisorCapable: false,
        skillTags: ["Deep Cleaning"],
      };
    case "removeProviderWorkerAvatar": return command(index);
    case "commandProviderWorkerLifecycle": return {
      ...command(index), action: "DEACTIVATE", reasonCode: "TEMPORARILY_UNAVAILABLE",
      confirmTeamImpact: false, confirmReadinessImpact: false,
    };
    case "commandProviderWorkerLoginAccess": return {
      ...command(index), action: "ISSUE_INVITATION", expectedAccessVersion: null,
      email: "{{workerInvitationEmail}}", locale: "AR",
      recentAuthenticationProof: "{{recentAuthenticationProof}}",
    };
    case "commandProviderWorkerAdminMembership": return {
      ...command(index), action: "GRANT", expectedMembershipVersion: null,
      reasonCode: "OPERATIONAL_RESPONSIBILITY",
      recentAuthenticationProof: "{{recentAuthenticationProof}}",
    };
    case "createProviderTeamDraft": return { ...command(index), name: "Synthetic Crew" };
    case "replaceProviderTeamName": return { ...command(index), name: "Synthetic Crew Updated" };
    case "commandProviderTeamLifecycle": return { ...command(index), action: "ACTIVATE" };
    case "commandProviderTeamMembership": return {
      ...command(index), action: "ADD", workerId: "{{workerId}}", expectedWorkerVersion: 1, cleans: true,
    };
    case "commandProviderTeamSupervisor": return {
      ...command(index), action: "ASSIGN", workerId: "{{workerId}}", expectedWorkerVersion: 1,
      expectedMembershipVersion: 1,
    };
    case "leaveCurrentProvider": return {
      ...command(index), confirmTeamImpact: false, confirmReadinessImpact: false,
    };
    case "inspectWorkerInvitation": return { invitationProof: "{{invitationProof}}" };
    case "startWorkerInvitationOnboarding": return {
      ...command(index), invitationProof: "{{invitationProof}}", password: "{{workerPassword}}",
    };
    case "verifyWorkerInvitationEmail": return {
      ...command(index), invitationProof: "{{invitationProof}}",
      challengeId: "{{workerInvitationChallengeId}}", code: "{{workerEmailCode}}",
    };
    case "acceptWorkerInvitation": return {
      ...command(index), invitationProof: "{{invitationProof}}",
      expectedWorkerVersion: 1, expectedAccessVersion: 1,
      operationalPhoneE164: "{{workerOperationalPhone}}",
    };
    default: return undefined;
  }
}

function avatarBody(index: number) {
  return {
    mode: "formdata",
    formdata: [
      { key: "file", type: "file", src: "{{workerAvatarFile}}" },
      { key: "expectedVersion", type: "text", value: "1" },
      { key: "idempotencyKey", type: "text", value: commandKey(index) },
    ],
  };
}

function responseCode(operation: OpenApiOperation): number {
  const code = Object.keys(operation.responses ?? {}).find((value) => /^2\d\d$/u.test(value));
  return code === undefined ? 200 : Number(code);
}

function renderRoute(path: string): string {
  return path.replace(/\{([^{}]+)\}/gu, "{{$1}}");
}

function requestItem(
  path: string,
  method: Method,
  operation: OpenApiOperation,
  index: number,
  prefix: "{{baseUrl}}" | "{{hostUrl}}",
) {
  const operationId = operation.operationId ?? `${method.toLowerCase()}-${index}`;
  const rawBody = jsonBody(operationId, index);
  const isAvatar = operationId === "uploadProviderWorkerAvatar";
  const body = isAvatar
    ? avatarBody(index)
    : rawBody === undefined
      ? undefined
      : { mode: "raw", raw: JSON.stringify(rawBody, null, 2), options: { raw: { language: "json" } } };
  const request = {
    method,
    header: [
      { key: "Accept", value: "application/json" },
      { key: "x-request-id", value: "{{requestId}}" },
      ...(body !== undefined && !isAvatar ? [{ key: "Content-Type", value: "application/json" }] : []),
    ],
    url: `${prefix}${renderRoute(path)}`,
    description: operation.description ?? operation.summary ?? `R1-P07 ${operationId}.`,
    ...(operation.security?.length === 0 ? { auth: { type: "noauth" } } : {}),
    ...(body === undefined ? {} : { body }),
  };
  const status = responseCode(operation);
  return {
    name: operationId,
    request,
    event: [{
      listen: "test",
      script: {
        type: "text/javascript",
        exec: [
          `pm.test("Expected documented status", () => pm.expect(pm.response.code).to.be.oneOf([${Object.keys(operation.responses ?? {}).filter((value) => /^\d{3}$/u.test(value)).join(", ")} ]));`,
          'pm.test("Envelope status code", () => { const body = pm.response.json(); if (!body.success) pm.expect(body.error.statusCode).to.eql(pm.response.code); });',
          'pm.test("Private response is not cached", () => { const value = pm.response.headers.get("Cache-Control"); if (value) pm.expect(value).to.include("no-store"); });',
        ],
      },
    }],
    response: [{
      name: `Success ${status}`,
      originalRequest: request,
      status: "Synthetic success",
      code: status,
      header: [{ key: "Content-Type", value: "application/json" }, { key: "Cache-Control", value: "no-store, private" }],
      body: JSON.stringify({ success: true, data: { outcomeCode: "SYNTHETIC_SUCCESS" }, requestId: "00000000-0000-4000-8000-000000000007" }, null, 2),
    }],
  };
}

function environmentFolder(name: "Hosted (Not hosted yet)" | "Local", prefix: "{{hostUrl}}" | "{{baseUrl}}") {
  const source = loadR1P07OpenApiSource();
  const groups = new Map<string, ReturnType<typeof requestItem>[]>();
  let index = 0;
  for (const [path, pathItem] of Object.entries(source.paths ?? {})) {
    for (const [rawMethod, rawOperation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete"].includes(rawMethod)) continue;
      const operation = rawOperation as OpenApiOperation;
      const tag = operation.tags?.[0] ?? "R1-P07";
      const items = groups.get(tag) ?? [];
      items.push(requestItem(path, rawMethod.toUpperCase() as Method, operation, index, prefix));
      groups.set(tag, items);
      index += 1;
    }
  }
  return { name, description: `${name} mirror of all 25 R1-P07 operations.`, item: [...groups].map(([groupName, item]) => ({ name: groupName, item })) };
}

async function main(): Promise<void> {
  if (R1_P07_OPENAPI_OPERATIONS.length !== 25) throw new Error(`Expected 25 R1-P07 operations, received ${R1_P07_OPENAPI_OPERATIONS.length}`);
  const collection = {
    info: {
      _postman_id: "00000000-p007-4000-8000-000000000007",
      name: "Cleanora R1-P07 Worker, Team & Crew Management",
      description: "Credential-free synthetic examples for the complete R1-P07 runtime contract. No real phone, email, password, OTP, invitation proof, access token, SMTP value, Cloudinary key, or database URL is stored.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
    variable: [
      { key: "baseUrl", value: "http://localhost:8000/api/v1" },
      { key: "hostUrl", value: "https://YOUR-HOSTED-DOMAIN.example/api/v1" },
      { key: "requestId", value: "00000000-0000-4000-8000-000000000007" },
      { key: "providerId", value: "synthetic-provider-id" },
      { key: "workerId", value: "synthetic-worker-id" },
      { key: "teamId", value: "synthetic-team-id" },
      { key: "membershipId", value: "synthetic-membership-id" },
      { key: "accessToken", value: "" },
      { key: "workerOperationalPhone", value: "" },
      { key: "workerInvitationEmail", value: "" },
      { key: "recentAuthenticationProof", value: "" },
      { key: "invitationProof", value: "" },
      { key: "workerPassword", value: "" },
      { key: "workerInvitationChallengeId", value: "" },
      { key: "workerEmailCode", value: "" },
      { key: "workerAvatarFile", value: "" },
    ],
    item: [
      environmentFolder("Hosted (Not hosted yet)", "{{hostUrl}}"),
      environmentFolder("Local", "{{baseUrl}}"),
    ],
  };
  const outputPath = resolve("postman/cleanora-r1-p07-provider-workforce.postman_collection.json");
  await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath: "postman/cleanora-r1-p07-provider-workforce.postman_collection.json", requestsPerEnvironment: 25, totalRequests: 50 })}\n`);
}

void main();
