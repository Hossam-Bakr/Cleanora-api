import { AppError } from "#shared/errors/app-error";

export type OrdersErrorCode =
  | "VALIDATION_FAILED"
  | "AUTHENTICATION_REQUIRED"
  | "ORDER_FORBIDDEN"
  | "ORDER_NOT_FOUND"
  | "ORDER_ENSURE_REJECTED"
  | "ORDER_TRANSITION_ILLEGAL"
  | "ORDER_CODE_INVALID"
  | "ORDER_CODE_EXPIRED"
  | "ORDER_CODE_LOCKED"
  | "ORDER_CODE_REQUIRED"
  | "ORDER_IDEMPOTENCY_CONFLICT"
  | "ORDER_ALREADY_TERMINAL"
  | "ORDER_MEDIA_NOT_VISIBLE"
  | "DEPENDENCY_FAILURE";

const STATUS: Record<OrdersErrorCode, number> = {
  VALIDATION_FAILED: 400,
  AUTHENTICATION_REQUIRED: 401,
  ORDER_FORBIDDEN: 403,
  ORDER_NOT_FOUND: 404,
  ORDER_ENSURE_REJECTED: 409,
  ORDER_TRANSITION_ILLEGAL: 409,
  ORDER_CODE_INVALID: 409,
  ORDER_CODE_EXPIRED: 409,
  ORDER_CODE_LOCKED: 409,
  ORDER_CODE_REQUIRED: 400,
  ORDER_IDEMPOTENCY_CONFLICT: 409,
  ORDER_ALREADY_TERMINAL: 409,
  ORDER_MEDIA_NOT_VISIBLE: 403,
  DEPENDENCY_FAILURE: 503,
};

const MESSAGES: Record<OrdersErrorCode, string> = {
  VALIDATION_FAILED: "Order request validation failed",
  AUTHENTICATION_REQUIRED: "Authentication is required",
  ORDER_FORBIDDEN: "Order action is forbidden for this actor",
  ORDER_NOT_FOUND: "Order was not found",
  ORDER_ENSURE_REJECTED: "Order cannot be created for this booking",
  ORDER_TRANSITION_ILLEGAL: "This order status transition is not allowed",
  ORDER_CODE_INVALID: "Completion code is invalid",
  ORDER_CODE_EXPIRED: "Completion code has expired",
  ORDER_CODE_LOCKED: "Completion code attempt limit reached",
  ORDER_CODE_REQUIRED: "Completion code is required",
  ORDER_IDEMPOTENCY_CONFLICT: "Idempotency key reused with a different body",
  ORDER_ALREADY_TERMINAL: "Order is already terminal",
  ORDER_MEDIA_NOT_VISIBLE: "Order media is not visible to this actor",
  DEPENDENCY_FAILURE: "An order dependency failed",
};

/**
 * @desc Create a safe Orders HTTP AppError.
 * @access Orders module
 */
export function ordersError(
  code: OrdersErrorCode,
  details?: Readonly<Record<string, unknown>>,
): AppError {
  return new AppError({
    code,
    message: MESSAGES[code],
    statusCode: STATUS[code],
    ...(details === undefined ? {} : { details }),
  });
}
