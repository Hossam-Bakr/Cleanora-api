import { AppError } from "#shared/errors/app-error";

export type CustomersErrorCode =
  | "CUSTOMER_PROFILE_FORBIDDEN"
  | "CUSTOMER_PROFILE_IMAGE_ABSENT"
  | "CUSTOMER_PROFILE_IMAGE_INVALID"
  | "CUSTOMER_PROFILE_IMAGE_CONFLICT"
  | "CUSTOMER_ADDRESS_NOT_FOUND"
  | "CUSTOMER_ADDRESS_CONFLICT"
  | "CUSTOMER_ADDRESS_INVALID"
  | "CUSTOMER_PREFERENCES_CONFLICT"
  | "CUSTOMER_PREFERENCES_INVALID"
  | "PRIVACY_REQUEST_NOT_FOUND"
  | "PRIVACY_REQUEST_CONFLICT"
  | "PRIVACY_REQUEST_TRANSITION_INVALID"
  | "PRIVACY_REQUEST_FORBIDDEN"
  | "PRIVACY_REQUEST_OUTCOME_INVALID";

export function customersError(code: CustomersErrorCode): AppError {
  const definitions: Record<
    CustomersErrorCode,
    { readonly message: string; readonly statusCode: number }
  > = {
    CUSTOMER_PROFILE_FORBIDDEN: {
      message: "Customer profile access is not available",
      statusCode: 403,
    },
    CUSTOMER_PROFILE_IMAGE_ABSENT: {
      message: "Profile image is not set",
      statusCode: 404,
    },
    CUSTOMER_PROFILE_IMAGE_INVALID: {
      message: "Profile image is invalid",
      statusCode: 400,
    },
    CUSTOMER_PROFILE_IMAGE_CONFLICT: {
      message: "Profile image changed concurrently",
      statusCode: 409,
    },
    CUSTOMER_ADDRESS_NOT_FOUND: {
      message: "Address is unavailable",
      statusCode: 404,
    },
    CUSTOMER_ADDRESS_CONFLICT: {
      message: "Address changed concurrently",
      statusCode: 409,
    },
    CUSTOMER_ADDRESS_INVALID: {
      message: "Address is invalid",
      statusCode: 400,
    },
    CUSTOMER_PREFERENCES_CONFLICT: {
      message: "Preferences changed concurrently",
      statusCode: 409,
    },
    CUSTOMER_PREFERENCES_INVALID: {
      message: "Preferences are invalid",
      statusCode: 400,
    },
    PRIVACY_REQUEST_NOT_FOUND: {
      message: "Privacy request is unavailable",
      statusCode: 404,
    },
    PRIVACY_REQUEST_CONFLICT: {
      message: "Privacy request changed concurrently",
      statusCode: 409,
    },
    PRIVACY_REQUEST_TRANSITION_INVALID: {
      message: "Privacy request transition is not available",
      statusCode: 409,
    },
    PRIVACY_REQUEST_FORBIDDEN: {
      message: "Privacy request access is not available",
      statusCode: 403,
    },
    PRIVACY_REQUEST_OUTCOME_INVALID: {
      message: "Privacy request outcome is invalid",
      statusCode: 400,
    },
  };
  const definition = definitions[code];
  return new AppError({ code, ...definition, expose: true });
}
