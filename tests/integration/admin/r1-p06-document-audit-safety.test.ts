import { assertSafeAuditInput } from "../../../src/modules/admin/audit.service.js";

describe("R1-P06 document audit safety", () => {
  it("allows exact version/state facts and rejects document private metadata", () => {
    expect(() => assertSafeAuditInput({ actorType: "USER", actorId: "staff", action: "PROVIDER_VERIFICATION_DOCUMENT_APPROVE", targetType: "PROVIDER_DOCUMENT_VERSION", targetId: "document", context: { providerId: "provider", expectedVersion: 2, outcome: "APPROVE" } })).not.toThrow();
    expect(() => assertSafeAuditInput({ actorType: "USER", actorId: "staff", action: "PROVIDER_VERIFICATION_DOCUMENT_APPROVE", targetType: "PROVIDER_DOCUMENT_VERSION", context: { documentNumber: "private" } })).toThrow("Audit input is invalid");
  });
});
