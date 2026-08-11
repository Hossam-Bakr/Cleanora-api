/**
 * @desc Generate the R1-P05 Provider Postman collection from the frozen contract surface.
 * @access Maintainer tooling
 * @explanation Keeps Postman examples synchronized with the 35-path / 41-operation
 *   OpenAPI contract without embedding credentials, raw invitation tokens, or
 *   private contact values.
 */
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type Header = { key: string; value: string };

interface RequestItemInput {
  readonly name: string;
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly route: string;
  readonly description: string;
  readonly expectedStatuses?: readonly number[];
  readonly rawBody?: string;
  readonly auth?: "bearer" | "none";
}

const hostUrl = "{{hostUrl}}";
const acceptHeader: Header = { key: "Accept", value: "application/json" };
const jsonHeader: Header = { key: "Content-Type", value: "application/json" };

function requestItem(input: RequestItemInput) {
  const expectedStatuses = input.expectedStatuses ?? [200];
  const hasJsonBody = input.rawBody !== undefined;
  const request = {
    method: input.method,
    header: [acceptHeader, ...(hasJsonBody ? [jsonHeader] : [])],
    ...(input.rawBody === undefined
      ? {}
      : {
          body: {
            mode: "raw",
            raw: input.rawBody,
            options: { raw: { language: "json" } },
          },
        }),
    url: `${hostUrl}${input.route}`,
    description: input.description,
  };

  const tests = [
    `pm.test("Expected HTTP status", () => pm.expect(${JSON.stringify(expectedStatuses)}).to.include(pm.response.code));`,
    "if (pm.response.code !== 204) {",
    "  const body = pm.response.json();",
    "  pm.test(\"Uses the Cleanora response envelope\", () => {",
    "    const succeeded = pm.response.code >= 200 && pm.response.code < 300;",
    "    pm.expect(body.success).to.eql(succeeded);",
    "    pm.expect(body.requestId).to.be.a(\"string\");",
    "    if (!succeeded) { pm.expect(body.error.statusCode).to.eql(pm.response.code); }",
    "  });",
    "}",
  ];

  return {
    name: input.name,
    event: [
      {
        listen: "test",
        script: { type: "text/javascript", exec: tests },
      },
    ],
    request,
    response: [],
  };
}

const versionBody = '{\n  "expectedVersion": 1\n}';
const reasonBody =
  '{\n  "expectedVersion": 1,\n  "reason": "Staff review reason"\n}';
const invitationTokenBody =
  '{\n  "token": "{{providerAdminInvitationToken}}"\n}';

