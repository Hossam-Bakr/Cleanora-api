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

/**
 * Seed documentation for executable R1-P16 rows persisted by the P16
 * migration. Runtime commands still read `status_transition_rules`.
 */
export const P16_EXECUTABLE_TRANSITIONS = [
  { actor: "CUSTOMER", from: "CONFIRMED", to: "CANCELLED" },
  { actor: "CUSTOMER", from: "ACCEPTED", to: "CANCELLED" },
  { actor: "PROVIDER", from: "CONFIRMED", to: "ACCEPTED" },
  { actor: "PROVIDER", from: "CONFIRMED", to: "CANCELLED" },
  { actor: "PROVIDER", from: "ACCEPTED", to: "CANCELLED" },
  { actor: "SYSTEM", from: "CONFIRMED", to: "CANCELLED" },
  { actor: "STAFF_ADMIN", from: "CONFIRMED", to: "CANCELLED" },
  { actor: "STAFF_ADMIN", from: "ACCEPTED", to: "CANCELLED" },
] as const;

export type BookingStatusName =
  | "DRAFT"
  | "AWAITING_DEPOSIT"
  | "CONFIRMED"
  | "ACCEPTED"
  | "ASSIGNED"
  | "CANCELLED";

/**
 * Seed documentation for executable R1-P17 rows persisted by the P17
 * migration. Runtime commands still read `status_transition_rules`.
 */
export const P17_EXECUTABLE_TRANSITIONS = [
  { actor: "PROVIDER", from: "ACCEPTED", to: "ASSIGNED" },
  { actor: "CUSTOMER", from: "ASSIGNED", to: "CANCELLED" },
  { actor: "PROVIDER", from: "ASSIGNED", to: "CANCELLED" },
  { actor: "STAFF_ADMIN", from: "ASSIGNED", to: "CANCELLED" },
] as const;

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
