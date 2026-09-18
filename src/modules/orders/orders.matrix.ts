/**
 * Frozen R1-P18 fulfillment status matrix (OQ-010 / EX-01 / EX-02).
 * Illegal jumps fail closed. CANCELLED is coordinated cancel only.
 */

export const ORDER_STATUSES = [
  "ASSIGNED",
  "ON_THE_WAY",
  "IN_PROGRESS",
  "READY_TO_COMPLETE",
  "COMPLETED",
  "CANCELLED",
] as const;

export type OrderStatusName = (typeof ORDER_STATUSES)[number];

/** Executable forward field path only (no FAILED, no PENDING_SCHEDULED). */
export const ORDER_FORWARD_TRANSITIONS = [
  { from: "ASSIGNED", to: "ON_THE_WAY" },
  { from: "ON_THE_WAY", to: "IN_PROGRESS" },
  { from: "IN_PROGRESS", to: "READY_TO_COMPLETE" },
  { from: "READY_TO_COMPLETE", to: "COMPLETED" },
] as const;

const TERMINAL: ReadonlySet<OrderStatusName> = new Set([
  "COMPLETED",
  "CANCELLED",
]);

/**
 * @desc Whether a forward fulfillment transition is legal.
 * @access Orders domain
 */
export function isLegalForwardTransition(
  from: OrderStatusName,
  to: OrderStatusName,
): boolean {
  return ORDER_FORWARD_TRANSITIONS.some(
    (row) => row.from === from && row.to === to,
  );
}

/**
 * @desc Whether the order status is terminal for cancel coordination.
 * @access Orders domain
 */
export function isTerminalOrderStatus(status: OrderStatusName): boolean {
  return TERMINAL.has(status);
}

/**
 * @desc Whether cancel-from-booking may move the order to CANCELLED.
 * @access Orders domain
 */
export function canCancelFromBooking(status: OrderStatusName): boolean {
  return !isTerminalOrderStatus(status);
}
