import { bindPrismaClient, resetPrismaClientForTests } from "../../../../src/database/prisma.js";
import {
  assertSafeAuditInput,
  toPrismaJsonValue,
  writeAudit,
} from "../../../../src/modules/admin/audit.service.js";

describe("R1-P07 Admin public audit adapter branches", () => {
  afterEach(() => {
    resetPrismaClientForTests("test");
  });

  it("accepts allowlisted key identifiers and recursively converts every safe JSON shape", () => {
    expect(() => assertSafeAuditInput({
      actorType: "USER",
      action: "providers.workforce.command",
      targetType: "provider_worker",
      context: {
        encryptionKeyIds: ["key-id-only"],
        lookupKeyId: "lookup-key-id-only",
        facts: [{ version: 2, active: true }],
      },
    })).not.toThrow();
    expect(toPrismaJsonValue("value")).toBe("value");
    expect(toPrismaJsonValue(7)).toBe(7);
    expect(toPrismaJsonValue(false)).toBe(false);
    expect(toPrismaJsonValue(["a", 2, true])).toEqual(["a", 2, true]);
    expect(toPrismaJsonValue({ nested: { version: 3 }, values: [1, 2] })).toEqual({
      nested: { version: 3 }, values: [1, 2],
    });
  });

  it("maps full and sparse database audit rows without returning null JSON members", async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({
        id: "audit-full", actorType: "USER", actorId: "actor-1",
        action: "providers.workforce.command", targetType: "provider_worker", targetId: "worker-1",
        reason: "approved_reason",
        context: { version: 2, active: true, omitted: null, list: [1, null, { state: "ACTIVE" }] },
        requestId: "request-1", createdAt: new Date("2026-08-23T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({
        id: "audit-sparse", actorType: "SYSTEM", actorId: null,
        action: "providers.workforce.checked", targetType: "provider", targetId: null,
        reason: null, context: "not-an-object", requestId: null,
        createdAt: new Date("2026-08-23T00:01:00.000Z"),
      });
    bindPrismaClient({ auditLog: { create } } as never);

    await expect(writeAudit({
      actorType: "USER", actorId: "actor-1", action: "providers.workforce.command",
      targetType: "provider_worker", targetId: "worker-1", reason: "approved_reason",
      context: { version: 2, active: true }, requestId: "request-1",
    })).resolves.toEqual({
      id: "audit-full", actorType: "USER", actorId: "actor-1",
      action: "providers.workforce.command", targetType: "provider_worker", targetId: "worker-1",
      reason: "approved_reason",
      context: { version: 2, active: true, list: [1, { state: "ACTIVE" }] },
      requestId: "request-1", createdAt: "2026-08-23T00:00:00.000Z",
    });
    await expect(writeAudit({
      actorType: "SYSTEM", action: "providers.workforce.checked", targetType: "provider",
    })).resolves.toEqual({
      id: "audit-sparse", actorType: "SYSTEM", action: "providers.workforce.checked",
      targetType: "provider", context: {}, createdAt: "2026-08-23T00:01:00.000Z",
    });
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("rejects secret and protected markers nested in arrays while primitive values stay safe", () => {
    expect(() => assertSafeAuditInput({
      actorType: "USER", action: "safe", targetType: "safe", context: { facts: [1, true, "safe"] },
    })).not.toThrow();
    expect(() => assertSafeAuditInput({
      actorType: "USER", action: "safe", targetType: "safe", context: { facts: [{ invitationProof: "private" }] },
    })).toThrow(/invalid/u);
    expect(() => assertSafeAuditInput({
      actorType: "USER", action: "safe", targetType: "safe", context: { facts: [{ operationalPhone: "+201000000000" }] },
    })).toThrow(/invalid/u);
  });
});
