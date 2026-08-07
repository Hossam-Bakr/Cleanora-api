import type { RequestHandler } from "express";

import { createFailureResponse, sendSuccess } from "#shared/http/api-response";

import { ownerStaffAdminProvisionSchema } from "./owner-staff-admin.schema.js";
import type { OwnerStaffAdminProvisionService } from "./owner-staff-admin.service.js";

const SECRET_HEADER = "x-owner-admin-secret";

/**
 * Thin HTTP adapter for owner staff_admin provisioning.
 * Never logs or echoes the owner secret.
 */
export function createOwnerStaffAdminController(
  service: OwnerStaffAdminProvisionService,
): { readonly provision: RequestHandler } {
  const provision: RequestHandler = async (request, response) => {
    const parsed = ownerStaffAdminProvisionSchema.safeParse(request.body);
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

    const presentedSecretHeader = request.header(SECRET_HEADER);
    const presentedSecret =
      typeof presentedSecretHeader === "string" ? presentedSecretHeader : undefined;

    try {
      const result = await service.provision({
        email: parsed.data.email,
        presentedSecret,
        requestId: request.requestId,
      });
      sendSuccess(request, response, 200, result);
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof (error as { statusCode: unknown }).statusCode === "number"
      ) {
        const statusCode = (error as { statusCode: number }).statusCode;
        const code =
          "code" in error && typeof (error as { code: unknown }).code === "string"
            ? (error as { code: string }).code
            : "OWNER_STAFF_ADMIN_REJECTED";
        response.status(statusCode >= 400 && statusCode < 600 ? statusCode : 403).json(
          createFailureResponse(request, {
            code,
            statusCode: statusCode >= 400 && statusCode < 600 ? statusCode : 403,
            message: "Owner staff-admin provisioning was rejected.",
            details: {},
          }),
        );
        return;
      }
      throw error;
    }
  };

  return { provision };
}