const collection = {
  info: {
    _postman_id: "c5e0a105-p05a-4b1d-9f2e-provider-onboarding",
    name: "Cleanora R1-P05 Provider Onboarding Profile Lifecycle",
    description:
      "Executable R1-P05 provider onboarding collection. Authenticate first so accessToken is available. Invitation flows use body-only tokens via providerAdminInvitationToken. Never paste raw SMTP credentials, Cloudinary secrets, OTPs, or private operational contacts into examples.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
  },
  variable: [
    "providerId",
    "galleryItemId",
    "invitationId",
    "userId",
    "providerAdminInvitationToken",
  ].map((key) => ({ key, value: "", type: "string" })),
  item: [
    {
      name: "Application",
      item: [
        requestItem({
          name: "Create Provider Application",
          method: "POST",
          route: "/providers",
          description: "Create the single draft Provider application.",
          expectedStatuses: [201],
          rawBody: '{\n  "providerKind": "INDIVIDUAL_TEAM"\n}',
        }),
        requestItem({
          name: "List Own Providers",
          method: "GET",
          route: "/providers",
          description: "List Providers visible to the authenticated actor.",
        }),
        requestItem({
          name: "Get Provider",
          method: "GET",
          route: "/providers/{{providerId}}",
          description: "Retrieve one Provider aggregate the actor may access.",
        }),
        requestItem({
          name: "Change Never-Submitted Kind",
          method: "PATCH",
          route: "/providers/{{providerId}}/kind",
          description: "Change kind only while never submitted.",
          rawBody:
            '{\n  "providerKind": "REGISTERED_COMPANY",\n  "expectedVersion": 1\n}',
        }),
        requestItem({
          name: "Submit Application",
          method: "POST",
          route: "/providers/{{providerId}}/application/submit",
          description: "Submit or resubmit when every R1-P05 blocker is clear.",
          rawBody: versionBody,
        }),
      ],
    },
    {
      name: "Profile and Contacts",
      item: [
        requestItem({
          name: "Get Profile",
          method: "GET",
          route: "/providers/{{providerId}}/profile",
          description: "Read the editable bilingual profile.",
        }),
        requestItem({
          name: "Replace Profile",
          method: "PUT",
          route: "/providers/{{providerId}}/profile",
          description: "Full-replace bilingual profile fields.",
          rawBody:
            '{\n  "expectedVersion": 1,\n  "displayNameAr": "اسم العرض",\n  "displayNameEn": "Display Name",\n  "descriptionAr": "وصف عربي",\n  "descriptionEn": "English description",\n  "countryCode": "{{countryCode}}"\n}',
        }),
        requestItem({
          name: "Get Contacts",
          method: "GET",
          route: "/providers/{{providerId}}/contacts",
          description: "Read private operational contacts.",
        }),
        requestItem({
          name: "Replace Contacts",
          method: "PUT",
          route: "/providers/{{providerId}}/contacts",
          description: "Full-replace private operational contacts.",
          rawBody:
            '{\n  "expectedVersion": 1,\n  "operationalEmail": "ops@example.com",\n  "operationalPhone": "+201000000000",\n  "channels": []\n}',
        }),
        requestItem({
          name: "Protected Preview",
          method: "GET",
          route: "/providers/{{providerId}}/preview",
          description: "Contact-free protected preview.",
        }),
      ],
    },
    {
      name: "Media",
      item: [
        requestItem({
          name: "List Media",
          method: "GET",
          route: "/providers/{{providerId}}/media",
          description: "List logo, cover, and gallery references.",
        }),
        requestItem({
          name: "Replace Logo",
          method: "PUT",
          route: "/providers/{{providerId}}/media/logo",
          description: "Multipart logo upload (file field).",
          expectedStatuses: [200, 201],
        }),
        requestItem({
          name: "Replace Cover",
          method: "PUT",
          route: "/providers/{{providerId}}/media/cover",
          description: "Multipart cover upload (file field).",
          expectedStatuses: [200, 201],
        }),
        requestItem({
          name: "Add Gallery Image",
          method: "POST",
          route: "/providers/{{providerId}}/media/gallery-images",
          description: "Multipart gallery image upload.",
          expectedStatuses: [201],
        }),
        requestItem({
          name: "Add Gallery Video",
          method: "POST",
          route: "/providers/{{providerId}}/media/gallery-videos",
          description: "Multipart gallery video upload.",
          expectedStatuses: [201],
        }),
        requestItem({
          name: "Reorder Gallery",
          method: "PUT",
          route: "/providers/{{providerId}}/media/gallery-order",
          description: "Replace gallery order.",
          rawBody:
            '{\n  "expectedVersion": 1,\n  "orderedGalleryItemIds": ["{{galleryItemId}}"]\n}',
        }),
        requestItem({
          name: "Delete Logo",
          method: "DELETE",
          route: "/providers/{{providerId}}/media/logo",
          description: "Clear the logo slot.",
          rawBody: versionBody,
        }),
        requestItem({
          name: "Delete Cover",
          method: "DELETE",
          route: "/providers/{{providerId}}/media/cover",
          description: "Clear the cover slot.",
          rawBody: versionBody,
        }),
        requestItem({
          name: "Delete Gallery Item",
          method: "DELETE",
          route: "/providers/{{providerId}}/media/gallery/{{galleryItemId}}",
          description: "Remove one gallery item.",
          rawBody: versionBody,
        }),
      ],
    },
    {
      name: "Projections",
      item: [
        requestItem({
          name: "Get Completion",
          method: "GET",
          route: "/providers/{{providerId}}/completion",
          description: "Derived profile completion for policy r1-p05-v1.",
        }),
        requestItem({
          name: "Get Readiness",
          method: "GET",
          route: "/providers/{{providerId}}/readiness",
          description: "Eleven-gate marketplace readiness projection.",
        }),
        requestItem({
          name: "Get History",
          method: "GET",
          route: "/providers/{{providerId}}/history",
          description: "Append-only application and operational history.",
        }),
        requestItem({
          name: "Get Dashboard",
          method: "GET",
          route: "/providers/{{providerId}}/dashboard",
          description: "Bounded dashboard aggregate and next action.",
        }),
        requestItem({
          name: "Get Settings",
          method: "GET",
          route: "/providers/{{providerId}}/settings",
          description: "Capability-only settings projection.",
        }),
      ],
    },
    {
      name: "Members and Invitations",
      item: [
        requestItem({
          name: "List Members",
          method: "GET",
          route: "/providers/{{providerId}}/members",
          description: "List OWNER and ADMIN memberships.",
        }),
        requestItem({
          name: "Disable Admin Member",
          method: "DELETE",
          route: "/providers/{{providerId}}/members/{{userId}}",
          description: "Soft-disable an ADMIN membership.",
          rawBody: versionBody,
        }),
        requestItem({
          name: "List Admin Invitations",
          method: "GET",
          route: "/providers/{{providerId}}/admin-invitations",
          description: "List invitation lifecycle rows.",
        }),
        requestItem({
          name: "Create Admin Invitation",
          method: "POST",
          route: "/providers/{{providerId}}/admin-invitations",
          description: "Invite an ADMIN by normalized email.",
          expectedStatuses: [201],
          rawBody: '{\n  "email": "admin.invitee@example.com"\n}',
        }),
        requestItem({
          name: "Resend Admin Invitation",
          method: "POST",
          route: "/providers/{{providerId}}/admin-invitations/{{invitationId}}/resend",
          description: "Rotate verifier and resend once from memory.",
          rawBody: versionBody,
        }),
        requestItem({
          name: "Revoke Admin Invitation",
          method: "POST",
          route: "/providers/{{providerId}}/admin-invitations/{{invitationId}}/revoke",
          description: "Revoke a pending invitation.",
          rawBody: versionBody,
        }),
      ],
    },
    {
      name: "Invitation Token Flows",
      item: [
        requestItem({
          name: "Inspect Invitation",
          method: "POST",
          route: "/provider-admin-invitations/inspect",
          description: "Inspect a body-supplied invitation token.",
          auth: "none",
          rawBody: invitationTokenBody,
        }),
        requestItem({
          name: "Start Invitation Onboarding",
          method: "POST",
          route: "/provider-admin-invitations/onboarding/start",
          description: "Create categoryless invitee identity.",
          auth: "none",
          expectedStatuses: [201],
          rawBody:
            '{\n  "token": "{{providerAdminInvitationToken}}",\n  "phone": "+201111111111",\n  "password": "{{testPassword}}"\n}',
        }),
        requestItem({
          name: "Verify Invitation Email",
          method: "POST",
          route: "/provider-admin-invitations/onboarding/verify-email",
          description: "Consume invitation email OTP.",
          auth: "none",
          rawBody:
            '{\n  "token": "{{providerAdminInvitationToken}}",\n  "challengeId": "{{challengeId}}",\n  "code": "{{emailOtp}}"\n}',
        }),
        requestItem({
          name: "Accept Invitation",
          method: "POST",
          route: "/provider-admin-invitations/accept",
          description: "Atomically accept and create ADMIN membership.",
          rawBody: invitationTokenBody,
        }),
      ],
    },
    {
      name: "Staff Review and Lifecycle",
      item: [
        requestItem({
          name: "List Applications Queue",
          method: "GET",
          route: "/staff/providers/applications",
          description: "Deterministic Staff review queue.",
        }),
        requestItem({
          name: "Get Application Dossier",
          method: "GET",
          route: "/staff/providers/applications/{{providerId}}",
          description: "Private Staff dossier for one application.",
        }),
        requestItem({
          name: "Approve Application",
          method: "POST",
          route: "/staff/providers/applications/{{providerId}}/approve",
          description: "Atomic approval leaving INACTIVE operational status.",
          rawBody: versionBody,
        }),
        requestItem({
          name: "Request Changes",
          method: "POST",
          route: "/staff/providers/applications/{{providerId}}/request-changes",
          description: "Return editable CHANGES_REQUESTED with reason.",
          rawBody: reasonBody,
        }),
        requestItem({
          name: "Reject Application",
          method: "POST",
          route: "/staff/providers/applications/{{providerId}}/reject",
          description: "Terminal rejection with reason.",
          rawBody: reasonBody,
        }),
        requestItem({
          name: "Suspend Provider",
          method: "POST",
          route: "/staff/providers/{{providerId}}/suspend",
          description: "Suspend an approved Provider.",
          rawBody: reasonBody,
        }),
        requestItem({
          name: "Reinstate Provider",
          method: "POST",
          route: "/staff/providers/{{providerId}}/reinstate",
          description: "Reinstate to INACTIVE, never LIVE.",
          rawBody: reasonBody,
        }),
      ],
    },
  ],
};

async function main(): Promise<void> {
  const outputPath = resolve(
    "postman/Cleanora-R1-P05.postman_collection.json",
  );
  await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify({ ok: true, outputPath: "postman/Cleanora-R1-P05.postman_collection.json" })}\n`,
  );
}

void main();
