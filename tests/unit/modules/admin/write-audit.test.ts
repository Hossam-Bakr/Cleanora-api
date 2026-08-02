
import { writeAuditWith as writeAudit } from "../../../../src/modules/admin/audit.service.js";

describe("writeAudit", () => {
  it("passes the complete append-only audit input to its writer", async () => {
    const input = {
      actorType: "SYSTEM" as const,
      action: "FOUNDATION_CONFIGURATION_SEEDED",
      targetType: "configuration",
      targetId: "country-eg",
      reason: "Initial reference-data seed",
      context: { phase: "R1-P01" },
      requestId: "c58c939d-bbc1-44b9-a99b-282edfb1d534"
    };
    const record = {
      ...input,
      id: "audit-1",
      createdAt: "2026-07-24T00:00:00.000Z"
    };
    const append = vi.fn(async () => record);

    await expect(writeAudit({ append }, input)).resolves.toEqual(record);

    expect(append).toHaveBeenCalledWith(input);
  });

  it("rejects invalid or secret-like audit context before persistence", async () => {
    const append = vi.fn();

    await expect(
      writeAudit(
        { append },
        {
          actorType: "SYSTEM",
          action: " ",
          targetType: "configuration"
        }
      )
    ).rejects.toMatchObject({ code: "AUDIT_INPUT_INVALID" });
    await expect(
      writeAudit(
        { append },
        {
          actorType: "SYSTEM",
          action: "CONFIGURATION_UPDATED",
          targetType: "configuration",
          context: { token: "private" }
        }
      )
    ).rejects.toMatchObject({ code: "AUDIT_INPUT_INVALID" });

    expect(append).not.toHaveBeenCalled();
  });

  it("fails closed when the audit writer cannot persist evidence", async () => {
    const failure = new Error("database unavailable");

    await expect(
      writeAudit(
        { append: async () => Promise.reject(failure) },
        {
          actorType: "SYSTEM",
          action: "CONFIGURATION_UPDATED",
          targetType: "configuration"
        }
      )
    ).rejects.toBe(failure);
  });
});
