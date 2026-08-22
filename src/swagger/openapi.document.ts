import { buildImplementedR1P05SwaggerFragments } from "./r1-p05-openapi.paths.js";
import { buildImplementedR1P06SwaggerFragments } from "./r1-p06-openapi.paths.js";

const r1P05Fragments = buildImplementedR1P05SwaggerFragments();
const r1P06Fragments = buildImplementedR1P06SwaggerFragments();

const apiErrorResponse = { $ref: "#/components/responses/ApiError" } as const;
const rateLimitResponse = {
  $ref: "#/components/responses/RateLimited",
} as const;

function documentedErrorResponse(
  description: string,
  examples: Readonly<Record<string, { summary: string; value: object }>>,
) {
  return {
    description,
    headers: {
      "x-request-id": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/ErrorEnvelope" },
        examples,
      },
    },
  };
}

const exampleRequestId = "7ebf45ad-7384-41ab-8e74-e864ae048d30";

type JsonRequestExample = {
  readonly summary: string;
  readonly value: Readonly<Record<string, unknown>>;
};

function jsonRequest(
  schemaName: string,
  description: string,
  examples?: Readonly<Record<string, JsonRequestExample>>,
) {
  return {
    required: true,
    description,
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaName}` },
        ...(examples === undefined ? {} : { examples }),
      },
    },
  };
}

function successResponse(description: string, dataSchemaName: string) {
  return {
    description,
    headers: {
      "x-request-id": { $ref: "#/components/headers/RequestId" },
    },
    content: {
      "application/json": {
        schema: {
          allOf: [
            { $ref: "#/components/schemas/SuccessEnvelope" },
            {
              type: "object",
              properties: {
                data: {
                  $ref: `#/components/schemas/${dataSchemaName}`,
                },
              },
            },
          ],
        },
      },
    },
  };
}

/**
 * Complete living API contract served by the Cleanora Swagger endpoint.
 * It documents implemented routes only and contains no real credentials.
 */
