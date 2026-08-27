export const R1_P07_OPENAPI_OPERATIONS = [
  ["get", "/providers/{providerId}/workers", "listProviderWorkers"],
  ["post", "/providers/{providerId}/workers", "createProviderWorkerDraft"],
  ["get", "/providers/{providerId}/workers/{workerId}", "getProviderWorker"],
  ["put", "/providers/{providerId}/workers/{workerId}", "replaceProviderWorkerProfile"],
  ["post", "/providers/{providerId}/workers/{workerId}/avatar", "uploadProviderWorkerAvatar"],
  ["delete", "/providers/{providerId}/workers/{workerId}/avatar", "removeProviderWorkerAvatar"],
  ["post", "/providers/{providerId}/workers/{workerId}/lifecycle-commands", "commandProviderWorkerLifecycle"],
  ["post", "/providers/{providerId}/workers/{workerId}/login-access-commands", "commandProviderWorkerLoginAccess"],
  ["post", "/providers/{providerId}/workers/{workerId}/admin-membership-commands", "commandProviderWorkerAdminMembership"],
  ["get", "/providers/{providerId}/workers/{workerId}/history", "listProviderWorkerHistory"],
  ["get", "/providers/{providerId}/teams", "listProviderTeams"],
  ["post", "/providers/{providerId}/teams", "createProviderTeamDraft"],
  ["get", "/providers/{providerId}/teams/{teamId}", "getProviderTeam"],
  ["put", "/providers/{providerId}/teams/{teamId}", "replaceProviderTeamName"],
  ["post", "/providers/{providerId}/teams/{teamId}/lifecycle-commands", "commandProviderTeamLifecycle"],
  ["post", "/providers/{providerId}/teams/{teamId}/membership-commands", "commandProviderTeamMembership"],
  ["post", "/providers/{providerId}/teams/{teamId}/supervisor-commands", "commandProviderTeamSupervisor"],
  ["get", "/providers/{providerId}/teams/{teamId}/history", "listProviderTeamHistory"],
  ["get", "/providers/{providerId}/workforce-readiness", "getProviderWorkforceReadiness"],
  ["get", "/workers/me", "getCurrentWorkerContext"],
  ["post", "/workers/me/leave", "leaveCurrentProvider"],
  ["post", "/worker-invitations/inspect", "inspectWorkerInvitation"],
  ["post", "/worker-invitations/onboarding/start", "startWorkerInvitationOnboarding"],
  ["post", "/worker-invitations/onboarding/verify-email", "verifyWorkerInvitationEmail"],
  ["post", "/worker-invitations/accept", "acceptWorkerInvitation"],
] as const;

export type R1P07OperationId = (typeof R1_P07_OPENAPI_OPERATIONS)[number][2];

export const R1_P07_OPERATION_IDS = R1_P07_OPENAPI_OPERATIONS.map(
  ([, , operationId]) => operationId,
);

/** Private R1-P07 responses must remain explicitly documented in the served runtime contract. */
const R1_P07_PRIVATE_RESPONSE_BY_OPERATION: Readonly<Record<string, string>> = {
  listProviderWorkers: "WorkerList",
  createProviderWorkerDraft: "WorkerPrivate",
  getProviderWorker: "WorkerPrivate",
  replaceProviderWorkerProfile: "WorkerPrivate",
  uploadProviderWorkerAvatar: "WorkerPrivate",
  removeProviderWorkerAvatar: "WorkerPrivate",
  listProviderWorkerHistory: "HistoryList",
  listProviderTeams: "TeamList",
  createProviderTeamDraft: "Command",
  getProviderTeam: "TeamPrivate",
  replaceProviderTeamName: "Command",
  listProviderTeamHistory: "HistoryList",
  getProviderWorkforceReadiness: "Readiness",
  getCurrentWorkerContext: "WorkerPrivate",
  leaveCurrentProvider: "Command",
  inspectWorkerInvitation: "InvitationInspection",
  startWorkerInvitationOnboarding: "OnboardingStart",
  verifyWorkerInvitationEmail: "OnboardingVerify",
  acceptWorkerInvitation: "WorkerPrivate",
};

const PRIVATE_CACHE_CONTROL = "no-store, private";

