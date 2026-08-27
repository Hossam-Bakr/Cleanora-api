
import {
  assertSafeDenialAuditInput,
  type DenialAuditWriter,
  type SafeDenialAuditInput,
} from "../../../src/modules/admin/audit.public.js";
import { WorkforcePolicyError } from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import { runWithWorkforceDenialAudit } from "../../../src/modules/providers/provider-workforce-denial-audit.service.js";

function writerHarness() {
  const rows: SafeDenialAuditInput[] = [];
  const writer: DenialAuditWriter = {
    append: vi.fn(async (input) => {
      assertSafeDenialAuditInput(input);
      rows.push(input);
      return { id: "audit-denied-1", createdAt: "2026-08-23T10:00:00.000Z" };
    }),
  };
  return { writer, rows };
}

const safeInput = {
  actorUserId: "owner-1",
  providerId: "provider-1",
  targetType: "provider_worker_access" as const,
  targetId: "worker-1",
  expectedVersion: 7,
  requestId: "00000000-0000-4000-8000-000000000701",
  action: "providers.workforce.worker.access_reset.denied",
};

describe("R1-P07 accepted and denied high-risk audit evidence", () => {
  it("writes one attributable safe denial row after the business transaction rejects", async () => {
    const harness = writerHarness();
    const failure = new WorkforcePolicyError("WORKFORCE_REAUTHENTICATION_REQUIRED");

    await expect(runWithWorkforceDenialAudit(harness.writer, safeInput, async () => {
      throw failure;
    })).rejects.toBe(failure);

    expect(harness.rows).toEqual([{
      actorType: "USER",
      actorId: "owner-1",
      action: "providers.workforce.worker.access_reset.denied",
      targetType: "provider_worker_access",
      targetId: "worker-1",
      reason: "WORKFORCE_REAUTHENTICATION_REQUIRED",
      outcome: "DENIED",
      context: { providerId: "provider-1", expectedVersion: 7 },
      requestId: safeInput.requestId,
    }]);
    expect(JSON.stringify(harness.rows)).not.toMatch(/(?:email|phone|proof|password|credential|token|cookie|otp|storage.?key|note)/iu);
  });

  it("does not append denial evidence for an accepted command", async () => {
    const harness = writerHarness();
    await expect(runWithWorkforceDenialAudit(harness.writer, safeInput, async () => ({ outcomeCode: "ACCEPTED" })))
      .resolves.toEqual({ outcomeCode: "ACCEPTED" });
    expect(harness.writer.append).not.toHaveBeenCalled();
  });

  it("rejects forbidden protected and secret keys from the shared Admin audit contract", () => {
    for (const context of [
      { operationalPhone: "+201011111111" },
      { invitationProof: "secret-proof" },
      { nested: { storageKey: "private-key" } },
      { email: "private@example.invalid" },
    ]) {
      expect(() => assertSafeDenialAuditInput({
        actorType: "USER",
        action: "providers.workforce.denied",
        targetType: "provider_worker",
        outcome: "DENIED",
        context,
      })).toThrowError(expect.objectContaining({ code: "AUDIT_INPUT_INVALID" }));
    }
  });
});