export const cleanoraOpenApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Cleanora API",
    version: "1.0.0-r1-p03a",
    summary: "Cleanora Release 1 foundation, authentication, and R1-P03A admin APIs",
    description: [
      "Professional living documentation for the implemented Cleanora modular-monolith API.",
      "",
      "All JSON endpoints use the same success or failure envelope and include a request correlation ID.",
      "Access tokens are sent as Bearer credentials. Refresh credentials are stored only in an HttpOnly cookie.",
      "Examples use placeholders and never contain usable passwords, tokens, OTPs, provider credentials, or database values.",
      "",
      "R1-P02 authentication is Complete. R1-P03A adds owner staff-admin provisioning and staff-admin role-grant commands under DEC-030.",
      "R1-P05 adds authenticated Provider onboarding, profile/media, Staff review, and operational suspend/reinstate. There is no anonymous Provider browse surface.",
    ].join("\n"),
    contact: {
      name: "Cleanora Engineering",
    },
  },
  servers: [
    {
      url: "https://cleanora-production.up.railway.app/api/v1",
      description: "Railway hosted API (default)",
    },
    {
      url: "http://localhost:8000/api/v1",
      description: "Local development API",
    },
  ],
  tags: [
    {
      name: "System Health",
      description:
        "Public liveness, readiness, and database-connectivity probes. These endpoints disclose no credentials or connection details.",
    },
    {
      name: "Signup & Verification",
      description:
        "Public account creation, category enrollment, OTP delivery, resend, and verification workflows.",
    },
    {
      name: "Sessions",
      description:
        "Phone/password login, access-token hydration, refresh rotation, and session termination.",
    },
    {
      name: "Password Recovery",
      description:
        "Enumeration-safe password recovery, single-use reset credentials, and authenticated password replacement.",
    },
    {
      name: "Google Identity",
      description:
        "Individual-only Google sign-in through a verified provider email, browser callback, deliberate linking, and safe unlinking.",
    },
    {
      name: "Staff-Admin Role Commands",
      description:
        "Privileged non-customer role-grant commands for enabled staff_admin actors. Customer role codes are rejected at validation.",
    },
    {
      name: "Owner Staff-Admin Provisioning",
      description:
        "Internal owner-only staff_admin provisioning guarded by X-Owner-Admin-Secret and OWNER_ADMIN_API_ENABLED.",
    },
    {
      name: "Customer Profiles",
      description:
        "Owner-private category profiles and one protected identity-wide profile image. Requires a Bearer principal with the matching verified customer category.",
    },
    {
      name: "Customer Addresses",
      description: "Owner-private text addresses. Countries must be active; coordinates and default-address behavior are unsupported.",
    },
    {
      name: "Customer Preferences",
      description: "Identity contact-state projection and complete language/notification preference replacement.",
    },
    {
      name: "Customer Privacy Requests",
      description: "Customer-owned request tracking only. Processing and privileged reassignment have no public HTTP surface.",
    },
    {
      name: "API Documentation",
      description:
        "Interactive Swagger UI and the machine-readable OpenAPI document.",
    },
    ...r1P05Fragments.tags,
    ...r1P06Fragments.tags,
  ],
  paths: {
    ...r1P05Fragments.paths,
    ...r1P06Fragments.paths,
    "/system/health/live": {
      get: {
        tags: ["System Health"],
        operationId: "getSystemLiveness",
        summary: "Check process liveness",
        description:
          "Confirms that the HTTP process is running. It does not query external dependencies and is suitable for a lightweight liveness probe.",
        responses: {
          "200": successResponse(
            "The Cleanora process is alive.",
            "LivenessData",
          ),
          "429": rateLimitResponse,
        },
      },
    },
    "/system/health/ready": {
      get: {
        tags: ["System Health"],
        operationId: "getSystemReadiness",
        summary: "Check application readiness",
        description:
          "Runs every required readiness probe. A 503 response means traffic should not be routed to this instance yet.",
        responses: {
          "200": successResponse(
            "Every required readiness probe passed.",
            "ReadinessData",
          ),
          "503": apiErrorResponse,
          "429": rateLimitResponse,
        },
      },
    },
    "/system/health/database": {
      get: {
        tags: ["System Health"],
        operationId: "getDatabaseHealth",
        summary: "Check database connectivity",
        description:
          "Verifies database connectivity using the shared application lifecycle. It never returns the connection string, SQL, host, credentials, or Prisma error details.",
        responses: {
          "200": successResponse(
            "Database connectivity is available.",
            "DatabaseHealthData",
          ),
          "503": apiErrorResponse,
        },
      },
    },
    "/auth/signup": {
      post: {
        tags: ["Signup & Verification"],
        operationId: "signup",
        summary: "Register a public account category",
        description:
          "Creates the authentication identity and required category profile atomically. Every supported category currently receives its blocking OTP by email; phone verification and SMS providers are deferred. Worker self-signup is prohibited. The frontend should use the returned EMAIL channel and masked destination when rendering the verification screen.",
        requestBody: jsonRequest(
          "SignupRequest",
          "Category-specific signup identifiers and a policy-compliant password.",
          {
            individual: {
              summary: "Individual — email activation",
              value: {
                accountCategory: "INDIVIDUAL",
                fullName: "Cleanora Individual",
                phone: "+201000000001",
                email: "individual@example.test",
                password: "4829517",
              },
            },
            company: {
              summary: "Company — email activation",
              value: {
                accountCategory: "COMPANY",
                companyName: "Cleanora Services",
                representativeFullName: "Cleanora Representative",
                phone: "+201000000002",
                email: "company@example.test",
                password: "4829517",
              },
            },
            engineer: {
              summary: "Engineer — email activation",
              value: {
                accountCategory: "ENGINEER",
                fullName: "Cleanora Engineer",
                professionalTitle: "Cleaning Engineer",
                phone: "+201000000003",
                email: "engineer@example.test",
                password: "4829517",
              },
            },
            providerOwner: {
              summary: "Provider Owner — email activation",
              value: {
                accountCategory: "PROVIDER_OWNER",
                phone: "+201000000004",
                email: "owner@example.test",
                password: "4829517",
              },
            },
          },
        ),
        responses: {
          "202": successResponse(
            "Signup was accepted and a verification challenge was created.",
            "VerificationChallengeData",
          ),
          "400": documentedErrorResponse(
            "One or more signup fields failed validation.",
            {
              validation: {
                summary: "All independently detectable invalid fields",
                value: {
                  success: false,
                  error: {
                    code: "REQUEST_VALIDATION_FAILED",
                    statusCode: 400,
                    message: "Request validation failed",
                    details: {
                      issues: [
                        {
                          path: "email",
                          code: "invalid_format",
                          message: "Enter a valid email address.",
                        },
                        {
                          path: "phone",
                          code: "invalid_format",
                          message: "Enter a valid international phone number.",
                        },
                      ],
                    },
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "409": documentedErrorResponse(
            "The normalized phone, email, or both already belong to an account.",
            {
              duplicatePhone: {
                summary: "Phone already registered",
                value: {
                  success: false,
                  error: {
                    code: "AUTH_PHONE_ALREADY_REGISTERED",
                    statusCode: 409,
                    message:
                      "This phone number is already registered. Sign in to use the existing account.",
                    details: {
                      field: "phone",
                      reason: "already_registered",
                    },
                  },
                  requestId: exampleRequestId,
                },
              },
              duplicateEmail: {
                summary: "Email already registered",
                value: {
                  success: false,
                  error: {
                    code: "AUTH_EMAIL_ALREADY_REGISTERED",
                    statusCode: 409,
                    message:
                      "This email address is already registered. Sign in to use the existing account.",
                    details: {
                      field: "email",
                      reason: "already_registered",
                    },
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "429": rateLimitResponse,
          "503": apiErrorResponse,
        },
      },
    },
    "/auth/account-categories": {
      post: {
        tags: ["Signup & Verification"],
        operationId: "enrollAccountCategory",
        summary: "Enroll another account category",
        description:
          "Adds another supported category and its required profile to the authenticated identity without creating another user, role, or permission. Existing verified categories remain usable while the new category is pending.",
        security: [{ bearerAuth: [] }],
        requestBody: jsonRequest(
          "EnrollCategoryRequest",
          "The additional self-signup category to enroll.",
          {
            individual: {
              summary: "Enroll Individual",
              value: {
                accountCategory: "INDIVIDUAL",
                fullName: "Cleanora Individual",
              },
            },
            company: {
              summary: "Enroll Company",
              value: {
                accountCategory: "COMPANY",
                companyName: "Cleanora Services",
                representativeFullName: "Cleanora Representative",
              },
            },
            engineer: {
              summary: "Enroll Engineer",
              value: {
                accountCategory: "ENGINEER",
                fullName: "Cleanora Engineer",
                professionalTitle: "Cleaning Engineer",
              },
            },
            providerOwner: {
              summary: "Enroll Provider Owner",
              value: { accountCategory: "PROVIDER_OWNER" },
            },
          },
        ),
        responses: {
          "202": successResponse(
            "The category was enrolled and its verification challenge was created.",
            "VerificationChallengeData",
          ),
          "400": documentedErrorResponse(
            "The challenge is invalid, expired, already used, mismatched, or its attempt limit was reached.",
            {
              invalidChallenge: {
                summary: "Verification failed safely",
                value: {
                  success: false,
                  error: {
                    code: "AUTH_VERIFICATION_FAILED",
                    statusCode: 400,
                    message: "Authentication verification failed.",
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "401": documentedErrorResponse(
            "The phone/password combination is invalid or the credential is temporarily locked.",
            {
              invalidCredentials: {
                summary: "Enumeration-safe invalid credentials",
                value: {
                  success: false,
                  error: {
                    code: "AUTHENTICATION_FAILED",
                    statusCode: 401,
                    message: "Authentication failed.",
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "403": apiErrorResponse,
          "409": apiErrorResponse,
        },
      },
    },
    "/auth/otp/request": {
      post: {
        tags: ["Signup & Verification"],
        operationId: "requestVerificationOtp",
        summary: "Request or resend a verification credential",
        description:
          "Creates or resends the exact allowed verification challenge. The preferred frontend contract uses the opaque challengeId returned by signup or an earlier request; internal identity IDs are not required for the normal signup flow. Cooldown and supersession rules apply.",
        requestBody: jsonRequest(
          "OtpRequest",
          "Provide an existing challengeId, or the explicitly supported identity/category selector.",
        ),
        responses: {
          "202": successResponse(
            "A current verification challenge is available.",
            "VerificationChallengeData",
          ),
          "400": apiErrorResponse,
          "429": rateLimitResponse,
          "503": apiErrorResponse,
        },
      },
    },
    "/auth/otp/verify": {
      post: {
        tags: ["Signup & Verification"],
        operationId: "verifyOtp",
        summary: "Verify a six-digit account code",
        description:
          "Consumes one active challenge after validating its user, category, purpose, channel, destination, expiry, attempt limit, and six-digit code. Public signup verification completes without automatically creating a login session.",
        requestBody: jsonRequest(
          "OtpVerifyRequest",
          "The opaque challenge ID and matching six-digit verification code.",
        ),
        responses: {
          "200": successResponse(
            "Verification completed. The frontend should continue to login.",
            "VerificationResultData",
          ),
          "400": apiErrorResponse,
          "429": rateLimitResponse,
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Sessions"],
        operationId: "login",
        summary: "Sign in with phone and password",
        description:
          "Authenticates an eligible identity, creates a refresh-backed session, returns a short-lived access token, and writes the refresh credential only to an HttpOnly cookie. Unknown accounts and incorrect passwords share safe public failure semantics.",
        requestBody: jsonRequest(
          "LoginRequest",
          "Normalized phone identifier and current password.",
        ),
        responses: {
          "200": successResponse(
            "Authentication succeeded and a session was established.",
            "SessionTokenData",
          ),
          "400": apiErrorResponse,
          "401": apiErrorResponse,
          "429": rateLimitResponse,
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Sessions"],
        operationId: "refreshSession",
        summary: "Rotate the refresh session",
        description:
          "Consumes the current HttpOnly refresh cookie, rotates the refresh family, and returns a replacement access token plus the canonical frontend-safe user. Browser clients must send credentials and an allowlisted Origin. Reuse of an older refresh credential revokes the affected family.",
        security: [{ refreshCookie: [] }],
        responses: {
          "200": successResponse(
            "The session was rotated and a replacement access token was issued.",
            "SessionTokenData",
          ),
          "401": apiErrorResponse,
          "403": apiErrorResponse,
          "429": rateLimitResponse,
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Sessions"],
        operationId: "logout",
        summary: "End the current session",
        description:
          "Revokes the current session using either a valid Bearer principal or the refresh cookie and clears the refresh cookie with matching attributes.",
        security: [{ bearerAuth: [] }, { refreshCookie: [] }],
        responses: {
          "200": successResponse(
            "The current session was revoked.",
            "LogoutData",
          ),
          "401": apiErrorResponse,
          "403": apiErrorResponse,
        },
      },
    },
    "/auth/logout-all": {
      post: {
        tags: ["Sessions"],
        operationId: "logoutAll",
        summary: "End every user session",
        description:
          "Revokes all session families owned by the authenticated identity. Every prior refresh credential becomes unusable.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": successResponse(
            "All sessions were revoked.",
            "LogoutData",
          ),
          "401": apiErrorResponse,
          "403": apiErrorResponse,
        },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Sessions"],
        operationId: "getCurrentIdentity",
        summary: "Get the authenticated identity",
        description:
          "Returns the canonical safe user used to hydrate the frontend after login, refresh, or page reload. The user is derived from the Bearer token; the client never supplies a user ID.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": successResponse(
            "The safe current identity was returned.",
            "CurrentIdentityData",
          ),
          "401": apiErrorResponse,
          "403": apiErrorResponse,
        },
      },
    },
    "/auth/password/forgot": {
      post: {
        tags: ["Password Recovery"],
        operationId: "forgotPassword",
        summary: "Request password recovery",
        description:
          "Accepts a recovery request without revealing whether an account exists. Every valid request returns an opaque challenge ID. Existing eligible accounts receive a four-digit reset code through the authoritative channel. The same response shape is used for absent accounts.",
        requestBody: jsonRequest(
          "ForgotPasswordRequest",
          "Account category and its authoritative recovery identifier.",
        ),
        responses: {
          "202": successResponse(
            "The syntactically valid recovery request was accepted.",
            "PasswordRecoveryAcceptedData",
          ),
          "400": apiErrorResponse,
          "429": rateLimitResponse,
        },
      },
    },
    "/auth/password/reset": {
      post: {
        tags: ["Password Recovery"],
        operationId: "resetPassword",
        summary: "Reset a forgotten password",
        description:
          "Combines the opaque challenge ID returned by forgot-password with the four-digit code delivered out-of-band. The code is single-use, expiring, and attempt-limited. A successful reset replaces the password and revokes every session atomically without signing the user in.",
        requestBody: jsonRequest(
          "ResetPasswordRequest",
          "Opaque recovery challenge, four-digit code, and replacement password.",
        ),
        responses: {
          "200": successResponse(
            "The password was reset and all sessions were revoked.",
            "PasswordResetData",
          ),
          "400": apiErrorResponse,
          "429": rateLimitResponse,
        },
      },
    },
    "/auth/password/change": {
      post: {
        tags: ["Password Recovery"],
        operationId: "changePassword",
        summary: "Change the authenticated password",
        description:
          "Requires a full Bearer session, current refresh cookie, trusted Origin, correct current password, and a distinct policy-compliant replacement. It revokes every other session and rotates the current session atomically.",
        security: [{ bearerAuth: [], refreshCookie: [] }],
        requestBody: jsonRequest(
          "ChangePasswordRequest",
          "Current password and a distinct replacement password.",
        ),
        responses: {
          "200": successResponse(
            "The password changed and the current session was rotated.",
            "SessionTokenData",
          ),
          "400": apiErrorResponse,
          "401": apiErrorResponse,
          "403": apiErrorResponse,
        },
      },
    },
    "/auth/google": {
      get: {
        tags: ["Google Identity"],
        operationId: "startGoogleSignInApi",
        summary: "Create a Google authorization URL",
        description:
          "Creates one-time state, nonce, and PKCE correlation and returns the authorization URL to an API client. Do not start this request in Postman and continue it in Chrome because their HttpOnly cookie jars are separate. Browser applications must use `/auth/google/browser`.",
        responses: {
          "200": successResponse(
            "A one-time Google authorization URL was created.",
            "GoogleAuthorizationData",
          ),
          "403": apiErrorResponse,
          "429": rateLimitResponse,
        },
      },
    },
    "/auth/google/browser": {
      get: {
        tags: ["Google Identity"],
        operationId: "startGoogleSignInBrowser",
        summary: "Redirect a browser to Google",
        description:
          "Creates the correlated Google transaction, writes its HttpOnly state cookie, and redirects the top-level browser to Google. This is the recommended frontend entry point.",
        responses: {
          "303": {
            description: "Redirect to Google's authorization endpoint.",
            headers: {
              Location: {
                description: "Google authorization URL.",
                schema: { type: "string", format: "uri" },
              },
              "Cache-Control": {
                schema: { type: "string", example: "no-store" },
              },
            },
          },
          "403": apiErrorResponse,
          "429": rateLimitResponse,
        },
      },
    },
    "/auth/google/callback": {
      get: {
        tags: ["Google Identity"],
        operationId: "completeGoogleCallback",
        summary: "Complete Google sign-in or linking",
        description:
          "Browser callback only. Validates the correlation cookie, state, nonce, PKCE, provider claims, and one-time server transaction. On sign-in it writes the HttpOnly refresh cookie and redirects to the allowlisted frontend callback. The frontend then calls POST /auth/refresh with credentials included to obtain the access token and safe user. Tokens and raw provider parameters are never included in the redirect URL. Failures use only a stable safe reason marker.",
        parameters: [
          {
            name: "state",
            in: "query",
            required: true,
            description: "Opaque state returned by Google.",
            schema: { type: "string" },
          },
          {
            name: "code",
            in: "query",
            required: false,
            description: "Authorization code returned on provider success.",
            schema: { type: "string" },
          },
          {
            name: "error",
            in: "query",
            required: false,
            description:
              "Provider error selector. Raw provider details are not forwarded to the frontend.",
            schema: { type: "string" },
          },
        ],
        responses: {
          "303": {
            description:
              "Safe redirect to the allowlisted frontend callback. Successful sign-in also writes the refresh cookie.",
            headers: {
              Location: {
                description:
                  "Frontend callback containing safe `google`, `intent`, optional `verification`, and optional stable `reason` markers only.",
                schema: { type: "string", format: "uri" },
              },
              "Set-Cookie": {
                description:
                  "HttpOnly refresh cookie on successful sign-in; never returned in JSON.",
                schema: { type: "string" },
              },
            },
          },
          "429": rateLimitResponse,
        },
      },
    },
    "/auth/google/link": {
      get: {
        tags: ["Google Identity"],
        operationId: "startGoogleLink",
        summary: "Start deliberate Google account linking",
        description:
          "Creates a one-time LINK transaction bound to the current fully verified Individual user and session. The frontend navigates to the returned authorization URL in the same browser.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": successResponse(
            "A deliberate Google linking transaction was created.",
            "GoogleAuthorizationData",
          ),
          "401": apiErrorResponse,
          "403": apiErrorResponse,
          "409": apiErrorResponse,
        },
      },
    },
    "/auth/social/google": {
      delete: {
        tags: ["Google Identity"],
        operationId: "unlinkGoogle",
        summary: "Unlink the Google identity",
        description:
          "Removes the linked Google subject only when another recoverable password method remains. Google-origin session families are revoked according to the authentication policy.",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": successResponse(
            "Google was safely unlinked.",
            "GoogleUnlinkData",
          ),
          "401": apiErrorResponse,
          "403": apiErrorResponse,
          "409": apiErrorResponse,
        },
      },
    },
    "/auth/role-grants/commands": {
      post: {
        tags: ["Staff-Admin Role Commands"],
        operationId: "submitRoleGrantCommand",
        summary: "Submit one privileged non-customer role-grant command",
        description:
          "Requires a full Bearer session from an enabled staff_admin actor. Delegates assign, revoke, enable, and disable to RoleManagementService with permission and reason checks. The customer role code is forbidden at validation.",
        security: [{ bearerAuth: [] }],
        requestBody: jsonRequest(
          "RoleGrantCommandRequest",
          "One assign, revoke, enable, or disable command with a matching reason code and a non-customer role code.",
        ),
        responses: {
          "200": successResponse(
            "The command completed or returned an authorized no-op.",
            "RoleGrantCommandData",
          ),
          "400": documentedErrorResponse(
            "The body is invalid, including forbidden customer role codes or mismatched reason codes.",
            {
              invalidCommand: {
                summary: "Invalid or forbidden command body",
                value: {
                  success: false,
                  error: {
                    code: "INVALID_REQUEST",
                    statusCode: 400,
                    message: "The request is invalid.",
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "401": documentedErrorResponse(
            "Bearer authentication is missing or invalid.",
            {
              authenticationRequired: {
                summary: "Missing principal",
                value: {
                  success: false,
                  error: {
                    code: "AUTHENTICATION_REQUIRED",
                    statusCode: 401,
                    message: "Authentication is required.",
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "403": documentedErrorResponse(
            "Permission, reason, target, or transition checks rejected the command.",
            {
              rejected: {
                summary: "Coalesced command rejection",
                value: {
                  success: false,
                  error: {
                    code: "ROLE_GRANT_COMMAND_REJECTED",
                    statusCode: 403,
                    message: "The role-grant command was rejected.",
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "429": rateLimitResponse,
          "500": apiErrorResponse,
        },
      },
    },
    "/internal/owner/staff-admins": {
      post: {
        tags: ["Owner Staff-Admin Provisioning"],
        operationId: "provisionOwnerStaffAdmin",
        summary: "Assign or re-enable staff_admin for one target user",
        description:
          "Internal owner endpoint disabled unless OWNER_ADMIN_API_ENABLED is true. Requires the X-Owner-Admin-Secret header and an email body that identifies an existing verified active user.",
        parameters: [
          {
            in: "header",
            name: "X-Owner-Admin-Secret",
            required: true,
            schema: { type: "string" },
            description:
              "Owner provisioning secret. Examples use placeholders only.",
            example: "OWNER_ADMIN_SECRET_PLACEHOLDER",
          },
        ],
        requestBody: jsonRequest(
          "OwnerStaffAdminProvisionRequest",
          "Verified target user email address.",
        ),
        responses: {
          "200": successResponse(
            "The grant was created, re-enabled, or returned idempotently.",
            "OwnerStaffAdminProvisionData",
          ),
          "400": documentedErrorResponse(
            "The request body failed validation.",
            {
              invalidRequest: {
                summary: "Invalid email body",
                value: {
                  success: false,
                  error: {
                    code: "INVALID_REQUEST",
                    statusCode: 400,
                    message: "The request is invalid.",
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "403": documentedErrorResponse(
            "The owner secret, service gate, or target eligibility rejected provisioning.",
            {
              rejected: {
                summary: "Owner provisioning rejected",
                value: {
                  success: false,
                  error: {
                    code: "OWNER_STAFF_ADMIN_REJECTED",
                    statusCode: 403,
                    message: "Owner staff-admin provisioning was rejected.",
                  },
                  requestId: exampleRequestId,
                },
              },
            },
          ),
          "429": rateLimitResponse,
        },
      },
    },
    "/customers/profiles/individual": {
      get: {
        tags: ["Customer Profiles"], operationId: "getIndividualProfile",
        security: [{ bearerAuth: [] }],
        responses: { "200": successResponse("The owned individual profile or explicit not-created state.", "CustomerProfileData"), "401": apiErrorResponse, "403": apiErrorResponse },
      },
      put: {
        tags: ["Customer Profiles"], operationId: "putIndividualProfile",
        security: [{ bearerAuth: [] }], requestBody: jsonRequest("IndividualProfileRequest", "A trimmed non-blank full name."),
        responses: { "200": successResponse("The owned individual profile was saved.", "CustomerProfileData"), "400": apiErrorResponse, "401": apiErrorResponse, "403": apiErrorResponse },
      },
    },
    "/customers/profiles/company": {
      get: { tags: ["Customer Profiles"], operationId: "getCompanyProfile", security: [{ bearerAuth: [] }], responses: { "200": successResponse("The owned company profile or explicit not-created state.", "CustomerProfileData"), "401": apiErrorResponse, "403": apiErrorResponse } },
      put: { tags: ["Customer Profiles"], operationId: "putCompanyProfile", security: [{ bearerAuth: [] }], requestBody: jsonRequest("CompanyProfileRequest", "Trimmed non-blank company and representative names."), responses: { "200": successResponse("The owned company profile was saved.", "CustomerProfileData"), "400": apiErrorResponse, "401": apiErrorResponse, "403": apiErrorResponse } },
    },
    "/customers/profiles/engineer": {
      get: { tags: ["Customer Profiles"], operationId: "getEngineerProfile", security: [{ bearerAuth: [] }], responses: { "200": successResponse("The owned engineer profile or explicit not-created state.", "CustomerProfileData"), "401": apiErrorResponse, "403": apiErrorResponse } },
      put: { tags: ["Customer Profiles"], operationId: "putEngineerProfile", security: [{ bearerAuth: [] }], requestBody: jsonRequest("EngineerProfileRequest", "A trimmed non-blank full name and professional title."), responses: { "200": successResponse("The owned engineer profile was saved.", "CustomerProfileData"), "400": apiErrorResponse, "401": apiErrorResponse, "403": apiErrorResponse } },
    },
    "/customers/profile-image": {
      get: {
        tags: ["Customer Profiles"],
        operationId: "getProfileImage",
        summary: "Return authorized signed profile-image URL or explicit absence",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": successResponse(
            "Authorized signed Cloudinary delivery URL and safe metadata.",
            "ProfileImageDeliveryData",
          ),
          "204": { description: "Explicit safe absence when no association exists." },
          "401": apiErrorResponse,
          "403": apiErrorResponse,
        },
      },
      put: {
        tags: ["Customer Profiles"],
        operationId: "putProfileImage",
        summary: "Always-replace identity-wide profile image (Cloudinary)",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file", "expectedAssociationVersion"],
                additionalProperties: false,
                properties: {
                  file: { type: "string", format: "binary" },
                  expectedAssociationVersion: { type: "integer", minimum: 1 },
                },
              },
            },
          },
        },
        responses: {
          "200": successResponse(
            "Canonical customer profile aggregate including new signed profileImage.",
            "CustomerProfileAggregateData",
          ),
          "400": apiErrorResponse,
          "401": apiErrorResponse,
          "403": apiErrorResponse,
          "409": apiErrorResponse,
        },
      },
      delete: {
        tags: ["Customer Profiles"],
        operationId: "deleteProfileImage",
        summary: "Clear association with CAS; prior asset async cleanup",
        security: [{ bearerAuth: [] }],
        requestBody: jsonRequest(
          "ProfileImageDeleteRequest",
          "Required expectedAssociationVersion CAS token.",
        ),
        responses: {
          "200": successResponse(
            "The image association was removed.",
            "ProfileImageRemovalData",
          ),
          "401": apiErrorResponse,
          "403": apiErrorResponse,
          "404": apiErrorResponse,
          "409": apiErrorResponse,
        },
      },
    },
    "/customers/addresses": {
      get: { tags: ["Customer Addresses"], operationId: "listCustomerAddresses", security: [{ bearerAuth: [] }], responses: { "200": successResponse("Owned peer addresses without a default designation.", "AddressListData"), "401": apiErrorResponse, "403": apiErrorResponse } },
      post: { tags: ["Customer Addresses"], operationId: "createCustomerAddress", security: [{ bearerAuth: [] }], requestBody: jsonRequest("AddressWriteRequest", "A complete text address without geospatial attributes."), responses: { "201": successResponse("The owned address was created.", "AddressData"), "400": apiErrorResponse, "401": apiErrorResponse, "403": apiErrorResponse } },
    },
    "/customers/addresses/{addressId}": {
      parameters: [{ name: "addressId", in: "path", required: true, schema: { type: "string" } }],
      get: { tags: ["Customer Addresses"], operationId: "getCustomerAddress", security: [{ bearerAuth: [] }], responses: { "200": successResponse("The owned address was returned.", "AddressData"), "401": apiErrorResponse, "403": apiErrorResponse, "404": apiErrorResponse } },
      put: { tags: ["Customer Addresses"], operationId: "updateCustomerAddress", security: [{ bearerAuth: [] }], requestBody: jsonRequest("AddressUpdateRequest", "A complete replacement address and its current version."), responses: { "200": successResponse("The owned address was updated.", "AddressData"), "400": apiErrorResponse, "401": apiErrorResponse, "403": apiErrorResponse, "404": apiErrorResponse, "409": apiErrorResponse } },
      delete: { tags: ["Customer Addresses"], operationId: "deleteCustomerAddress", security: [{ bearerAuth: [] }], requestBody: jsonRequest("VersionRequest", "The currently accepted address version."), responses: { "200": successResponse("The address was removed from future selection.", "AddressRemovalData"), "401": apiErrorResponse, "403": apiErrorResponse, "404": apiErrorResponse, "409": apiErrorResponse } },
    },
    "/customers/contact-state": {
      get: { tags: ["Customer Preferences"], operationId: "getCustomerContactState", security: [{ bearerAuth: [] }], responses: { "200": successResponse("Authoritative identity contact presence and verification state.", "ContactStateData"), "401": apiErrorResponse, "403": apiErrorResponse } },
    },
    "/customers/preferences": {
      get: { tags: ["Customer Preferences"], operationId: "getCustomerPreferences", security: [{ bearerAuth: [] }], responses: { "200": successResponse("Current or default identity-wide preferences.", "PreferencesData"), "401": apiErrorResponse, "403": apiErrorResponse } },
      put: { tags: ["Customer Preferences"], operationId: "replaceCustomerPreferences", security: [{ bearerAuth: [] }], requestBody: jsonRequest("PreferencesPutRequest", "A complete preference matrix and current version."), responses: { "200": successResponse("The complete preference set was saved.", "PreferencesData"), "400": apiErrorResponse, "401": apiErrorResponse, "403": apiErrorResponse, "409": apiErrorResponse } },
    },
    "/customers/privacy-requests": {
      get: { tags: ["Customer Privacy Requests"], operationId: "listPrivacyRequests", security: [{ bearerAuth: [] }], responses: { "200": successResponse("Owned, unexpired privacy request metadata.", "PrivacyRequestListData"), "401": apiErrorResponse, "403": apiErrorResponse } },
      post: { tags: ["Customer Privacy Requests"], operationId: "submitPrivacyRequest", security: [{ bearerAuth: [] }], requestBody: jsonRequest("PrivacyRequestSubmitRequest", "One deactivation, deletion, or export request. This does not fulfill the request."), responses: { "201": successResponse("The request was submitted or the existing active request was returned.", "PrivacyRequestData"), "400": apiErrorResponse, "401": apiErrorResponse, "403": apiErrorResponse } },
    },
    "/customers/privacy-requests/{privacyRequestId}": {
      parameters: [{ name: "privacyRequestId", in: "path", required: true, schema: { type: "string" } }],
      get: { tags: ["Customer Privacy Requests"], operationId: "getPrivacyRequest", security: [{ bearerAuth: [] }], responses: { "200": successResponse("Owned, unexpired privacy request metadata.", "PrivacyRequestData"), "401": apiErrorResponse, "403": apiErrorResponse, "404": apiErrorResponse } },
    },
    "/customers/privacy-requests/{privacyRequestId}/cancel": {
      parameters: [{ name: "privacyRequestId", in: "path", required: true, schema: { type: "string" } }],
      post: { tags: ["Customer Privacy Requests"], operationId: "cancelPrivacyRequest", security: [{ bearerAuth: [] }], responses: { "200": successResponse("The pending request was cancelled.", "PrivacyRequestData"), "401": apiErrorResponse, "403": apiErrorResponse, "404": apiErrorResponse, "409": apiErrorResponse } },
    },
    "/docs": {
      get: {
        tags: ["API Documentation"],
        operationId: "getSwaggerUi",
        summary: "Open the interactive Swagger UI",
        description:
          "Returns the professional interactive Cleanora API documentation page.",
        responses: {
          "200": {
            description: "Swagger UI HTML document.",
            content: {
              "text/html": {
                schema: { type: "string" },
              },
            },
          },
        },
      },
    },
    "/docs/openapi.json": {
      get: {
        tags: ["API Documentation"],
        operationId: "getOpenApiDocument",
        summary: "Download the OpenAPI document",
        description:
          "Returns the complete machine-readable OpenAPI 3.1 contract used by the interactive documentation.",
        responses: {
          "200": {
            description: "Complete Cleanora OpenAPI document.",
            headers: {
              "Cache-Control": {
                schema: { type: "string", example: "public, max-age=300" },
              },
            },
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Short-lived access JWT returned by login or refresh. Enter the token without the `Bearer` prefix.",
      },
      refreshCookie: {
        type: "apiKey",
        in: "cookie",
        name: "cleanora_refresh_token",
        description:
          "Rotating HttpOnly refresh credential managed automatically by the browser or Postman cookie jar.",
      },
    },
    headers: {
      RequestId: {
        description:
          "Server-normalized UUID used to correlate the response with safe structured logs.",
        schema: { type: "string", format: "uuid" },
      },
      RetryAfter: {
        description:
          "Number of seconds before the current rate-limited action may be retried.",
        schema: { type: "integer", minimum: 1 },
      },
    },
    parameters: {
      ...r1P05Fragments.parameters,
      ...r1P06Fragments.parameters,
    },
    requestBodies: {
      ...r1P05Fragments.requestBodies,
      ...r1P06Fragments.requestBodies,
    },
    responses: {
      ...r1P05Fragments.responses,
      ...r1P06Fragments.responses,
      ApiError: {
        description: "Safe stable API failure.",
        headers: {
          "x-request-id": { $ref: "#/components/headers/RequestId" },
        },
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
          },
        },
      },
      RateLimited: {
        description: "The deterministic request limit was exceeded.",
        headers: {
          "x-request-id": { $ref: "#/components/headers/RequestId" },
          "Retry-After": { $ref: "#/components/headers/RetryAfter" },
        },
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
          },
        },
      },
    },
    schemas: {
      ...r1P05Fragments.schemas,
      ...r1P06Fragments.schemas,
      AccountCategory: {
        type: "string",
        enum: [
          "INDIVIDUAL",
          "COMPANY",
          "ENGINEER",
          "PROVIDER_OWNER",
          "WORKER",
        ],
        description: "Authentication account category.",
      },
      SelfSignupCategory: {
        type: "string",
        enum: ["INDIVIDUAL", "COMPANY", "ENGINEER", "PROVIDER_OWNER"],
        description:
          "Publicly enrollable category. WORKER is intentionally excluded.",
      },
      NextAction: {
        type: "string",
        enum: ["VERIFY_ACCOUNT", "LOGIN", "CONTINUE"],
        description:
          "Stable frontend navigation hint; it is not an authorization decision.",
      },
      SignupRequest: {
        oneOf: [
          { $ref: "#/components/schemas/IndividualSignupRequest" },
          { $ref: "#/components/schemas/CompanySignupRequest" },
          { $ref: "#/components/schemas/EngineerSignupRequest" },
          { $ref: "#/components/schemas/ProviderOwnerSignupRequest" },
        ],
        discriminator: { propertyName: "accountCategory" },
      },
      EnrollCategoryRequest: {
        oneOf: [
          { $ref: "#/components/schemas/IndividualEnrollmentRequest" },
          { $ref: "#/components/schemas/CompanyEnrollmentRequest" },
          { $ref: "#/components/schemas/EngineerEnrollmentRequest" },
          { $ref: "#/components/schemas/ProviderOwnerEnrollmentRequest" },
        ],
        discriminator: { propertyName: "accountCategory" },
      },
      IndividualSignupRequest: {
        type: "object", additionalProperties: false,
        required: ["accountCategory", "fullName", "phone", "email", "password"],
        properties: {
          accountCategory: { type: "string", const: "INDIVIDUAL" },
          fullName: { type: "string", minLength: 1, maxLength: 200 },
          phone: { type: "string", example: "+201234567890" },
          email: { type: "string", format: "email", example: "user@example.com" },
          password: { type: "string", format: "password", writeOnly: true, minLength: 7, maxLength: 128 },
        },
      },
      CompanySignupRequest: {
        type: "object", additionalProperties: false,
        required: ["accountCategory", "companyName", "representativeFullName", "phone", "email", "password"],
        properties: {
          accountCategory: { type: "string", const: "COMPANY" },
          companyName: { type: "string", minLength: 1, maxLength: 200 },
          representativeFullName: { type: "string", minLength: 1, maxLength: 200 },
          phone: { type: "string", example: "+201234567890" },
          email: { type: "string", format: "email", example: "company@example.com" },
          password: { type: "string", format: "password", writeOnly: true, minLength: 7, maxLength: 128 },
        },
      },
      EngineerSignupRequest: {
        type: "object", additionalProperties: false,
        required: ["accountCategory", "fullName", "professionalTitle", "phone", "email", "password"],
        properties: {
          accountCategory: { type: "string", const: "ENGINEER" },
          fullName: { type: "string", minLength: 1, maxLength: 200 },
          professionalTitle: { type: "string", minLength: 1, maxLength: 200 },
          phone: { type: "string", example: "+201234567890" },
          email: { type: "string", format: "email", example: "engineer@example.com" },
          password: { type: "string", format: "password", writeOnly: true, minLength: 7, maxLength: 128 },
        },
      },
      ProviderOwnerSignupRequest: {
        type: "object", additionalProperties: false,
        required: ["accountCategory", "phone", "email", "password"],
        properties: {
          accountCategory: { type: "string", const: "PROVIDER_OWNER" },
          phone: { type: "string", example: "+201234567890" },
          email: { type: "string", format: "email", example: "owner@example.com" },
          password: { type: "string", format: "password", writeOnly: true, minLength: 7, maxLength: 128 },
        },
      },
      IndividualEnrollmentRequest: {
        type: "object", additionalProperties: false, required: ["accountCategory", "fullName"],
        properties: { accountCategory: { type: "string", const: "INDIVIDUAL" }, fullName: { type: "string", minLength: 1, maxLength: 200 } },
      },
      CompanyEnrollmentRequest: {
        type: "object", additionalProperties: false, required: ["accountCategory", "companyName", "representativeFullName"],
        properties: { accountCategory: { type: "string", const: "COMPANY" }, companyName: { type: "string", minLength: 1, maxLength: 200 }, representativeFullName: { type: "string", minLength: 1, maxLength: 200 } },
      },
      EngineerEnrollmentRequest: {
        type: "object", additionalProperties: false, required: ["accountCategory", "fullName", "professionalTitle"],
        properties: { accountCategory: { type: "string", const: "ENGINEER" }, fullName: { type: "string", minLength: 1, maxLength: 200 }, professionalTitle: { type: "string", minLength: 1, maxLength: 200 } },
      },
      ProviderOwnerEnrollmentRequest: {
        type: "object", additionalProperties: false, required: ["accountCategory"],
        properties: { accountCategory: { type: "string", const: "PROVIDER_OWNER" } },
      },
      OtpRequest: {
        type: "object",
        additionalProperties: false,
        properties: {
          challengeId: {
            type: "string",
            format: "uuid",
            description:
              "Preferred opaque selector returned by signup or a prior OTP request.",
          },
          userId: {
            type: "string",
            format: "uuid",
            description:
              "Explicit supported identity selector; not needed for the normal signup resend flow.",
          },
          accountCategory: {
            $ref: "#/components/schemas/SelfSignupCategory",
          },
          purpose: {
            type: "string",
            enum: ["CATEGORY_VERIFICATION"],
          },
        },
        anyOf: [
          { required: ["challengeId"] },
          { required: ["userId", "accountCategory"] },
        ],
        example: {
          challengeId: "9d18ac10-5acd-4ca4-8a75-4ccfced44a56",
        },
      },
      OtpVerifyRequest: {
        type: "object",
        additionalProperties: false,
        required: ["challengeId", "code"],
        properties: {
          challengeId: {
            type: "string",
            format: "uuid",
            description: "Opaque challenge selector returned by the API.",
          },
          code: {
            type: "string",
            pattern: "^[0-9]{6}$",
            writeOnly: true,
            description: "Matching six-digit credential delivered out-of-band.",
            example: "123456",
          },
        },
      },
      LoginRequest: {
        type: "object",
        additionalProperties: false,
        required: ["phone", "password"],
        properties: {
          phone: {
            type: "string",
            example: "+201234567890",
          },
          password: {
            type: "string",
            format: "password",
            writeOnly: true,
            example: "8392741",
          },
        },
      },
      ForgotPasswordRequest: {
        type: "object",
        additionalProperties: false,
        required: ["accountCategory", "identifier"],
        properties: {
          accountCategory: {
            $ref: "#/components/schemas/AccountCategory",
          },
          identifier: {
            type: "string",
            format: "email",
            description:
              "Verified account email for every supported category.",
            example: "user@example.com",
          },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        additionalProperties: false,
        required: ["challengeId", "code", "newPassword"],
        properties: {
          challengeId: {
            type: "string",
            format: "uuid",
            description:
              "Opaque recovery challenge returned by the forgot-password endpoint.",
            example: "9d18ac10-5acd-4ca4-8a75-4ccfced44a56",
          },
          code: {
            type: "string",
            writeOnly: true,
            description:
              "Four-digit single-use reset code received through the authoritative recovery channel.",
            pattern: "^[0-9]{4}$",
            minLength: 4,
            maxLength: 4,
            example: "5486",
          },
          newPassword: {
            type: "string",
            format: "password",
            writeOnly: true,
            minLength: 7,
            maxLength: 128,
            description:
              "Seven or more characters; common, repeated, and sequential values are rejected.",
            example: "4829517",
          },
        },
      },
      ChangePasswordRequest: {
        type: "object",
        additionalProperties: false,
        required: ["currentPassword", "newPassword"],
        properties: {
          currentPassword: {
            type: "string",
            format: "password",
            writeOnly: true,
          },
          newPassword: {
            type: "string",
            format: "password",
            writeOnly: true,
            minLength: 7,
            maxLength: 128,
            description:
              "Seven or more characters; common, repeated, and sequential values are rejected.",
          },
        },
      },
      AuthenticationPrincipal: {
        type: "object",
        additionalProperties: false,
        required: [
          "userId",
          "sessionId",
          "accountCategories",
          "verifiedCategories",
          "pendingCategories",
          "status",
          "verificationOnly",
        ],
        properties: {
          userId: { type: "string", format: "uuid" },
          sessionId: { type: "string", format: "uuid" },
          accountCategories: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountCategory" },
          },
          verifiedCategories: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountCategory" },
          },
          pendingCategories: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountCategory" },
          },
          status: {
            type: "string",
            enum: ["ACTIVE", "SUSPENDED", "BANNED"],
          },
          verificationOnly: { type: "boolean" },
        },
      },
      VerificationChallengeData: {
        type: "object",
        additionalProperties: false,
        required: [
          "accepted",
          "challengeId",
          "nextAction",
          "accountCategory",
          "purpose",
          "channel",
          "maskedDestination",
          "expiresAt",
          "resendAvailableAt",
        ],
        properties: {
          accepted: { type: "boolean", const: true },
          challengeId: { type: "string", format: "uuid" },
          nextAction: {
            type: "string",
            const: "VERIFY_ACCOUNT",
          },
          accountCategory: {
            $ref: "#/components/schemas/SelfSignupCategory",
          },
          purpose: {
            type: "string",
            enum: ["CATEGORY_VERIFICATION", "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION"],
          },
          channel: { type: "string", enum: ["EMAIL"] },
          maskedDestination: { type: "string", example: "u***r@example.com" },
          expiresAt: { type: "string", format: "date-time" },
          resendAvailableAt: { type: "string", format: "date-time" },
        },
      },
      VerificationResultData: {
        type: "object",
        additionalProperties: false,
        required: ["verified", "nextAction"],
        properties: {
          verified: { type: "boolean", const: true },
          nextAction: { type: "string", const: "LOGIN" },
        },
      },
      SessionTokenData: {
        type: "object",
        additionalProperties: false,
        required: [
          "accessToken",
          "accessExpiresAt",
          "verificationOnly",
          "user",
          "identity",
        ],
        properties: {
          accessToken: {
            type: "string",
            writeOnly: true,
            description:
              "Short-lived Bearer token. The refresh credential is not returned here.",
            example: "<access-token>",
          },
          accessExpiresAt: { type: "string", format: "date-time" },
          verificationOnly: { type: "boolean" },
          user: {
            $ref: "#/components/schemas/SafeAuthenticatedUser",
          },
          identity: {
            $ref: "#/components/schemas/AuthenticationPrincipal",
          },
        },
      },
      CurrentIdentityData: {
        type: "object",
        additionalProperties: false,
        required: ["user", "verificationOnly"],
        properties: {
          user: { $ref: "#/components/schemas/SafeAuthenticatedUser" },
          verificationOnly: { type: "boolean" },
        },
      },
      SafeAuthenticatedUser: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "displayName",
          "avatarUrl",
          "email",
          "phone",
          "emailVerified",
          "phoneVerified",
          "status",
          "accountCategories",
          "verifiedCategories",
          "pendingCategories",
        ],
        properties: {
          id: { type: "string" },
          displayName: {
            type: ["string", "null"],
            example: "Aly Oser",
            description:
              "Display name asserted by a linked Google account, otherwise null.",
          },
          avatarUrl: {
            type: ["string", "null"],
            format: "uri",
            example: "https://lh3.googleusercontent.com/a/example",
            description:
              "HTTPS avatar URL asserted by a linked Google account, otherwise null.",
          },
          email: {
            type: ["string", "null"],
            format: "email",
            example: "user@example.com",
          },
          phone: { type: ["string", "null"], example: "+201234567890" },
          emailVerified: { type: "boolean" },
          phoneVerified: { type: "boolean" },
          status: {
            type: "string",
            enum: ["ACTIVE", "SUSPENDED", "BANNED"],
          },
          accountCategories: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountCategory" },
          },
          verifiedCategories: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountCategory" },
          },
          pendingCategories: {
            type: "array",
            items: { $ref: "#/components/schemas/AccountCategory" },
          },
        },
      },
      GoogleAuthorizationData: {
        type: "object",
        additionalProperties: false,
        required: ["authorizationUrl"],
        properties: {
          authorizationUrl: {
            type: "string",
            format: "uri",
            description:
              "One-time provider authorization URL. Do not persist it.",
          },
        },
      },
      PasswordResetData: {
        type: "object",
        additionalProperties: false,
        required: ["passwordReset", "nextAction"],
        properties: {
          passwordReset: { type: "boolean", const: true },
          nextAction: { type: "string", const: "LOGIN" },
        },
      },
      PasswordRecoveryAcceptedData: {
        type: "object",
        additionalProperties: false,
        required: ["accepted", "challengeId"],
        properties: {
          accepted: { type: "boolean", const: true },
          challengeId: {
            type: "string",
            format: "uuid",
            description:
              "Opaque correlation value returned for every valid request, including absent identities.",
            example: "9d18ac10-5acd-4ca4-8a75-4ccfced44a56",
          },
        },
      },
      LogoutData: {
        type: "object",
        additionalProperties: false,
        required: ["loggedOut"],
        properties: {
          loggedOut: { type: "boolean", const: true },
        },
      },
      GoogleUnlinkData: {
        type: "object",
        additionalProperties: false,
        required: ["unlinked"],
        properties: {
          unlinked: { type: "boolean", const: true },
        },
      },
      LivenessData: {
        type: "object",
        additionalProperties: true,
        description: "Process liveness result.",
      },
      ReadinessData: {
        type: "object",
        additionalProperties: true,
        description: "Combined readiness probe result.",
      },
      DatabaseHealthData: {
        type: "object",
        additionalProperties: true,
        description: "Safe database availability result.",
      },
      RoleGrantNonCustomerCode: {
        type: "string",
        enum: [
          "staff_admin",
          "staff_operations",
          "staff_support",
          "staff_finance",
          "provider_member",
          "provider_supervisor",
          "provider_admin",
          "worker",
        ],
        description:
          "Non-customer role codes allowed on the staff-admin command API.",
      },
      RoleGrantOperation: {
        type: "string",
        enum: ["assign", "revoke", "enable", "disable"],
      },
      RoleGrantCommandRequest: {
        type: "object",
        additionalProperties: false,
        required: ["operation", "targetUserId", "roleCode", "reasonCode"],
        properties: {
          operation: { $ref: "#/components/schemas/RoleGrantOperation" },
          targetUserId: {
            type: "string",
            minLength: 1,
            maxLength: 128,
            example: "usr_target_example",
          },
          roleCode: { $ref: "#/components/schemas/RoleGrantNonCustomerCode" },
          reasonCode: {
            type: "string",
            description:
              "Must match the operation: role_grant_assign, role_grant_revoke, role_grant_enable, or role_grant_disable.",
            example: "role_grant_assign",
          },
        },
      },
      RoleGrantCommandData: {
        type: "object",
        additionalProperties: false,
        required: [
          "targetUserId",
          "roleCode",
          "status",
          "mutated",
          "auditAppended",
        ],
        properties: {
          targetUserId: { type: "string", example: "usr_target_example" },
          roleCode: { $ref: "#/components/schemas/RoleGrantNonCustomerCode" },
          status: {
            type: "string",
            enum: ["ENABLED", "DISABLED", "REVOKED"],
          },
          mutated: { type: "boolean" },
          auditAppended: { type: "boolean" },
        },
      },
      OwnerStaffAdminProvisionRequest: {
        type: "object",
        additionalProperties: false,
        required: ["email"],
        properties: {
          email: {
            type: "string",
            format: "email",
            maxLength: 320,
            example: "existing-user@example.com",
          },
        },
      },
      OwnerStaffAdminProvisionData: {
        type: "object",
        additionalProperties: false,
        required: ["outcome", "targetUserId", "roleCode", "grantStatus"],
        properties: {
          outcome: {
            type: "string",
            enum: ["CREATED", "RE_ENABLED", "ALREADY_ENABLED"],
          },
          targetUserId: { type: "string", example: "usr_target_example" },
          roleCode: { type: "string", const: "staff_admin" },
          grantStatus: { type: "string", const: "ENABLED" },
        },
      },
      IndividualProfileRequest: {
        type: "object", additionalProperties: false, required: ["fullName"],
        properties: { fullName: { type: "string", minLength: 1, maxLength: 200 } },
      },
      CompanyProfileRequest: {
        type: "object", additionalProperties: false, required: ["companyName", "representativeFullName", "commercialRegistrationNumber", "taxRegistrationNumber"],
        properties: {
          companyName: { type: "string", minLength: 1, maxLength: 200 },
          representativeFullName: { type: "string", minLength: 1, maxLength: 200 },
          commercialRegistrationNumber: { type: ["string", "null"], minLength: 1, maxLength: 100 },
          taxRegistrationNumber: { type: ["string", "null"], minLength: 1, maxLength: 100 },
        },
      },
      EngineerProfileRequest: {
        type: "object", additionalProperties: false, required: ["fullName", "professionalTitle"],
        properties: {
          fullName: { type: "string", minLength: 1, maxLength: 200 },
          professionalTitle: { type: "string", minLength: 1, maxLength: 200 },
        },
      },
      CustomerProfileData: {
        type: "object", additionalProperties: false, required: ["category", "created"],
        properties: {
          category: { type: "string", enum: ["INDIVIDUAL", "COMPANY", "ENGINEER"] },
          created: { type: "boolean" },
          fullName: { type: "string" },
          companyName: { type: "string" },
          representativeFullName: { type: "string" },
          commercialRegistrationNumber: { type: ["string", "null"] },
          taxRegistrationNumber: { type: ["string", "null"] },
          professionalTitle: { type: "string" },
        },
      },
      ProfileImageDeliveryData: {
        type: "object",
        additionalProperties: false,
        required: ["mediaId", "url", "urlExpiresAt", "associationVersion"],
        description:
          "DEC-033 protected delivery. Never includes storage_key, public_id, folder, or Cloudinary credentials.",
        properties: {
          mediaId: {
            type: "string",
            description: "Opaque internal media identifier; not a Cloudinary public_id",
          },
          url: {
            type: "string",
            format: "uri",
            description: "Authenticated/signed Cloudinary delivery URL; time-limited",
          },
          urlExpiresAt: { type: "string", format: "date-time" },
          associationVersion: { type: "integer", minimum: 1 },
          contentType: { type: "string", example: "image/webp" },
          width: { type: "integer", minimum: 1 },
          height: { type: "integer", minimum: 1 },
        },
      },
      CustomerProfileAggregateData: {
        type: "object",
        additionalProperties: false,
        required: ["profiles", "profileImage"],
        properties: {
          profiles: {
            type: "array",
            items: { $ref: "#/components/schemas/CustomerProfileData" },
          },
          profileImage: {
            oneOf: [
              { $ref: "#/components/schemas/ProfileImageDeliveryData" },
              { type: "null" },
            ],
          },
        },
      },
      ProfileImageDeleteRequest: {
        type: "object",
        additionalProperties: false,
        required: ["expectedAssociationVersion"],
        properties: {
          expectedAssociationVersion: { type: "integer", minimum: 1 },
        },
      },
      ProfileImageRemovalData: {
        type: "object",
        additionalProperties: false,
        required: ["removed", "associationVersion"],
        properties: {
          removed: { type: "boolean", const: true },
          associationVersion: { type: "integer", minimum: 1 },
        },
      },
      AddressWriteRequest: {
        type: "object", additionalProperties: false,
        required: ["countryCode", "city", "district", "addressText"],
        properties: {
          countryCode: { type: "string", minLength: 2, maxLength: 2 },
          city: { type: "string", minLength: 1, maxLength: 200 },
          district: { type: "string", minLength: 1, maxLength: 200 },
          addressText: { type: "string", minLength: 1, maxLength: 200 },
          building: { type: ["string", "null"], maxLength: 200 },
          floor: { type: ["string", "null"], maxLength: 200 },
          notes: { type: ["string", "null"], maxLength: 200 },
        },
      },
      AddressUpdateRequest: {
        allOf: [
          { $ref: "#/components/schemas/AddressWriteRequest" },
          { type: "object", required: ["version"], properties: { version: { type: "integer", minimum: 1 } } },
        ],
      },
      VersionRequest: {
        type: "object", additionalProperties: false, required: ["version"],
        properties: { version: { type: "integer", minimum: 1 } },
      },
      AddressData: {
        type: "object", additionalProperties: false,
        required: ["id", "countryCode", "city", "district", "addressText", "building", "floor", "notes", "version"],
        properties: {
          id: { type: "string" }, countryCode: { type: "string" }, city: { type: "string" },
          district: { type: "string" }, addressText: { type: "string" },
          building: { type: ["string", "null"] }, floor: { type: ["string", "null"] },
          notes: { type: ["string", "null"] }, version: { type: "integer", minimum: 1 },
        },
      },
      AddressListData: { type: "array", items: { $ref: "#/components/schemas/AddressData" } },
      AddressRemovalData: {
        type: "object", additionalProperties: false, required: ["removed"],
        properties: { removed: { type: "boolean", const: true } },
      },
      ContactStateData: {
        type: "object", additionalProperties: false, required: ["phone", "email"],
        properties: {
          phone: { $ref: "#/components/schemas/ContactValue" },
          email: { $ref: "#/components/schemas/ContactValue" },
        },
      },
      ContactValue: {
        type: "object", additionalProperties: false, required: ["value", "verified"],
        properties: { value: { type: ["string", "null"] }, verified: { type: "boolean" } },
      },
      PreferencesPutRequest: {
        type: "object", additionalProperties: false,
        required: ["version", "language", "reminders", "promotional", "mandatory"],
        properties: {
          version: { type: "integer", minimum: 1 },
          language: { type: ["string", "null"], enum: ["AR", "EN", null] },
          reminders: { $ref: "#/components/schemas/PreferenceChannels" },
          promotional: { $ref: "#/components/schemas/PreferenceChannels" },
          mandatory: { $ref: "#/components/schemas/MandatoryNotices" },
        },
      },
      PreferenceChannels: {
        type: "object", additionalProperties: false, required: ["sms", "push"],
        properties: { sms: { type: "boolean" }, push: { type: "boolean" } },
      },
      MandatoryNotices: {
        type: "object", additionalProperties: false, required: ["security", "activeService"],
        properties: {
          security: { type: "object", additionalProperties: false, required: ["sms", "push"], properties: { sms: { const: true }, push: { const: true } } },
          activeService: { type: "object", additionalProperties: false, required: ["sms", "push"], properties: { sms: { const: true }, push: { const: true } } },
        },
      },
      PreferencesData: {
        allOf: [{ $ref: "#/components/schemas/PreferencesPutRequest" }],
      },
      PrivacyRequestSubmitRequest: {
        type: "object", additionalProperties: false, required: ["purpose"],
        properties: { purpose: { type: "string", enum: ["DEACTIVATION", "DELETION", "EXPORT"] } },
      },
      PrivacyRequestData: {
        type: "object", additionalProperties: false,
        required: ["id", "purpose", "status", "requestedAt", "updatedAt", "cancelledAt", "processingAt", "terminalAt", "outcomeCode"],
        properties: {
          id: { type: "string" },
          purpose: { type: "string", enum: ["DEACTIVATION", "DELETION", "EXPORT"] },
          status: { type: "string", enum: ["PENDING", "PROCESSING", "COMPLETED", "REJECTED", "CANCELLED"] },
          requestedAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
          cancelledAt: { type: ["string", "null"], format: "date-time" },
          processingAt: { type: ["string", "null"], format: "date-time" },
          terminalAt: { type: ["string", "null"], format: "date-time" },
          outcomeCode: { type: ["string", "null"], enum: ["REQUEST_FULFILLED", "REQUEST_REJECTED", null] },
        },
      },
      PrivacyRequestListData: { type: "array", items: { $ref: "#/components/schemas/PrivacyRequestData" } },
      SuccessEnvelope: {
        type: "object",
        required: ["success", "data", "requestId"],
        properties: {
          success: { type: "boolean", const: true },
          data: { type: "object" },
          requestId: { type: "string", format: "uuid" },
          meta: {
            type: "object",
            additionalProperties: true,
          },
        },
      },
      ErrorEnvelope: {
        type: "object",
        required: ["success", "error", "requestId"],
        properties: {
          success: { type: "boolean", const: false },
          error: {
            type: "object",
            required: ["code", "statusCode", "message"],
            properties: {
              code: {
                type: "string",
                description: "Stable machine-readable error code.",
                examples: [
                  "REQUEST_VALIDATION_FAILED",
                  "AUTHENTICATION_REQUIRED",
                  "AUTH_PHONE_ALREADY_REGISTERED",
                  "AUTH_EMAIL_ALREADY_REGISTERED",
                  "AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED",
                  "AUTH_VERIFICATION_FAILED",
                  "AUTH_PASSWORD_POLICY_FAILED",
                  "RATE_LIMIT_EXCEEDED",
                ],
              },
              statusCode: {
                type: "integer",
                minimum: 400,
                maximum: 599,
                description:
                  "HTTP status repeated in the JSON contract for clients that centralize API error handling.",
                example: 409,
              },
              message: {
                type: "string",
                description:
                  "Safe descriptive public message suitable for immediate developer diagnosis. Frontends may localize it using code.",
              },
              details: {
                type: "object",
                additionalProperties: true,
                description:
                  "Optional safe field-level or operational details. REQUEST_VALIDATION_FAILED includes every independently detectable invalid field in details.issues as path, code, and message.",
              },
            },
          },
          requestId: { type: "string", format: "uuid" },
        },
      },
    },
  },
} as const;
