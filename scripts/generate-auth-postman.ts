import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Header = { key: string; value: string };

const baseUrl = "{{baseUrl}}";
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

function successBody(data: object): string {
  return JSON.stringify(
    {
      success: true,
      data,
      requestId: "7ebf45ad-7384-41ab-8e74-e864ae048d30",
    },
    null,
    2,
  );
}

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
  const request = {
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
    url: `${baseUrl}${input.route}`,
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
    response:
      input.example === undefined
        ? []
        : [
            {
              name: "Success",
              originalRequest: request,
              status: input.status === 202 ? "Accepted" : "OK",
              code: input.status ?? 200,
              _postman_previewlanguage: "json",
              header: [{ key: "Content-Type", value: "application/json" }],
              cookie: [],
              body: successBody(input.example),
            },
          ],
  };
}

const collection = {
  info: {
    _postman_id: "91076ea2-1262-4ee5-99ab-42a13ecb2ed5",
    name: "Cleanora R1-P02 Authentication",
    description:
      "Canonical R1-P02 Auth API collection. It contains exactly one request per implemented method and route. Error cases such as duplicate signup identifiers, invalid credentials, weak passwords, and invalid OTPs are response examples in Swagger, not fake API requests. Refresh credentials remain in the cookie jar and secrets remain empty in exported environments.",
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
            "Creates an account and stores challengeId. In local development, the Individual phone OTP is emailed to the normalized testEmail; the client cannot override the recipient. Possible 400/409/429/503 responses are documented in Swagger.",
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
            channel: "SMS",
            maskedDestination: "+20******7890",
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
            "Enumeration-safe recovery request. The complete reset credential is delivered out of band and never returned by this API.",
          body: {
            accountCategory: "INDIVIDUAL",
            identifier: "{{testPhone}}",
          },
          status: 202,
          example: { accepted: true },
        }),
        requestItem({
          name: "Reset Password",
          method: "POST",
          route: "/auth/password/reset",
          description:
            "Consumes passwordResetToken in <reset-id>.<random-secret> form. It is not a six-digit OTP.",
          body: {
            token: "{{passwordResetToken}}",
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
          name: "Request Google Phone OTP",
          method: "POST",
          route: "/auth/google/phone/request",
          description:
            "Requires a verification-only Google Bearer session. The temporary phone OTP recipient is derived only from the linked verified Google email; no email field is accepted.",
          body: { phone: "{{testPhone}}" },
          status: 202,
          example: {
            accepted: true,
            challengeId: "<challenge-id>",
            nextAction: "VERIFY_ACCOUNT",
            channel: "SMS",
            maskedDestination: "+20******7890",
          },
        }),
        requestItem({
          name: "Verify Google Phone OTP",
          method: "POST",
          route: "/auth/google/phone/verify",
          description:
            "Verifies the same-user phone challenge and promotes the verification-only session.",
          body: {
            challengeId: "{{challengeId}}",
            code: "{{phoneOtp}}",
          },
          example: {
            verified: true,
            verificationOnly: false,
            nextAction: "CONTINUE",
          },
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

const environment = {
  id: "5f8d65d4-799d-4f07-8c3e-e29c10119e32",
  name: "Cleanora Local",
  values: [
    ["baseUrl", "http://localhost:8000/api/v1", "Local API base path"],
    ["frontendUrl", "http://localhost:5173", "Local frontend origin"],
    ["origin", "http://localhost:5173", "Trusted Origin for cookie mutations"],
    ["testEmail", "", "Test account email"],
    ["testPhone", "", "Test account E.164 phone"],
    ["testPassword", "", "Current test password"],
    ["newPassword", "", "Replacement test password"],
    ["emailOtp", "", "Signup/account six-digit OTP"],
    ["phoneOtp", "", "Google phone six-digit OTP"],
    ["challengeId", "", "Latest opaque verification challenge"],
    ["passwordResetToken", "", "Complete <reset-id>.<random-secret> credential"],
    ["accessToken", "", "Short-lived Bearer access token"],
  ].map(([key, value, description]) => ({
    key,
    value,
    enabled: true,
    ...(key === "baseUrl" || key === "frontendUrl" || key === "origin"
      ? {}
      : { type: "secret" }),
    description,
  })),
  _postman_variable_scope: "environment",
  _postman_exported_using: "Cleanora repository generator",
};

async function main(): Promise<void> {
  await Promise.all([
    writeFile(
      resolve("postman/R1-P02-authentication.postman_collection.json"),
      `${JSON.stringify(collection, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve("postman/Cleanora-local.postman_environment.json"),
      `${JSON.stringify(environment, null, 2)}\n`,
      "utf8",
    ),
  ]);
}

void main();
