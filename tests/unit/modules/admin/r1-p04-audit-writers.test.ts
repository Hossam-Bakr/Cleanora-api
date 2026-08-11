import {
  bindPrismaClient,
  resetPrismaClientForTests,
} from "../../../../src/database/prisma.js";
import {
  assertSafeDenialAuditInput,
  type SafeDenialAuditInput,
  type WriteAuditInput,
} from "../../../../src/modules/admin/audit.service.js";
import { createPrismaDenialAuditWriter } from "../../../../src/modules/admin/infrastructure/prisma-denial-audit.writer.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";

function generalInput(
  overrides: Partial<WriteAuditInput> = {},
): WriteAuditInput {
  return {
    actorType: "USER",
    actorId: "actor-1",
    action: "customers.profile.updated",
    targetType: "customer_profile",
    targetId: "profile-1",
    context: { phase: "R1-P04" },
    requestId: "req-1",
    ...overrides,
  };
}

function denialInput(
  overrides: Partial<SafeDenialAuditInput> = {},
): SafeDenialAuditInput {
  return {
    ...generalInput({
      action: "customers.profile.read.denied",
      targetType: "customer_profile",
    }),
    outcome: "OWNERSHIP_DENIED",
    context: { resourceKind: "customer_profile" },
    ...overrides,
  };
}

function createRecordingTransaction() {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "audit-tx-1",
    createdAt: new Date("2026-08-07T00:00:00.000Z"),
    ...data,
  }));
  return { transaction: { auditLog: { create } }, create };
}

describe("R1-P04 admin audit writers", () => {
  describe("general transactional writer", () => {
    it("appends actor/action/time/outcome evidence inside the supplied transaction", async () => {
      const { transaction, create } = createRecordingTransaction();

      const ack = await createPrismaGeneralTransactionalAuditWriter(
        transaction as never,
      ).append(generalInput());

      expect(ack).toEqual({
        id: "audit-tx-1",
        createdAt: "2026-08-07T00:00:00.000Z",
      });
      expect(create.mock.calls[0]?.[0].data).toMatchObject({
        actorType: "USER",
        actorId: "actor-1",
        action: "customers.profile.updated",
        targetType: "customer_profile",
        targetId: "profile-1",
      });
    });

    it("rejects secret-like context before the transaction append runs", async () => {
      const { transaction, create } = createRecordingTransaction();

      await expect(
        createPrismaGeneralTransactionalAuditWriter(transaction as never).append(
          generalInput({ context: { accessToken: "secret" } }),
        ),
      ).rejects.toMatchObject({ code: "AUDIT_INPUT_INVALID" });
      expect(create).not.toHaveBeenCalled();
    });
  });

  describe("safe non-transactional denial writer", () => {
    beforeEach(() => {
      resetPrismaClientForTests("test");
    });

    afterEach(() => {
      resetPrismaClientForTests("test");
    });

    it("appends actor/action/time/outcome and opaque resource identity", async () => {
      const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: "audit-denial-1",
        createdAt: new Date("2026-08-07T00:00:00.000Z"),
        ...data,
      }));
      bindPrismaClient({
        auditLog: { create },
      } as never);

      const ack = await createPrismaDenialAuditWriter().append(denialInput());

      expect(ack).toEqual({
        id: "audit-denial-1",
        createdAt: "2026-08-07T00:00:00.000Z",
      });
      expect(create.mock.calls[0]?.[0].data).toMatchObject({
        actorType: "USER",
        action: "customers.profile.read.denied",
        targetType: "customer_profile",
        targetId: "profile-1",
        context: {
          outcome: "OWNERSHIP_DENIED",
          resourceKind: "customer_profile",
        },
      });
    });

    it.each([
      { fullAddress: "123 Main Street" },
      { email: "user@example.com" },
      { profileImageBytes: "base64-bytes" },
      { nested: { phoneNumber: "+201234567890" } },
    ])("rejects protected payload context %#", async (context) => {
      expect(() =>
        assertSafeDenialAuditInput(denialInput({ context })),
      ).toThrow(/invalid/iu);
    });

    it("requires a non-empty outcome", () => {
      expect(() =>
        assertSafeDenialAuditInput(denialInput({ outcome: "   " })),
      ).toThrow(/invalid/iu);
    });
  });
});
