import {
  assertCanPublishDocumentPolicy,
  assertDocumentPolicyDraft,
  R1_DOCUMENT_FIELD_RULES,
  selectCurrentEffectivePolicy,
} from "../../../src/modules/providers/domain/provider-document-policy.policy.js";

describe("R1-P06 US10 policy management", () => {
  const items = [{ documentTypeCode: "COMMERCIAL_REGISTRATION", isRequired: true, isActive: true, position: 0, fieldRules: R1_DOCUMENT_FIELD_RULES }];

  it("validates a unique country/kind draft and rejects duplicate stable types", () => {
    expect(() => assertDocumentPolicyDraft({ countryCode: "EG", providerKind: "REGISTERED_COMPANY", effectiveAt: new Date(), items })).not.toThrow();
    expect(() => assertDocumentPolicyDraft({ countryCode: "EG", providerKind: "REGISTERED_COMPANY", effectiveAt: new Date(), items: [...items, { ...items[0]!, position: 1 }] })).toThrow("POLICY_VERSION_CONFLICT");
    expect(() => assertDocumentPolicyDraft({ countryCode: "EG", providerKind: "REGISTERED_COMPANY", effectiveAt: new Date(), items: [{ ...items[0]!, fieldRules: { expiresAt: "OPTIONAL" } }] })).toThrow("POLICY_FIELD_RULES_INVALID");
  });

  it("publishes only a draft with a meaningful safe reason and effective time", () => {
    expect(() => assertCanPublishDocumentPolicy({ status: "DRAFT", effectiveAt: new Date(), reason: "Approved updated Egyptian company requirements" })).not.toThrow();
    expect(() => assertCanPublishDocumentPolicy({ status: "PUBLISHED", effectiveAt: new Date(), reason: "Approved updated Egyptian company requirements" })).toThrow("POLICY_IMMUTABLE");
    expect(() => assertCanPublishDocumentPolicy({ status: "DRAFT", effectiveAt: null, reason: "Approved updated Egyptian company requirements" })).toThrow("VALIDATION_ERROR");
  });

  it("selects the highest effective published version, never a draft or future row", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    const rows = [
      { status: "PUBLISHED" as const, effectiveAt: new Date("2026-08-12T00:00:00.000Z"), policyVersion: 1 },
      { status: "PUBLISHED" as const, effectiveAt: new Date("2026-08-13T00:00:00.000Z"), policyVersion: 2 },
      { status: "PUBLISHED" as const, effectiveAt: new Date("2026-08-14T00:00:00.000Z"), policyVersion: 3 },
      { status: "DRAFT" as const, effectiveAt: new Date("2026-08-10T00:00:00.000Z"), policyVersion: 4 },
    ];
    expect(selectCurrentEffectivePolicy(rows, now)?.policyVersion).toBe(2);
  });
});
