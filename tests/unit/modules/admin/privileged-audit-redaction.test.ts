import {
  assertSafeAuditInput,
  assertSafePrivilegedAuditInput,
  type SafePrivilegedAuditInput,
} from "../../../../src/modules/admin/audit.service.js";
import { createPrismaPrivilegedAuditWriter } from "../../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";

function safeInput(
  overrides: Partial<SafePrivilegedAuditInput> = {},
): SafePrivilegedAuditInput {
  return {
    actorType: "USER",
    actorId: "actor-1",
    action: "identity.roles.assign",
    targetType: "user_role",
    targetId: "grant-1",
    reason: "role_grant_assign",
    context: {
      targetUserId: "target-1",
      roleCode: "customer",
      before: { status: "ABSENT" },
      after: { status: "ENABLED" },
    },
    ...overrides,
  };
}

function createRecordingTransaction() {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "audit-1",
    createdAt: new Date("2026-08-04T00:00:00.000Z"),
    ...data,
  }));
  return { transaction: { auditLog: { create } }, create };
}

describe("privileged audit validation and redaction", () => {
  it("appends safe before/after evidence and returns an acknowledgement only", async () => {
    const { transaction, create } = createRecordingTransaction();

    const ack = await createPrismaPrivilegedAuditWriter(
      transaction as never,
    ).append(safeInput());

    expect(ack).toEqual({
      id: "audit-1",
      createdAt: "2026-08-04T00:00:00.000Z",
    });
    expect(create.mock.calls[0]?.[0].data).toMatchObject({
      actorType: "USER",
      action: "identity.roles.assign",
      targetType: "user_role",
      reason: "role_grant_assign",
    });
  });

  it.each([
    { password: "secret-value" },
    { accessToken: "token-value" },
    { nested: { otpCode: "123456" } },
    { list: [{ refreshCookie: "cookie-value" }] },
    { apiKey: "key" },
  ])("rejects secret-like context %#", async (context) => {
    const { transaction, create } = createRecordingTransaction();

    await expect(
      createPrismaPrivilegedAuditWriter(transaction as never).append(
        safeInput({ context }),
      ),
    ).rejects.toMatchObject({ code: "AUDIT_INPUT_INVALID" });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects privileged evidence without a reason", async () => {
    const { transaction, create } = createRecordingTransaction();

    await expect(
      createPrismaPrivilegedAuditWriter(transaction as never).append(
        safeInput({ reason: "   " }),
      ),
    ).rejects.toMatchObject({ code: "AUDIT_INPUT_INVALID" });
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects evidence without an action or target type", () => {
    expect(() => assertSafeAuditInput(safeInput({ action: " " }))).toThrow(
      /invalid/iu,
    );
    expect(() =>
      assertSafePrivilegedAuditInput(safeInput({ targetType: "" })),
    ).toThrow(/invalid/iu);
  });

  it("accepts status-only before/after context", () => {
    expect(() => assertSafePrivilegedAuditInput(safeInput())).not.toThrow();
  });
});
