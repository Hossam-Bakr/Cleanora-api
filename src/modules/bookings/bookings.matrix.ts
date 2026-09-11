export const BOOKING_FORMULA_VERSION = "r1-p13-v1" as const;

/**
 * Seed documentation for the executable customer rows persisted in
 * `status_transition_rules`. Runtime commands must read that table; they must
 * not treat this array as an independent authority.
 */
export const EXECUTABLE_TRANSITIONS = [
  { actor: "CUSTOMER", from: "NONE", to: "DRAFT" },
  { actor: "CUSTOMER", from: "DRAFT", to: "AWAITING_DEPOSIT" },
  { actor: "CUSTOMER", from: "DRAFT", to: "CANCELLED" },
  { actor: "CUSTOMER", from: "AWAITING_DEPOSIT", to: "CANCELLED" },
] as const;

export type BookingStatusName =
  | "DRAFT"
  | "AWAITING_DEPOSIT"
  | "CONFIRMED"
  | "CANCELLED";

/**
 * @desc Whether a customer-initiated transition is executable in R1-P13.
 * @access Bookings domain
 */
export function isExecutableCustomerTransition(
  from: "NONE" | BookingStatusName,
  to: BookingStatusName,
): boolean {
  return EXECUTABLE_TRANSITIONS.some(
    (row) => row.actor === "CUSTOMER" && row.from === from && row.to === to,
  );
}
