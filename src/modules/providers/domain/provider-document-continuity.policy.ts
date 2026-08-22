import type { ProviderDocumentStatus } from "./provider-verification.types.js";

export function predecessorRemainsEffective(input: {
  readonly predecessorStatus: ProviderDocumentStatus;
  readonly predecessorExpiresAt: Date | null;
  readonly successorStatus: ProviderDocumentStatus;
  readonly challenged: boolean;
  readonly now: Date;
}): boolean {
  return (
    input.predecessorStatus === "APPROVED" &&
    !input.challenged &&
    (input.predecessorExpiresAt === null || input.predecessorExpiresAt.getTime() > input.now.getTime()) &&
    ["DRAFT", "SUBMITTED", "REJECTED"].includes(input.successorStatus)
  );
}

export function successorApprovalEffect(input: {
  readonly predecessorWasEffective: boolean;
  readonly successorStatus: ProviderDocumentStatus;
}): { readonly predecessorStatus: "SUPERSEDED"; readonly moveEffectivePointer: boolean } {
  if (input.successorStatus !== "SUBMITTED") throw new Error("DOCUMENT_STATE_CONFLICT");
  return { predecessorStatus: "SUPERSEDED", moveEffectivePointer: input.predecessorWasEffective };
}

export function canCreateDocumentSuccessor(status: ProviderDocumentStatus): boolean {
  return ["APPROVED", "REJECTED", "REPLACEMENT_REQUESTED", "EXPIRED", "INVALIDATED"].includes(status);
}