/** Operations backed by mounted story handlers so far; expanded story-by-story. */
export const R1_P07_IMPLEMENTED_OPERATION_IDS = [
  "listProviderWorkers",
  "createProviderWorkerDraft",
  "getProviderWorker",
  "replaceProviderWorkerProfile",
  "uploadProviderWorkerAvatar",
  "removeProviderWorkerAvatar",
  "commandProviderWorkerLifecycle",
  "commandProviderWorkerLoginAccess",
  "commandProviderWorkerAdminMembership",
  "listProviderWorkerHistory",
  "listProviderTeams",
  "createProviderTeamDraft",
  "getProviderTeam",
  "replaceProviderTeamName",
  "commandProviderTeamLifecycle",
  "commandProviderTeamMembership",
  "commandProviderTeamSupervisor",
  "listProviderTeamHistory",
  "getProviderWorkforceReadiness",
  "getCurrentWorkerContext",
  "leaveCurrentProvider",
  "inspectWorkerInvitation",
  "startWorkerInvitationOnboarding",
  "verifyWorkerInvitationEmail",
  "acceptWorkerInvitation",
] as const satisfies readonly R1P07OperationId[];

interface OpenApiSource {
  readonly tags?: readonly { readonly name: string; readonly description?: string }[];
  readonly paths?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly components?: {
    readonly schemas?: Readonly<Record<string, unknown>>;
    readonly parameters?: Readonly<Record<string, unknown>>;
    readonly responses?: Readonly<Record<string, unknown>>;
    readonly requestBodies?: Readonly<Record<string, unknown>>;
    readonly securitySchemes?: Readonly<Record<string, unknown>>;
  };
}

export function loadR1P07OpenApiSource(): OpenApiSource {
  return yaml.load(readFileSync(R1_P07_OPENAPI_SOURCE_PATH, "utf8")) as OpenApiSource;
}

export function buildImplementedR1P07SwaggerFragments(
  operationIds: readonly R1P07OperationId[] = R1_P07_IMPLEMENTED_OPERATION_IDS,
) {
  const source = loadR1P07OpenApiSource();
  const allowed = new Set<string>(operationIds);
  const paths: Record<string, Record<string, unknown>> = {};
  for (const [path, item] of Object.entries(source.paths ?? {})) {
    const methods = Object.fromEntries(Object.entries(item).filter(([, operation]) => {
      const operationId = operation !== null && typeof operation === "object"
        ? (operation as { readonly operationId?: unknown }).operationId
        : undefined;
      return typeof operationId === "string" && allowed.has(operationId);
    }));
    if (Object.keys(methods).length > 0) paths[path] = methods;
  }
  const actual = Object.values(paths).flatMap((item) => Object.values(item).map((operation) => (
    operation as { readonly operationId: string }
  ).operationId));
  if (actual.length !== allowed.size || actual.some((operationId) => !allowed.has(operationId))) {
    throw new Error(`R1-P07 OpenAPI/runtime inventory drift: expected ${allowed.size} operations, received ${actual.length}`);
  }
  for (const operationId of allowed) {
    const responseName = R1_P07_PRIVATE_RESPONSE_BY_OPERATION[operationId];
    if (responseName === undefined) continue;
    const response = source.components?.responses?.[responseName] as {
      readonly description?: unknown;
      readonly headers?: Readonly<Record<string, { readonly schema?: { readonly const?: unknown } }>>;
    } | undefined;
    if (typeof response?.description !== "string" || response.description.trim().length === 0) {
      throw new Error(`R1-P07 OpenAPI permission/privacy description missing for ${operationId}`);
    }
    if (responseName !== "WorkerList" && responseName !== "TeamList" && responseName !== "HistoryList" && responseName !== "Readiness" && responseName !== "Command") {
      if (response?.headers?.["Cache-Control"]?.schema?.const !== PRIVATE_CACHE_CONTROL) {
        throw new Error(`R1-P07 OpenAPI private Cache-Control contract missing for ${operationId}`);
      }
    }
  }
  return {
    paths,
    tags: (source.tags ?? []).map((tag) => ({
      name: tag.name,
      description: tag.description ?? `R1-P07 ${tag.name} operations.`,
    })),
    schemas: { ...(source.components?.schemas ?? {}) },
    parameters: { ...(source.components?.parameters ?? {}) },
    responses: { ...(source.components?.responses ?? {}) },
    requestBodies: { ...(source.components?.requestBodies ?? {}) },
    securitySchemes: { ...(source.components?.securitySchemes ?? {}) },
    operationIds: actual.sort(),
    privateCacheControl: PRIVATE_CACHE_CONTROL,
  };
}
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const yaml = require("js-yaml") as { load: (input: string) => unknown };

export const R1_P07_OPENAPI_SOURCE_PATH = resolve(
  process.cwd(),
  "specs/R1-P07-worker-team-crew-management/contracts/provider-workforce-api.openapi.yaml",
);
