
import { PRIVACY_PROCESSOR_CAPABILITY } from "../../../../src/modules/customers/domain/privacy-processor.capability.js";
import { PrivacyProcessorService } from "../../../../src/modules/customers/privacy-processor.service.js";
import { PrivacyPrivilegedService } from "../../../../src/modules/customers/privacy-privileged.service.js";

const request = {
  id: "request", userId: "owner", purpose: "DELETION" as const, status: "PENDING" as const,
  processorId: null, outcomeCode: null, requestedAt: "", updatedAt: "",
  cancelledAt: null, processingAt: null, terminalAt: null, purgeAfter: null,
};

const unitOfWork = {
  run: async (work: (context: unknown) => Promise<unknown>) =>
    work({ prisma: {}, generalAudit: { append: vi.fn() }, privilegedAudit: { append: vi.fn() } }),
};

describe("privacy processor and privileged authority", () => {
  it("accepts only the composition capability for a processor claim", async () => {
    const claim = vi.fn().mockResolvedValue(request);
    const service = new PrivacyProcessorService(
      unitOfWork as never, { find: async () => request, claim } as never, 30,
    );
    await expect(service.claim("request", {
      processorId: "processor", capability: PRIVACY_PROCESSOR_CAPABILITY,
    })).resolves.toMatchObject({ id: "request" });
    await expect(service.claim("request", {
      processorId: "processor", capability: "forged" as never,
    })).rejects.toMatchObject({ code: "PRIVACY_REQUEST_FORBIDDEN" });
    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("denies privileged reassignment by default when authorization rejects", async () => {
    const reassign = vi.fn();
    const service = new PrivacyPrivilegedService(
      unitOfWork as never, { reassign } as never,
      { authorizeProtectedOperation: async () => ({ allowed: false }) } as never,
    );
    await expect(service.reassign({
      requestId: "request", newProcessorId: "processor-b",
      actor: {
        userId: "staff", sessionId: "session", accountCategories: [],
        verifiedCategories: [], pendingCategories: [], status: "ACTIVE", verificationOnly: false,
      },
      reasonCode: "privacy_request_reassign",
    })).rejects.toMatchObject({ code: "PRIVACY_REQUEST_FORBIDDEN" });
    expect(reassign).not.toHaveBeenCalled();
  });
});
