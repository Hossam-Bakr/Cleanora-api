
import { PrivacyRequestService } from "../../../../src/modules/customers/privacy-request.service.js";

const principal = {
  userId: "owner", sessionId: "session", accountCategories: ["INDIVIDUAL"] as const,
  verifiedCategories: [] as const, pendingCategories: ["INDIVIDUAL"] as const,
  status: "ACTIVE" as const, verificationOnly: false,
};

describe("US4 privacy request service boundary", () => {
  it("returns an existing active request for a repeated purpose without a second mutation audit", async () => {
    const append = vi.fn();
    const existing = {
      id: "request", userId: "owner", purpose: "EXPORT" as const, status: "PENDING" as const,
      processorId: null, outcomeCode: null, requestedAt: "", updatedAt: "",
      cancelledAt: null, processingAt: null, terminalAt: null, purgeAfter: null,
    };
    const service = new PrivacyRequestService(
      {
        run: async (work: (context: unknown) => Promise<unknown>) =>
          work({ prisma: {}, generalAudit: { append }, privilegedAudit: {} }),
      } as never,
      { createOrFindActive: async () => ({ request: existing, created: false }) } as never,
      30,
      { append: async () => ({ id: "denial", createdAt: "" }) },
    );
    await expect(service.submit(principal, "EXPORT")).resolves.toMatchObject({ id: "request" });
    expect(append).not.toHaveBeenCalled();
  });
});
