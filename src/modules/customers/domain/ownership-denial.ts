import type { DenialAuditWriter } from "#modules/admin/audit.service";
import { customersError, type CustomersErrorCode } from "./customers.errors.js";
import type { CustomerSelfDenialCode } from "./customer-self.policy.js";
import type { AuthenticationPrincipal } from "../../authentication/authentication.public.js";

async function appendOwnershipDenial(
  writer: DenialAuditWriter,
  principal: AuthenticationPrincipal,
  action: string,
  denialCode: CustomerSelfDenialCode,
  requestId?: string,
): Promise<void> {
  await writer.append({
    actorType: "USER",
    actorId: principal.userId,
    action,
    targetType: "customer_self_service",
    targetId: principal.userId,
    outcome: denialCode,
    ...(requestId === undefined ? {} : { requestId }),
  });
}

/**
 * Records a minimized, non-transactional denial before returning the same safe
 * public forbidden result. It intentionally includes no profile or media data.
 * Use for category/eligibility/inactive-principal denials (not cross-customer
 * resource-id ownership oracles).
 */
export async function denyCustomerOperation(
  writer: DenialAuditWriter,
  principal: AuthenticationPrincipal,
  action: string,
  denialCode: CustomerSelfDenialCode,
  requestId?: string,
): Promise<never> {
  await appendOwnershipDenial(writer, principal, action, denialCode, requestId);
  throw customersError("CUSTOMER_PROFILE_FORBIDDEN");
}

/**
 * FR-030: wrong-owner resource-id access must not leak existence. Append the
 * redacted denial audit, then throw the same not-found error used for missing
 * resources. Call only after the customers transaction has finished.
 */
export async function denyCustomerOwnershipAsUnavailable(
  writer: DenialAuditWriter,
  principal: AuthenticationPrincipal,
  action: string,
  denialCode: CustomerSelfDenialCode,
  unavailableCode: Extract<
    CustomersErrorCode,
    "CUSTOMER_ADDRESS_NOT_FOUND" | "PRIVACY_REQUEST_NOT_FOUND"
  >,
  requestId?: string,
): Promise<never> {
  await appendOwnershipDenial(writer, principal, action, denialCode, requestId);
  throw customersError(unavailableCode);
}
