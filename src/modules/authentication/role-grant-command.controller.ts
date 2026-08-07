import type { RequestHandler } from "express";

import { createFailureResponse, sendSuccess } from "#shared/http/api-response";

import type { AuthenticationPrincipal } from "./domain/authentication.types.js";
import type { RoleManagementService } from "./role-management.service.js";
import { roleGrantCommandSchema } from "./role-grant-command.schema.js";

const rejected = {
  code: "ROLE_GRANT_COMMAND_REJECTED",
  statusCode: 403,
  message: "The role-grant command was rejected.",
  details: {},
} as const;

function principal(value: unknown): AuthenticationPrincipal | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as AuthenticationPrincipal;
}

/**
 * Ordinary staff-admin role commands. Customer role codes are rejected by the
 * Zod schema before this controller runs (DEC-030).
 */
export function createRoleGrantCommandController(
  roleManagement: RoleManagementService,
) {
  const submit: RequestHandler = async (request, response) => {
    const parsed = roleGrantCommandSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json(
        createFailureResponse(request, {
          code: "INVALID_REQUEST",
          statusCode: 400,
          message: "The request is invalid.",
          details: {},
        }),
      );
      return;
    }

    const actor = principal(response.locals["authenticationPrincipal"]);
    if (actor === undefined) {
      response.status(401).json(
        createFailureResponse(request, {
          code: "AUTHENTICATION_REQUIRED",
          statusCode: 401,
          message: "Authentication is required.",
          details: {},
        }),
      );
      return;
    }
    if (actor.verificationOnly) {
      response.status(403).json(createFailureResponse(request, rejected));
      return;
    }

    try {
      const command = {
        actor,
        targetUserId: parsed.data.targetUserId,
        roleCode: parsed.data.roleCode,
        reasonCode: parsed.data.reasonCode,
        requestId: request.requestId,
      };
      switch (parsed.data.operation) {
        case "assign":
          sendSuccess(request, response, 200, await roleManagement.assignRole(command));
          return;
        case "revoke":
          sendSuccess(request, response, 200, await roleManagement.revokeRole(command));
          return;
        case "enable":
          sendSuccess(request, response, 200, await roleManagement.enableRole(command));
          return;
        case "disable":
          sendSuccess(request, response, 200, await roleManagement.disableRole(command));
          return;
      }
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as { statusCode: unknown }).statusCode === "number"
      ) {
        response.status(403).json(createFailureResponse(request, rejected));
        return;
      }
      throw error;
    }
  };

  return { submit };
}
