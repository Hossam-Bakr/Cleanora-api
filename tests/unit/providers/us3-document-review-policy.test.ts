import { assertDocumentTransition } from "../../../src/modules/providers/domain/provider-verification.lifecycle.js";
import { isMeaningfulSafeNote } from "../../../src/modules/providers/domain/provider-verification.catalog.js";
import { assertR1P06StaffPermission } from "../../../src/modules/authentication/authorization.policy.js";

describe("R1-P06 US3 document review", () => {
  it("requires active capable Staff and a meaningful reason", () => {
    expect(() => assertR1P06StaffPermission({ accountActive: true, staffAdminEnabled: true, permissionCodes: ["providers.verification.documents.review"], requiredPermission: "providers.verification.documents.review" })).not.toThrow();
    expect(() => assertR1P06StaffPermission({ accountActive: true, staffAdminEnabled: false, permissionCodes: ["providers.verification.documents.review"], requiredPermission: "providers.verification.documents.review" })).toThrow("PROVIDER_SCOPE_DENIED");
    expect(isMeaningfulSafeNote("Verified complete evidence.")).toBe(true);
    expect(isMeaningfulSafeNote(" ")).toBe(false);
  });
  it("allows submitted decisions and approved invalidation only", () => {
    expect(() => assertDocumentTransition("SUBMITTED", "APPROVED")).not.toThrow();
    expect(() => assertDocumentTransition("APPROVED", "INVALIDATED")).not.toThrow();
    expect(() => assertDocumentTransition("REJECTED", "APPROVED")).toThrow("DOCUMENT_STATE_CONFLICT");
  });
});
