/**
 * Field-actor and read entitlement helpers for Orders.
 */

export type OrderActorRole =
  | "FIELD_MEMBER"
  | "PROVIDER_MANAGER"
  | "CUSTOMER"
  | "STAFF"
  | "NONE";

export interface OrderActivationMember {
  readonly workerUserId: string | null;
}

export interface OrderAuthzFacts {
  readonly providerId: string;
  readonly customerUserId: string;
  readonly activeMembers: readonly OrderActivationMember[];
}

/**
 * @desc Classify the actor against order activation facts (no writes for staff/customer).
 * @access Orders domain
 */
export function classifyOrderActor(input: {
  readonly actorUserId: string;
  readonly facts: OrderAuthzFacts;
  readonly isProviderManager: boolean;
  readonly isStaff: boolean;
}): OrderActorRole {
  if (
    input.facts.activeMembers.some(
      (member) => member.workerUserId === input.actorUserId,
    )
  ) {
    return "FIELD_MEMBER";
  }
  if (input.isProviderManager) {
    return "PROVIDER_MANAGER";
  }
  if (input.facts.customerUserId === input.actorUserId) {
    return "CUSTOMER";
  }
  if (input.isStaff) {
    return "STAFF";
  }
  return "NONE";
}

/**
 * @desc Field actors may transition/complete/resend/attach.
 * @access Orders domain
 */
export function isFieldActor(role: OrderActorRole): boolean {
  return role === "FIELD_MEMBER" || role === "PROVIDER_MANAGER";
}

/**
 * @desc Whether the actor may read the order dossier/timeline.
 * @access Orders domain
 */
export function canReadOrder(role: OrderActorRole): boolean {
  return (
    role === "FIELD_MEMBER" ||
    role === "PROVIDER_MANAGER" ||
    role === "CUSTOMER" ||
    role === "STAFF"
  );
}

/**
 * @desc Customer COMPLETION media visibility only after COMPLETED.
 * @access Orders domain
 */
export function canViewCompletionMedia(input: {
  readonly role: OrderActorRole;
  readonly orderStatus: string;
  readonly kind: "PROGRESS" | "COMPLETION";
}): boolean {
  if (input.role === "FIELD_MEMBER" || input.role === "PROVIDER_MANAGER" || input.role === "STAFF") {
    return true;
  }
  if (input.role !== "CUSTOMER") {
    return false;
  }
  if (input.kind === "PROGRESS") {
    return false;
  }
  return input.orderStatus === "COMPLETED";
}
