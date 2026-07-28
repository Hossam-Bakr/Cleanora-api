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

function jsonRequest(schemaName: string, description: string) {
  return {
    required: true,
    description,
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaName}` },
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
    version: "1.0.0-r1-p02",
    summary: "Cleanora Release 1 foundation and authentication API",
    description: [
      "Professional living documentation for the implemented Cleanora modular-monolith API.",
      "",
      "All JSON endpoints use the same success or failure envelope and include a request correlation ID.",
      "Access tokens are sent as Bearer credentials. Refresh credentials are stored only in an HttpOnly cookie.",
      "Examples use placeholders and never contain usable passwords, tokens, OTPs, provider credentials, or database values.",
      "",
      "R1-P02 is still In Progress. The document describes implemented behavior but does not mark the phase Complete.",
    ].join("\n"),
    contact: {
      name: "Cleanora Engineering",
    },
  },
  servers: [
    {
      url: "http://localhost:8000/api/v1",
      description: "Local development server",
    },
    {
      url: "/api/v1",
      description: "Current host",
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
        "Individual-only Google sign-in, browser callback, mandatory phone verification, deliberate linking, and safe unlinking.",
    },
    {
      name: "API Documentation",
      description:
        "Interactive Swagger UI and the machine-readable OpenAPI document.",
    },
  ],
  paths: {
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
          "Creates an authentication identity for an approved self-signup category and sends the category's blocking verification credential. Worker self-signup is prohibited. In local development, an Individual phone OTP is temporarily emailed to the normalized signup email because SMS is unavailable; the client cannot choose a different recipient and this does not prove phone ownership. The frontend should navigate to its verification screen using the returned opaque challenge.",
        requestBody: jsonRequest(
          "SignupRequest",
          "Category-specific signup identifiers and a policy-compliant password.",
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
          "Adds another supported category to the authenticated identity without creating another user, role, permission, or profile. Existing verified categories remain usable while the new category is pending.",
        security: [{ bearerAuth: [] }],
        requestBody: jsonRequest(
          "EnrollCategoryRequest",
          "The additional self-signup category to enroll.",
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
          "Accepts a recovery request without revealing whether an account exists. Individuals and workers use the registered-phone SMS channel; company, engineer, and provider-owner accounts use verified email. The reset credential is delivered out-of-band and is never returned by this endpoint.",
        requestBody: jsonRequest(
          "ForgotPasswordRequest",
          "Account category and its authoritative recovery identifier.",
        ),
        responses: {
          "202": successResponse(
            "The syntactically valid recovery request was accepted.",
            "AcceptedData",
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
          "Consumes the complete single-use `<reset-id>.<random-secret>` credential delivered out-of-band, applies the password policy, replaces the password, and revokes every session atomically. Reset does not sign the user in; the frontend must navigate to login.",
        requestBody: jsonRequest(
          "ResetPasswordRequest",
          "Complete composite reset credential and the replacement password.",
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
    "/auth/google/phone/request": {
      post: {
        tags: ["Google Identity"],
        operationId: "requestGooglePhoneVerification",
        summary: "Request the mandatory Google phone OTP",
        description:
          "Allows only an authenticated verification-only Google Individual to bind a unique phone and request its blocking SMS verification challenge. While SMS is unavailable, the OTP is emailed to the linked verified Google email resolved server-side; clients cannot choose the recipient.",
        security: [{ bearerAuth: [] }],
        requestBody: jsonRequest(
          "GooglePhoneRequest",
          "Unique phone number to bind to the Google identity.",
        ),
        responses: {
          "202": successResponse(
            "The phone was bound and its verification challenge was created.",
            "VerificationChallengeData",
          ),
          "400": apiErrorResponse,
          "401": apiErrorResponse,
          "403": apiErrorResponse,
          "409": apiErrorResponse,
          "429": rateLimitResponse,
          "503": apiErrorResponse,
        },
      },
    },
    "/auth/google/phone/verify": {
      post: {
        tags: ["Google Identity"],
        operationId: "verifyGooglePhone",
        summary: "Verify the Google identity phone",
        description:
          "Consumes only a same-user Individual/CATEGORY_VERIFICATION/SMS challenge and atomically promotes the exact verification-only session to full access. The existing access token can then call `/auth/me` to obtain updated state.",
        security: [{ bearerAuth: [] }],
        requestBody: jsonRequest(
          "OtpVerifyRequest",
          "Google phone challenge ID and matching six-digit code.",
        ),
        responses: {
          "200": successResponse(
            "The phone was verified and the current session was promoted.",
            "GooglePhoneVerificationData",
          ),
          "400": apiErrorResponse,
          "401": apiErrorResponse,
          "403": apiErrorResponse,
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
    responses: {
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
        type: "object",
        additionalProperties: false,
        required: ["accountCategory", "phone", "password"],
        properties: {
          accountCategory: {
            $ref: "#/components/schemas/SelfSignupCategory",
          },
          phone: {
            type: "string",
            description:
              "International E.164 phone. Spaces, parentheses, and hyphens are normalized by the server.",
            example: "+201234567890",
          },
          email: {
            type: "string",
            format: "email",
            description:
              "Optional for Individual and required for business categories.",
            example: "user@example.com",
          },
          password: {
            type: "string",
            format: "password",
            writeOnly: true,
            minLength: 7,
            maxLength: 128,
            description:
              "Password may contain any characters, including numbers only, but common, repeated, and sequential values are rejected.",
            example: "8392741",
          },
        },
      },
      EnrollCategoryRequest: {
        type: "object",
        additionalProperties: false,
        required: ["accountCategory"],
        properties: {
          accountCategory: {
            $ref: "#/components/schemas/SelfSignupCategory",
          },
        },
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
            enum: [
              "CATEGORY_VERIFICATION",
              "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION",
            ],
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
            description:
              "Registered phone for Individual/Worker, verified email for business categories.",
            example: "+201234567890",
          },
        },
      },
      ResetPasswordRequest: {
        type: "object",
        additionalProperties: false,
        required: ["token", "newPassword"],
        properties: {
          token: {
            type: "string",
            writeOnly: true,
            description:
              "Complete single-use `<reset-id>.<random-secret>` credential received out-of-band.",
            example:
              "9d18ac10-5acd-4ca4-8a75-4ccfced44a56.<random-secret>",
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
      GooglePhoneRequest: {
        type: "object",
        additionalProperties: false,
        required: ["phone"],
        properties: {
          phone: {
            type: "string",
            example: "+201234567890",
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
            enum: [
              "CATEGORY_VERIFICATION",
              "OPTIONAL_INDIVIDUAL_EMAIL_VERIFICATION",
            ],
          },
          channel: { type: "string", enum: ["SMS", "EMAIL"] },
          maskedDestination: { type: "string", example: "+20******7890" },
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
      GooglePhoneVerificationData: {
        type: "object",
        additionalProperties: false,
        required: ["verified", "verificationOnly", "nextAction"],
        properties: {
          verified: { type: "boolean", const: true },
          verificationOnly: { type: "boolean", const: false },
          nextAction: { type: "string", const: "CONTINUE" },
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
      AcceptedData: {
        type: "object",
        additionalProperties: false,
        required: ["accepted"],
        properties: {
          accepted: { type: "boolean", const: true },
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
