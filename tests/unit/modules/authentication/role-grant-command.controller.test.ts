import { createRoleGrantCommandController } from "#modules/authentication/role-grant-command.controller";
import type { RoleManagementService } from "#modules/authentication/role-management.service";

const actor = {
  userId: "staff-admin-1",
  sessionId: "session-1",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
} as const;

function request(body: Record<string, unknown> = {}) {
  return {
    body,
    requestId: "7ebf45ad-7384-41ab-8e74-e864ae048d30",
  };
}

function response(locals: Record<string, unknown> = {}) {
  const result = {
    locals,
    status: vi.fn(),
    json: vi.fn(),
  };
  result.status.mockReturnValue(result);
  result.json.mockReturnValue(result);
  return result;
}

const assignBody = {
  operation: "assign",
  targetUserId: "target-user-1",
  roleCode: "worker",
  reasonCode: "role_grant_assign",
} as const;

describe("role-grant command controller", () => {
  it("returns 200 when assign succeeds", async () => {
    const assignRole = vi.fn().mockResolvedValue({
      targetUserId: "target-user-1",
      roleCode: "worker",
      status: "ENABLED",
      mutated: true,
      auditAppended: true,
    });
    const roleManagement = { assignRole } as unknown as RoleManagementService;
    const controller = createRoleGrantCommandController(roleManagement);
    const responseValue = response({ authenticationPrincipal: actor });

    await controller.submit(
      request(assignBody) as never,
      responseValue as never,
      vi.fn(),
    );

    expect(assignRole).toHaveBeenCalledWith({
      actor,
      targetUserId: "target-user-1",
      roleCode: "worker",
      reasonCode: "role_grant_assign",
      requestId: "7ebf45ad-7384-41ab-8e74-e864ae048d30",
    });
    expect(responseValue.status).toHaveBeenCalledWith(200);
    expect(responseValue.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          roleCode: "worker",
          status: "ENABLED",
        }),
      }),
    );
  });

  it.each([
    [
      "customer role code",
      {
        operation: "assign",
        targetUserId: "target-user-1",
        roleCode: "customer",
        reasonCode: "role_grant_assign",
      },
    ],
    [
      "bad shape",
      {
        operation: "assign",
        targetUserId: "target-user-1",
        roleCode: "worker",
        reasonCode: "role_grant_disable",
      },
    ],
  ])("returns 400 INVALID_REQUEST for %s", async (_label, body) => {
    const roleManagement = {
      assignRole: vi.fn(),
    } as unknown as RoleManagementService;
    const controller = createRoleGrantCommandController(roleManagement);
    const responseValue = response({ authenticationPrincipal: actor });

    await controller.submit(
      request(body) as never,
      responseValue as never,
      vi.fn(),
    );

    expect(roleManagement.assignRole).not.toHaveBeenCalled();
    expect(responseValue.status).toHaveBeenCalledWith(400);
    expect(responseValue.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "INVALID_REQUEST",
          statusCode: 400,
        }),
      }),
    );
  });

  it("returns 401 when the principal is missing", async () => {
    const roleManagement = {
      assignRole: vi.fn(),
    } as unknown as RoleManagementService;
    const controller = createRoleGrantCommandController(roleManagement);
    const responseValue = response();

    await controller.submit(
      request(assignBody) as never,
      responseValue as never,
      vi.fn(),
    );

    expect(roleManagement.assignRole).not.toHaveBeenCalled();
    expect(responseValue.status).toHaveBeenCalledWith(401);
    expect(responseValue.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "AUTHENTICATION_REQUIRED",
          statusCode: 401,
        }),
      }),
    );
  });

  it("returns 403 ROLE_GRANT_COMMAND_REJECTED when the service throws an AppError", async () => {
    const assignRole = vi.fn().mockRejectedValue(
      Object.assign(new Error("AUTHZ_SELF_MANAGEMENT_DENIED"), {
        code: "AUTHZ_SELF_MANAGEMENT_DENIED",
        statusCode: 403,
      }),
    );
    const roleManagement = { assignRole } as unknown as RoleManagementService;
    const controller = createRoleGrantCommandController(roleManagement);
    const responseValue = response({ authenticationPrincipal: actor });

    await controller.submit(
      request(assignBody) as never,
      responseValue as never,
      vi.fn(),
    );

    expect(responseValue.status).toHaveBeenCalledWith(403);
    expect(responseValue.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: "ROLE_GRANT_COMMAND_REJECTED",
          statusCode: 403,
        }),
      }),
    );
  });
});
