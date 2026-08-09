import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createExamples,
  createTargetFolders,
  type PostmanItem,
  type PostmanRequest,
} from "./postman-collection-helpers.js";

type Header = { key: string; value: string };

const hostUrl = "{{hostUrl}}";
const jsonHeader: Header = { key: "Content-Type", value: "application/json" };
const originHeader: Header = { key: "Origin", value: "{{origin}}" };

const safeUser = {
  id: "<user-id>",
  displayName: "Aly Oser",
  avatarUrl: "https://lh3.googleusercontent.com/a/example",
  email: "user@example.test",
  phone: "+201234567890",
  emailVerified: false,
  phoneVerified: true,
  status: "ACTIVE",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
};

const bodyGuidance: Readonly<Record<string, readonly string[]>> = {
  "/auth/signup": [
    "accountCategory: INDIVIDUAL, COMPANY, ENGINEER, or PROVIDER_OWNER.",
    "phone: required E.164 contact value such as +201001234567.",
    "email: required normalized email that receives the verification OTP.",
    "password: use the private testPassword value; never commit a real password.",
  ],
  "/auth/otp/request": [
    "challengeId: opaque ID returned by Signup; do not invent or reuse an expired ID.",
  ],
  "/auth/otp/verify": [
    "challengeId: current signup/category-verification challenge.",
    "code: six-digit OTP received at the account email.",
  ],
  "/auth/login": [
    "phone: normalized E.164 account phone.",
    "password: current private account password.",
  ],
  "/auth/password/forgot": [
    "accountCategory: category whose password credential is being recovered.",
    "identifier: normalized account email; the response remains enumeration-safe.",
  ],
  "/auth/password/reset": [
    "challengeId: opaque ID returned by Forgot Password.",
    "code: four-digit recovery code delivered to the account email.",
    "newPassword: replacement password satisfying the documented password policy.",
  ],
  "/auth/account-categories": [
    "accountCategory: additional eligible category to enroll; WORKER self-enrollment is forbidden.",
  ],
  "/auth/password/change": [
    "currentPassword: current account password.",
    "newPassword: different replacement password satisfying the policy.",
  ],
};

function requestItem(input: {
  name: string;
  method: string;
  route: string;
  description: string;
  body?: object;
  headers?: Header[];
  status?: number;
  example?: object;
  noAuth?: boolean;
  browserOnly?: boolean;
}) {
  const headers = [
    ...(input.body === undefined ? [] : [jsonHeader]),
    ...(input.headers ?? []),
  ];
  const tests = input.browserOnly
    ? [
        "pm.test('Browser navigation endpoint is documented', () => {",
        "  pm.expect(pm.request.url.toString()).to.include('/auth/google/');",
        "});",
      ]
    : [
        "const body = pm.response.json();",
        "pm.test('Uses the Cleanora response envelope', () => {",
        "  pm.expect(body.success).to.eql(true);",
        "  pm.expect(body.requestId).to.be.a('string');",
        "});",
        "if (body.data?.challengeId) pm.environment.set('challengeId', body.data.challengeId);",
        "if (body.data?.accessToken) pm.environment.set('accessToken', body.data.accessToken);",
      ];
  const rawBody =
    input.body === undefined ? undefined : JSON.stringify(input.body, null, 2);
  const request: PostmanRequest = {
    method: input.method,
    ...(input.noAuth === true ? { auth: { type: "noauth" } } : {}),
    header: headers,
    ...(rawBody === undefined
      ? {}
      : {
          body: {
            mode: "raw",
            raw: rawBody,
            options: { raw: { language: "json" } },
          },
        }),
    url: `${hostUrl}${input.route}`,
    description: input.description,
  };
  return {
    name: input.name,
    event: [
      {
        listen: "test",
        script: { type: "text/javascript", exec: tests },
      },
    ],
    request,
    response: createExamples(request, {
      successData: input.example ?? { documentedBrowserFlow: true },
      status: input.browserOnly === true ? 302 : (input.status ?? 200),
      ...(bodyGuidance[input.route] === undefined
        ? {}
        : { bodyComments: bodyGuidance[input.route] }),
      ...(input.browserOnly === true ? { responseBody: "" } : {}),
    }),
  };
}

