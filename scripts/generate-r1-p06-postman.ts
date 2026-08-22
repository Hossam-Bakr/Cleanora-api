import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { loadR1P06OpenApiSource, r1P06OperationInventory } from "../src/swagger/r1-p06-openapi.paths.js";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type OpenApiOperation = {
  readonly operationId?: string;
  readonly description?: string;
  readonly summary?: string;
  readonly tags?: readonly string[];
  readonly requestBody?: { readonly content?: Readonly<Record<string, unknown>> };
  readonly responses?: Readonly<Record<string, unknown>>;
};

const commandId = (index: number) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
const versionCommand = (index: number) => ({ expectedVersion: 1, commandId: commandId(index) });
const walletDraft = (index: number) => ({
  type: "MOBILE_WALLET",
  countryCode: "EG",
  walletNumber: "+201000000000",
  operatorCode: "SYNTHETIC_OPERATOR",
  holderLegalName: "Synthetic Provider Owner",
  holderRelationship: "PROVIDER_OWNER",
  commandId: commandId(index),
});

function jsonBody(operationId: string, index: number): object | undefined {
  switch (operationId) {
    case "issueProviderSensitiveActionProof": return { currentPassword: "{{currentPassword}}", purpose: "STAFF_PAYOUT_REVEAL", providerId: "{{providerId}}", destinationVersionId: "{{destinationVersionId}}", requestId: "{{requestId}}" };
    case "createProviderDocumentDraft": return { typeCode: "COMMERCIAL_REGISTRATION", countryCode: "EG", documentNumber: "SYNTHETIC-DOC-0001", legalName: "Synthetic Cleanora Company", issuerName: "Synthetic Registry Authority", issueDate: "2026-01-01", expiresAt: null, commandId: commandId(index) };
    case "replaceProviderDocumentDraft": return { countryCode: "EG", documentNumber: "SYNTHETIC-DOC-0002", legalName: "Synthetic Cleanora Company", issuerName: "Synthetic Registry Authority", issueDate: "2026-01-01", expiresAt: null, ...versionCommand(index) };
    case "removeProviderDocumentEvidence": return versionCommand(index);
    case "reorderProviderDocumentEvidence": return { evidenceIds: ["{{evidenceId}}"], ...versionCommand(index) };
    case "submitProviderDocumentVersion":
    case "createProviderDocumentSuccessor": return versionCommand(index);
    case "createVerificationDocumentPolicyDraft": return { countryCode: "EG", providerKind: "REGISTERED_COMPANY", effectiveAt: "2026-09-01T00:00:00.000Z", commandId: commandId(index), items: [{ documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules: { expiryRequired: false } }] };
    case "replaceVerificationDocumentPolicyDraft": return { effectiveAt: "2026-09-01T00:00:00.000Z", ...versionCommand(index), items: [{ documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules: { expiryRequired: false } }] };
    case "publishVerificationDocumentPolicy": return { ...versionCommand(index), reason: "Reviewed and approved synthetic policy update" };
    case "decideProviderDocumentVersion": return { outcome: "APPROVE", reason: "Document matched the authoritative synthetic record", ...versionCommand(index) };
    case "createProviderPayoutDestinationDraft": return walletDraft(index);
    case "replaceProviderPayoutDestinationDraft": return { ...walletDraft(index), expectedVersion: 1 };
    case "submitProviderPayoutDestination": return { ...versionCommand(index), reauthenticationProof: "{{sensitiveActionProof}}" };
    case "createProviderPayoutDestinationSuccessor": return { ...walletDraft(index), expectedVersion: 1 };
    case "removeProviderPayoutDestination": return { expectedVersion: 1, expectedPrimaryVersion: 0, replacementPrimaryDestinationVersionId: null, acknowledgeReadinessLoss: true, reason: "Owner confirms payout readiness will be removed", reauthenticationProof: "{{sensitiveActionProof}}", commandId: commandId(index) };
    case "selectPrimaryPayoutDestination": return { destinationVersionId: "{{destinationVersionId}}", expectedDestinationVersion: 1, expectedPrimaryVersion: 0, reauthenticationProof: "{{sensitiveActionProof}}", commandId: commandId(index) };
    case "revealPendingPayoutDestination": return { expectedVersion: 1, purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION", reason: "Manual beneficiary lookup before Staff decision", stepUpProof: "{{sensitiveActionProof}}", commandId: commandId(index) };
    case "decideProviderPayoutDestination": return { outcome: "APPROVE", verificationMethod: "MANUAL_WALLET_TRANSFER_CHECK", reasonCode: "VERIFIED_MATCH", verificationNote: "External beneficiary holder name and wallet details matched", acceptedRevealAttemptId: "{{revealAttemptId}}", expectedVersion: 1, commandId: commandId(index) };
    case "resolvePayoutDestinationConflict": return { outcome: "CANDIDATE_REJECTED", reason: "Staff confirmed the incumbent claim remains authoritative", expectedVersion: 1, commandId: commandId(index) };
    default: return undefined;
  }
}

function formDataBody(index: number) {
  return {
    mode: "formdata",
    formdata: [
      { key: "file", type: "file", src: "{{verificationEvidenceFile}}" },
      { key: "position", type: "text", value: "0" },
      { key: "expectedVersion", type: "text", value: "1" },
      { key: "commandId", type: "text", value: commandId(index) },
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

function requestItem(path: string, method: Method, operation: OpenApiOperation, index: number, prefix: "{{baseUrl}}" | "{{hostUrl}}") {
  const operationId = operation.operationId ?? `${method.toLowerCase()}-${index}`;
  const rawBody = jsonBody(operationId, index);
  const isEvidenceUpload = operationId === "uploadProviderDocumentEvidence";
  const body = isEvidenceUpload
    ? formDataBody(index)
    : rawBody === undefined
      ? undefined
      : { mode: "raw", raw: JSON.stringify(rawBody, null, 2), options: { raw: { language: "json" } } };
  const headers = [
    { key: "Accept", value: "application/json" },
    { key: "x-request-id", value: "{{requestId}}" },
    ...(body !== undefined && !isEvidenceUpload ? [{ key: "Content-Type", value: "application/json" }] : []),
  ];
  const request = {
    method,
    header: headers,
    url: `${prefix}${renderRoute(path)}`,
    description: operation.description ?? operation.summary ?? `R1-P06 ${operationId}.`,
    ...(body === undefined ? {} : { body }),
  };
  const code = responseCode(operation);
  const successBody = JSON.stringify({
    success: true,
    data: operationId === "revealPendingPayoutDestination"
      ? { destinationVersionId: "synthetic-destination-version", type: "MOBILE_WALLET", fullIdentifier: "SYNTHETIC_RUNTIME_ONLY", holderLegalName: "Synthetic Runtime Holder", holderRelationship: "PROVIDER_OWNER", revealAttemptId: "synthetic-reveal-attempt" }
      : { status: "SYNTHETIC_SUCCESS" },
    requestId: "00000000-0000-4000-8000-000000000006",
  }, null, 2);
  return {
    name: operationId,
    request,
    event: [{
      listen: "test",
      script: {
        type: "text/javascript",
        exec: [
          `pm.test("Expected status", () => pm.expect(pm.response.code).to.be.oneOf([${Object.keys(operation.responses ?? {}).filter((value) => /^\d{3}$/u.test(value)).join(", ")} ]));`,
          'pm.test("Envelope status code", () => { const body = pm.response.json(); if (!body.success) pm.expect(body.error.statusCode).to.eql(pm.response.code); });',
          ...(operationId === "issueProviderSensitiveActionProof" ? ['if (pm.response.code === 201) pm.collectionVariables.set("sensitiveActionProof", pm.response.json().data.opaqueProof);'] : []),
          ...(operationId === "revealPendingPayoutDestination" ? ['if (pm.response.code === 200) pm.collectionVariables.set("revealAttemptId", pm.response.json().data.revealAttemptId);'] : []),
        ],
      },
    }],
    response: [{ name: `Success ${code}`, originalRequest: request, status: "Synthetic success", code, header: [{ key: "Content-Type", value: "application/json" }], body: successBody }],
  };
}

function environmentFolder(name: "Hosted (Not hosted yet)" | "Local", prefix: "{{hostUrl}}" | "{{baseUrl}}") {
  const source = loadR1P06OpenApiSource();
  const groups = new Map<string, ReturnType<typeof requestItem>[]>();
  let index = 0;
  for (const [path, pathItem] of Object.entries(source.paths ?? {})) {
    for (const [rawMethod, rawOperation] of Object.entries(pathItem)) {
      if (!["get", "post", "put", "patch", "delete"].includes(rawMethod)) continue;
      const operation = rawOperation as OpenApiOperation;
      const tag = operation.tags?.[0] ?? "R1-P06";
      const items = groups.get(tag) ?? [];
      items.push(requestItem(path, rawMethod.toUpperCase() as Method, operation, index, prefix));
      groups.set(tag, items);
      index += 1;
    }
  }
  return { name, description: `${name} mirror of all 37 R1-P06 operations.`, item: [...groups].map(([groupName, item]) => ({ name: groupName, item })) };
}

async function main(): Promise<void> {
  const source = loadR1P06OpenApiSource();
  const inventory = r1P06OperationInventory(source.paths ?? {});
  if (inventory.length !== 37) throw new Error(`Expected 37 R1-P06 operations, received ${inventory.length}`);
  const collection = {
    info: {
      _postman_id: "00000000-p006-4000-8000-000000000006",
      name: "Cleanora R1-P06 Provider Verification & External Payout Destinations",
      description: "Synthetic, secret-free executable examples for R1-P06 only. Payout execution and settlement are out of scope. Full payout values are present only in exact authorized runtime reveal responses.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: { type: "bearer", bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }] },
    variable: [
      { key: "baseUrl", value: "http://localhost:8000/api/v1" },
      { key: "hostUrl", value: "https://YOUR-HOSTED-DOMAIN.example/api/v1" },
      { key: "requestId", value: "00000000-0000-4000-8000-000000000006" },
      { key: "providerId", value: "synthetic-provider-id" },
      { key: "documentVersionId", value: "synthetic-document-version-id" },
      { key: "destinationVersionId", value: "synthetic-destination-version-id" },
      { key: "evidenceId", value: "synthetic-evidence-id" },
      { key: "policyVersionId", value: "synthetic-policy-version-id" },
      { key: "conflictId", value: "synthetic-conflict-id" },
      { key: "accessToken", value: "" },
      { key: "verificationEvidenceFile", value: "" },
      { key: "currentPassword", value: "" },
      { key: "sensitiveActionProof", value: "" },
      { key: "revealAttemptId", value: "" },
    ],
    item: [environmentFolder("Hosted (Not hosted yet)", "{{hostUrl}}"), environmentFolder("Local", "{{baseUrl}}")],
  };
  const outputPath = resolve("postman/Cleanora-R1-P06.postman_collection.json");
  await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath: "postman/Cleanora-R1-P06.postman_collection.json", requestsPerEnvironment: inventory.length, totalRequests: inventory.length * 2 })}\n`);
}

void main();