const collection = {
  info: {
    _postman_id: "91076ea2-1262-4ee5-99ab-42a13ecb2ed5",
    name: "Cleanora R1-P02 Authentication",
    description:
      "Canonical R1-P02 Auth API collection with explicit Hosted and Local folders. Every request includes a saved Success example; requests with bodies also include a commented Sample of correct body. Hosted request names identify email flows blocked while Railway SMTP is unavailable. Refresh credentials remain in the cookie jar and secrets remain empty in exported environments.\n\nLocal Swagger: http://localhost:8000/api/v1/docs\nRailway Swagger: https://cleanora-production.up.railway.app/api/v1/docs",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
  },
  item: [
    {
      name: "Email and Password",
      auth: { type: "noauth" },
      item: [
        requestItem({
          name: "Signup",
          method: "POST",
          route: "/auth/signup",
          description:
            "Creates an account and stores challengeId. Every self-signup category receives its verification code at the required normalized testEmail. Phone verification is deferred to R1-P26. Possible 400/409/429/503 responses are documented in Swagger.",
          body: {
            accountCategory: "INDIVIDUAL",
            phone: "{{testPhone}}",
            email: "{{testEmail}}",
            password: "{{testPassword}}",
          },
          status: 202,
          example: {
            accepted: true,
            challengeId: "<challenge-id>",
            nextAction: "VERIFY_ACCOUNT",
            accountCategory: "INDIVIDUAL",
            purpose: "CATEGORY_VERIFICATION",
            channel: "EMAIL",
            maskedDestination: "t***t@example.com",
            expiresAt: "2026-07-27T12:10:00.000Z",
            resendAvailableAt: "2026-07-27T12:01:00.000Z",
          },
        }),
        requestItem({
          name: "Request OTP",
          method: "POST",
          route: "/auth/otp/request",
          description:
            "Requests/resends the existing challenge. Cooldown applies. Possible invalid, expired, and rate-limit responses are in Swagger.",
          body: { challengeId: "{{challengeId}}" },
          status: 202,
          example: {
            accepted: true,
            challengeId: "<challenge-id>",
            nextAction: "VERIFY_ACCOUNT",
          },
        }),
        requestItem({
          name: "Verify OTP",
          method: "POST",
          route: "/auth/otp/verify",
          description:
            "Consumes the six-digit account verification code. Invalid, expired, used, mismatched, and exhausted challenges share the documented safe error.",
          body: {
            challengeId: "{{challengeId}}",
            code: "{{emailOtp}}",
          },
          example: { verified: true, nextAction: "LOGIN" },
        }),
        requestItem({
          name: "Login",
          method: "POST",
          route: "/auth/login",
          description:
            "Creates a session, stores accessToken, and returns the canonical safe user. The refresh token is only an HttpOnly cookie. Invalid credentials are documented as a 401 response in Swagger.",
          body: {
            phone: "{{testPhone}}",
            password: "{{testPassword}}",
          },
          example: {
            accessToken: "<access-token>",
            accessExpiresAt: "2026-07-27T12:15:00.000Z",
            verificationOnly: false,
            user: safeUser,
            identity: {
              userId: "<user-id>",
              sessionId: "<session-id>",
              accountCategories: ["INDIVIDUAL"],
              verifiedCategories: ["INDIVIDUAL"],
              pendingCategories: [],
              status: "ACTIVE",
              verificationOnly: false,
            },
          },
        }),
        requestItem({
          name: "Forgot Password",
          method: "POST",
          route: "/auth/password/forgot",
          description:
            "Enumeration-safe recovery request. Every valid request returns an opaque challengeId. Existing eligible accounts receive a four-digit code out of band.",
          body: {
            accountCategory: "INDIVIDUAL",
            identifier: "{{testEmail}}",
          },
          status: 202,
          example: {
            accepted: true,
            challengeId: "<reset-challenge-id>",
          },
        }),
        requestItem({
          name: "Reset Password",
          method: "POST",
          route: "/auth/password/reset",
          description:
            "Combines the opaque challengeId returned by forgot-password with the four-digit passwordResetCode delivered to the user.",
          body: {
            challengeId: "{{challengeId}}",
            code: "{{passwordResetCode}}",
            newPassword: "{{newPassword}}",
          },
          example: { passwordReset: true, nextAction: "LOGIN" },
        }),
      ],
    },
    {
      name: "Google Authentication",
      item: [
        requestItem({
          name: "Inspect Google Authorization URL",
          method: "GET",
          route: "/auth/google",
          description:
            "JSON inspection endpoint. For a real Chrome flow use Start Google Browser Sign-In so the same browser owns the correlation cookie.",
          example: { authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?<one-time-query>" },
          noAuth: true,
        }),
        requestItem({
          name: "Start Google Browser Sign-In",
          method: "GET",
          route: "/auth/google/browser",
          description:
            "Open this URL as top-level browser navigation. It redirects to Google and must not be started in Postman then continued in Chrome.",
          noAuth: true,
          browserOnly: true,
        }),
        requestItem({
          name: "Google Callback",
          method: "GET",
          route: "/auth/google/callback",
          description:
            "Provider-owned browser callback. Google supplies state/code. On success the backend writes the refresh cookie and redirects to frontendUrl/auth/google/callback with safe markers only. Do not manually send it in normal Postman testing.",
          noAuth: true,
          browserOnly: true,
        }),
        requestItem({
          name: "Start Google Link",
          method: "GET",
          route: "/auth/google/link",
          description:
            "Creates a deliberate LINK transaction for the current fully verified Individual. Navigate to the returned URL in the same browser.",
          example: { authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?<one-time-query>" },
        }),
        requestItem({
          name: "Unlink Google",
          method: "DELETE",
          route: "/auth/social/google",
          description:
            "Unlinks Google only when another recoverable password credential remains.",
          example: { unlinked: true },
        }),
      ],
    },
    {
      name: "Account and Session",
      item: [
        requestItem({
          name: "Refresh Session",
          method: "POST",
          route: "/auth/refresh",
          description:
            "Uses the HttpOnly refresh cookie in the Postman/browser cookie jar, stores the new accessToken, and returns the canonical safe user. Browser code must use credentials: include.",
          headers: [originHeader],
          example: {
            accessToken: "<access-token>",
            accessExpiresAt: "2026-07-27T12:15:00.000Z",
            verificationOnly: false,
            user: safeUser,
            identity: { userId: "<user-id>", sessionId: "<session-id>" },
          },
          noAuth: true,
        }),
        requestItem({
          name: "Current User",
          method: "GET",
          route: "/auth/me",
          description:
            "Canonical session bootstrap/read endpoint using the Bearer token.",
          example: { user: safeUser, verificationOnly: false },
        }),
        requestItem({
          name: "Enroll Account Category",
          method: "POST",
          route: "/auth/account-categories",
          description:
            "Adds one supported category to the current fully authenticated identity.",
          body: { accountCategory: "COMPANY" },
          status: 202,
          example: {
            accepted: true,
            challengeId: "<challenge-id>",
            nextAction: "VERIFY_ACCOUNT",
          },
        }),
        requestItem({
          name: "Change Password",
          method: "POST",
          route: "/auth/password/change",
          description:
            "Requires Bearer access, the refresh cookie, and trusted Origin. Rotates the current session and returns the same safe user shape.",
          headers: [originHeader],
          body: {
            currentPassword: "{{testPassword}}",
            newPassword: "{{newPassword}}",
          },
          example: {
            accessToken: "<access-token>",
            accessExpiresAt: "2026-07-27T12:15:00.000Z",
            verificationOnly: false,
            user: safeUser,
            identity: { userId: "<user-id>", sessionId: "<session-id>" },
          },
        }),
        requestItem({
          name: "Logout",
          method: "POST",
          route: "/auth/logout",
          description:
            "Revokes the current Bearer/cookie session and clears the refresh cookie.",
          headers: [originHeader],
          example: { loggedOut: true },
        }),
        requestItem({
          name: "Logout All",
          method: "POST",
          route: "/auth/logout-all",
          description: "Revokes every session owned by the current user.",
          example: { loggedOut: true },
        }),
      ],
    },
  ],
};

const exportedCollection = {
  ...collection,
  item: createTargetFolders(collection.item as readonly PostmanItem[], {
    hostedNameOverrides: {
      "POST /auth/signup":
        "Signup (not working: Hosted SMTP unavailable — run locally)",
      "POST /auth/otp/request":
        "Request OTP (not working: Hosted SMTP unavailable — run locally)",
      "POST /auth/otp/verify":
        "Verify OTP (requires an OTP from the local email flow)",
      "POST /auth/password/forgot":
        "Forgot Password (not working: Hosted SMTP unavailable — run locally)",
      "POST /auth/password/reset":
        "Reset Password (requires a recovery code from the local email flow)",
    },
  }),
};

const secretEnvironmentValues = [
  ["testEmail", "", "Test account email; provide only in your private workspace"],
  ["testPhone", "", "Test account phone in E.164 format"],
  ["testPassword", "", "Current test password"],
  ["newPassword", "", "Replacement test password"],
  ["emailOtp", "", "Signup/account six-digit OTP; never export a real value"],
  ["challengeId", "", "Latest opaque verification challenge; captured automatically"],
  [
    "passwordResetCode",
    "",
    "Four-digit password-reset code received through the recovery channel",
  ],
  ["accessToken", "", "Short-lived Bearer access token; captured automatically"],
] as const;

const customerEnvironmentValues = [
  ["individualFullName", "Cleanora Individual", "Sample Individual profile name"],
  ["companyName", "Cleanora Services", "Sample Company profile name"],
  ["representativeFullName", "Cleanora Representative", "Sample Company representative"],
  ["engineerFullName", "Cleanora Engineer", "Sample Engineer profile name"],
  ["professionalTitle", "Cleaning Engineer", "Sample Engineer title"],
  ["profileImagePath", "", "Local JPEG/PNG/WebP path selected privately in Postman"],
  ["profileImageAssociationVersion", "1", "Current profile-image association CAS version"],
  ["countryCode", "EG", "Active ISO alpha-2 country code"],
  ["city", "Cairo", "Sample address city"],
  ["district", "Nasr City", "Sample address district"],
  ["addressText", "Example Street", "Sample text address"],
  ["building", "10", "Optional building value"],
  ["floor", "2", "Optional floor value"],
  ["addressNotes", "", "Optional address notes"],
  ["addressId", "", "Created address ID; captured automatically"],
  ["addressVersion", "1", "Current address CAS version; captured automatically"],
  ["preferencesVersion", "1", "Current preference CAS version; captured automatically"],
  ["privacyPurpose", "EXPORT", "DEACTIVATION, DELETION, or EXPORT"],
  ["privacyRequestId", "", "Submitted privacy request ID; captured automatically"],
] as const;

function createEnvironment(input: {
  id: string;
  name: string;
  hostUrl: string;
  swaggerUrl: string;
}) {
  return {
    id: input.id,
    name: input.name,
    values: [
      {
        key: "hostUrl",
        value: input.hostUrl,
        enabled: true,
        description:
          "Selected Cleanora API root. Every collection request resolves from this variable.",
      },
      {
        key: "hostedUrl",
        value: "https://cleanora-production.up.railway.app/api/v1",
        enabled: true,
        description: "Fixed API root used by every Hosted folder.",
      },
      {
        key: "localUrl",
        value: "http://localhost:8000/api/v1",
        enabled: true,
        description: "Fixed API root used by every Local folder.",
      },
      {
        key: "swaggerUrl",
        value: input.swaggerUrl,
        enabled: true,
        description: "Interactive Swagger documentation for the selected API.",
      },
      {
        key: "frontendUrl",
        value: "http://localhost:5173",
        enabled: true,
        description: "Frontend callback origin used by local browser flows.",
      },
      {
        key: "origin",
        value: "http://localhost:5173",
        enabled: true,
        description:
          "Trusted Origin header for cookie-mutating requests; must be allowed by the backend.",
      },
      ...secretEnvironmentValues.map(([key, value, description]) => ({
        key,
        value,
        enabled: true,
        type: "secret",
        description,
      })),
      ...customerEnvironmentValues.map(([key, value, description]) => ({
        key,
        value,
        enabled: true,
        description,
      })),
    ],
    _postman_variable_scope: "environment",
    _postman_exported_using: "Cleanora repository generator",
  };
}

const localEnvironment = createEnvironment({
  id: "5f8d65d4-799d-4f07-8c3e-e29c10119e32",
  name: "Cleanora — Local Development",
  hostUrl: "http://localhost:8000/api/v1",
  swaggerUrl: "http://localhost:8000/api/v1/docs",
});

const railwayEnvironment = createEnvironment({
  id: "9cc3e75d-b038-4568-8aa7-ebc5a4e41f40",
  name: "Cleanora — Railway Hosted API",
  hostUrl: "https://cleanora-production.up.railway.app/api/v1",
  swaggerUrl: "https://cleanora-production.up.railway.app/api/v1/docs",
});

async function main(): Promise<void> {
  await Promise.all([
    writeFile(
      resolve("postman/R1-P02-authentication.postman_collection.json"),
      `${JSON.stringify(exportedCollection, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve("postman/Cleanora-local.postman_environment.json"),
      `${JSON.stringify(localEnvironment, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve("postman/Cleanora-railway.postman_environment.json"),
      `${JSON.stringify(railwayEnvironment, null, 2)}\n`,
      "utf8",
    ),
  ]);
}

void main();
