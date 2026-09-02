/**
 * @desc Generate the documented R1-P05 Provider Postman collection.
 * @access Maintainer tooling
 * @explanation Produces identical Local and Hosted request trees from one
 *   operation definition, keeps request bodies executable, and embeds the
 *   repository Markdown guide in the Postman collection Overview.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Header = { key: string; value: string };
type CaptureVariable =
  | "providerId"
  | "galleryItemId"
  | "invitationId"
  | "challengeId";

interface RawBody {
  readonly kind: "json";
  readonly value: string;
}

interface FormDataBody {
  readonly kind: "formdata";
  readonly fileVariable: string;
}

interface RequestItemInput {
  readonly name: string;
  readonly method: HttpMethod;
  readonly route: string;
  readonly description: string;
  readonly expectedStatuses?: readonly number[];
  readonly body?: RawBody | FormDataBody;
  readonly auth?: "bearer" | "none";
  readonly capture?: CaptureVariable;
}

interface OperationFolder {
  readonly name: string;
  readonly description: string;
  readonly item: ReturnType<typeof requestItem>[];
}

interface SuccessExample {
  readonly code: number;
  readonly data: unknown;
  readonly meta?: { readonly nextCursor: string | null };
}

const acceptHeader: Header = { key: "Accept", value: "application/json" };
const jsonHeader: Header = {
  key: "Content-Type",
  value: "application/json",
};

const exampleTimestamp = "2026-08-13T10:00:00.000Z";
const exampleProvider = {
  id: "provider_example_01",
  providerKind: "INDIVIDUAL_TEAM",
  applicationStatus: "DRAFT",
  operationalStatus: "INACTIVE",
  version: 1,
  createdAt: exampleTimestamp,
  updatedAt: exampleTimestamp,
};
const exampleProfile = {
  providerId: "provider_example_01",
  displayNameAr: "فريق كلينورا للنظافة",
  displayNameEn: "Cleanora Cleaning Team",
  descriptionAr: "فريق متخصص في تنظيف المنازل والشقق باحترافية وجودة عالية.",
  descriptionEn:
    "A professional team specializing in high-quality home and apartment cleaning.",
  countryCode: "EG",
  version: 2,
};
const exampleContacts = {
  providerId: "provider_example_01",
  operationalEmail: "provider.ops@example.com",
  operationalPhone: "+201000000000",
  channels: [
    { type: "WHATSAPP", value: "+201000000000" },
    { type: "WEBSITE", value: "https://example.com/cleanora-provider" },
  ],
  version: 3,
};
const exampleCompletion = {
  policyVersion: "r1-p05-v1",
  percentage: 100,
  checks: [
    "ELIGIBLE_CATEGORY_VERIFIED",
    "MATCHING_CUSTOMER_PROFILE_COMPLETE",
    "ARABIC_DISPLAY_NAME",
    "ARABIC_DESCRIPTION",
    "OPERATIONAL_EMAIL",
    "OPERATIONAL_PHONE",
    "ACTIVE_COUNTRY",
    "READY_LOGO",
    "READY_COVER",
    "MIN_READY_GALLERY_IMAGES",
  ].map((code) => ({ code, satisfied: true })),
  missingRequirementCodes: [],
};
const exampleReadiness = {
  gates: [
    { key: "profileComplete", status: "SATISFIED", satisfied: true, owningPhase: "R1-P05" },
    { key: "applicationApproved", status: "SATISFIED", satisfied: true, owningPhase: "R1-P05" },
    { key: "documentsVerified", status: "NOT_REQUIRED", satisfied: true, owningPhase: "R1-P05" },
    { key: "payoutDestinationReady", status: "NOT_STARTED", satisfied: false, owningPhase: "R1-P06" },
    { key: "workersReady", status: "NOT_STARTED", satisfied: false, owningPhase: "R1-P07" },
    { key: "servicesReady", status: "NOT_STARTED", satisfied: false, owningPhase: "R1-P09" },
    { key: "coverageReady", status: "NOT_STARTED", satisfied: false, owningPhase: "R1-P10" },
    { key: "availabilityReady", status: "NOT_STARTED", satisfied: false, owningPhase: "R1-P10" },
    { key: "capacityReady", status: "NOT_STARTED", satisfied: false, owningPhase: "R1-P10" },
    { key: "operationalLive", status: "BLOCKED", satisfied: false, owningPhase: "R1-P05" },
    { key: "eligibleForPublicBrowse", status: "BLOCKED", satisfied: false, owningPhase: "R1-P12" },
  ],
  eligibleForPublicBrowse: false,
};
const exampleMedia = {
  providerId: "provider_example_01",
  logo: {
    id: "media_logo_01",
    type: "LOGO",
    status: "READY",
    url: "https://res.cloudinary.com/example/image/upload/provider-logo.webp",
  },
  cover: {
    id: "media_cover_01",
    type: "COVER",
    status: "READY",
    url: "https://res.cloudinary.com/example/image/upload/provider-cover.webp",
  },
  gallery: [
    {
      id: "gallery_image_01",
      type: "GALLERY_IMAGE",
      status: "READY",
      position: 1,
      url: "https://res.cloudinary.com/example/image/upload/gallery-01.webp",
    },
  ],
  version: 6,
};
const exampleInvitation = {
  id: "invitation_example_01",
  providerId: "provider_example_01",
  email: "provider.admin@example.com",
  status: "PENDING",
  expiresAt: "2026-08-20T10:00:00.000Z",
  createdAt: exampleTimestamp,
};

const successExamples: Record<string, SuccessExample> = {
  "Create Provider Application": { code: 201, data: exampleProvider },
  "List Own Providers": {
    code: 200,
    data: [exampleProvider],
    meta: { nextCursor: null },
  },
  "Get Provider": {
    code: 200,
    data: {
      ...exampleProvider,
      profile: exampleProfile,
      completion: { ...exampleCompletion, percentage: 40 },
      readiness: exampleReadiness,
    },
  },
  "Change Never-Submitted Kind": {
    code: 200,
    data: { ...exampleProvider, providerKind: "REGISTERED_COMPANY", version: 2 },
  },
  "Submit Application": {
    code: 200,
    data: { ...exampleProvider, applicationStatus: "PENDING_REVIEW", version: 9 },
  },
  "Get Profile": { code: 200, data: exampleProfile },
  "Replace Profile": { code: 200, data: exampleProfile },
  "Get Private Contacts": { code: 200, data: exampleContacts },
  "Replace Private Contacts": { code: 200, data: exampleContacts },
  "Protected Contact-Free Preview": {
    code: 200,
    data: {
      providerId: "provider_example_01",
      providerKind: "INDIVIDUAL_TEAM",
      displayNameAr: "فريق كلينورا للنظافة",
      displayNameEn: "Cleanora Cleaning Team",
      descriptionAr: "فريق متخصص في تنظيف المنازل والشقق.",
      countryCode: "EG",
      logo: exampleMedia.logo,
      cover: exampleMedia.cover,
      gallery: exampleMedia.gallery,
    },
  },
  "List Media": { code: 200, data: exampleMedia },
  "Replace Logo": { code: 200, data: exampleMedia },
  "Replace Cover": { code: 200, data: { ...exampleMedia, version: 7 } },
  "Add Gallery Image": {
    code: 201,
    data: { ...exampleMedia, id: "gallery_image_01", galleryItemId: "gallery_image_01", version: 8 },
  },
  "Add Gallery Video": {
    code: 201,
    data: {
      ...exampleMedia,
      id: "gallery_video_01",
      galleryItemId: "gallery_video_01",
      gallery: [
        ...exampleMedia.gallery,
        { id: "gallery_video_01", type: "GALLERY_VIDEO", status: "PROCESSING", position: 2 },
      ],
      version: 9,
    },
  },
  "Reorder Gallery": { code: 200, data: { ...exampleMedia, version: 10 } },
  "Delete Logo": { code: 200, data: { ...exampleMedia, logo: null, version: 11 } },
  "Delete Cover": { code: 200, data: { ...exampleMedia, cover: null, version: 11 } },
  "Delete Gallery Item": { code: 200, data: { ...exampleMedia, gallery: [], version: 11 } },
  "Get Completion": { code: 200, data: exampleCompletion },
  "Get Readiness": { code: 200, data: exampleReadiness },
  "Get History": {
    code: 200,
    data: [
      {
        id: "history_example_01",
        eventType: "APPLICATION_SUBMITTED",
        occurredAt: exampleTimestamp,
        actorType: "APPLICATION_OWNER",
      },
    ],
    meta: { nextCursor: null },
  },
  "Get Dashboard": {
    code: 200,
    data: {
      provider: { ...exampleProvider, applicationStatus: "APPROVED" },
      completion: exampleCompletion,
      readiness: exampleReadiness,
      nextAction: {
        code: "COMPLETE_LATER_READINESS_GATES",
        label: "Complete the remaining marketplace readiness steps",
      },
    },
  },
  "Get Settings": {
    code: 200,
    data: {
      providerId: "provider_example_01",
      capabilities: {
        canEditProfile: true,
        canEditContacts: true,
        canManageMedia: true,
        canManageAdmins: true,
        canSubmitApplication: true,
      },
    },
  },
  "List Members": {
    code: 200,
    data: [
      {
        userId: "user_owner_01",
        role: "OWNER",
        enabled: true,
        joinedAt: exampleTimestamp,
      },
    ],
  },
  "Disable Admin Member": {
    code: 200,
    data: {
      member: { userId: "user_admin_01", role: "ADMIN", enabled: false },
    },
  },
  "List Admin Invitations": {
    code: 200,
    data: [exampleInvitation],
    meta: { nextCursor: null },
  },
  "Create Admin Invitation": {
    code: 202,
    data: {
      invitation: exampleInvitation,
      deliveryAccepted: true,
      version: 12,
    },
  },
  "Resend Admin Invitation": {
    code: 202,
    data: {
      invitation: { ...exampleInvitation, updatedAt: exampleTimestamp },
      deliveryAccepted: true,
      version: 13,
    },
  },
  "Revoke Admin Invitation": {
    code: 200,
    data: { invitation: { ...exampleInvitation, status: "REVOKED" }, version: 13 },
  },
  "Inspect Invitation": {
    code: 200,
    data: {
      providerId: "provider_example_01",
      providerDisplayName: "Cleanora Cleaning Team",
      invitedEmailMasked: "pr********@example.com",
      expiresAt: "2026-08-20T10:00:00.000Z",
      nextAction: "START_ONBOARDING",
    },
  },
  "Start Invitation Onboarding": {
    code: 202,
    data: {
      challengeId: "challenge_example_01",
      channel: "EMAIL",
      maskedDestination: "pr********@example.com",
      expiresAt: "2026-08-13T10:10:00.000Z",
      nextAction: "VERIFY_EMAIL",
    },
  },
  "Verify Invitation Email": {
    code: 200,
    data: {
      userId: "user_invited_admin_01",
      emailNormalized: "provider.admin@example.com",
      capability: "PROVIDER_ADMIN_INVITATION_ONBOARDING",
      allowedActions: ["ACCEPT_PROVIDER_ADMIN_INVITATION"],
      accessToken: "<access-token>",
      accessExpiresAt: "2026-08-13T10:15:00.000Z",
      refreshToken: "<refresh-token-set-in-secure-client-storage>",
      refreshExpiresAt: "2026-09-12T10:00:00.000Z",
    },
  },
  "Accept Invitation": {
    code: 200,
    data: {
      providerId: "provider_example_01",
      membership: { userId: "user_invited_admin_01", role: "ADMIN", enabled: true },
      invitationStatus: "ACCEPTED",
      version: 14,
    },
  },
  "List Applications Queue": {
    code: 200,
    data: [
      {
        ...exampleProvider,
        applicationStatus: "PENDING_REVIEW",
        submittedAt: exampleTimestamp,
        completionPercentage: 100,
      },
    ],
    meta: { nextCursor: null },
  },
  "Get Application Dossier": {
    code: 200,
    data: {
      provider: { ...exampleProvider, applicationStatus: "PENDING_REVIEW", version: 9 },
      profile: exampleProfile,
      contacts: exampleContacts,
      media: exampleMedia,
      completion: exampleCompletion,
      readiness: exampleReadiness,
      submittedAt: exampleTimestamp,
    },
  },
  "Approve Application": {
    code: 200,
    data: {
      provider: { ...exampleProvider, applicationStatus: "APPROVED", version: 10 },
      completion: exampleCompletion,
      readiness: exampleReadiness,
    },
  },
  "Request Changes": {
    code: 200,
    data: {
      provider: { ...exampleProvider, applicationStatus: "CHANGES_REQUESTED", version: 10 },
      completion: exampleCompletion,
      readiness: exampleReadiness,
    },
  },
  "Reject Application": {
    code: 200,
    data: {
      provider: { ...exampleProvider, applicationStatus: "REJECTED", version: 10 },
      completion: exampleCompletion,
      readiness: exampleReadiness,
    },
  },
  "Suspend Provider": {
    code: 200,
    data: {
      provider: {
        ...exampleProvider,
        applicationStatus: "APPROVED",
        operationalStatus: "SUSPENDED",
        version: 15,
      },
      completion: exampleCompletion,
      readiness: exampleReadiness,
    },
  },
  "Reinstate Provider": {
    code: 200,
    data: {
      provider: {
        ...exampleProvider,
        applicationStatus: "APPROVED",
        operationalStatus: "INACTIVE",
        version: 16,
      },
      completion: exampleCompletion,
      readiness: exampleReadiness,
    },
  },
};

function statusText(code: number): string {
  if (code === 201) return "Created";
  if (code === 202) return "Accepted";
  return "OK";
}

function captureScript(variable: CaptureVariable): string[] {
  const candidates: Record<CaptureVariable, string> = {
    providerId:
      "data.id ?? data.providerId ?? data.provider?.id ?? data.application?.providerId",
    galleryItemId:
      "data.id ?? data.galleryItemId ?? data.media?.id ?? data.item?.id",
    invitationId:
      "data.id ?? data.invitationId ?? data.invitation?.id",
    challengeId:
      "data.challengeId ?? data.challenge?.id ?? data.verification?.challengeId",
  };

  return [
    `const capturedValue = ${candidates[variable]};`,
    "if (typeof capturedValue === \"string\" && capturedValue.length > 0) {",
    `  pm.environment.set("${variable}", capturedValue);`,
    "}",
  ];
}

function requestItem(input: RequestItemInput) {
  const expectedStatuses = input.expectedStatuses ?? [200];
  const hasJsonBody = input.body?.kind === "json";
  const body =
    input.body?.kind === "json"
      ? {
          mode: "raw",
          raw: input.body.value,
          options: { raw: { language: "json" } },
        }
      : input.body?.kind === "formdata"
        ? {
            mode: "formdata",
            formdata: [
              {
                key: "file",
                type: "file",
                src: `{{${input.body.fileVariable}}}`,
                description: "Select the private local file in your Postman environment.",
              },
              {
                key: "expectedVersion",
                type: "text",
                value: "{{providerVersion}}",
                description: "Current Provider aggregate version.",
              },
            ],
          }
        : undefined;

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
    "  if (body.success === true && body.data && typeof body.data === \"object\") {",
    "    const data = body.data;",
    "    const currentVersion = data.version ?? data.provider?.version ?? data.application?.version;",
    "    if (Number.isInteger(currentVersion) && currentVersion > 0) {",
    "      pm.environment.set(\"providerVersion\", String(currentVersion));",
    "    }",
    ...(input.capture === undefined ? [] : captureScript(input.capture)),
    "  }",
    "}",
  ];

  const request = {
    method: input.method,
    header: [acceptHeader, ...(hasJsonBody ? [jsonHeader] : [])],
    ...(body === undefined ? {} : { body }),
    url: `{{baseUrl}}${input.route}`,
    description: input.description,
    ...(input.auth === "none" ? { auth: { type: "noauth" } } : {}),
  };
  const successExample = successExamples[input.name];
  if (successExample === undefined) {
    throw new Error(`Missing Success saved example for ${input.name}`);
  }
  const successEnvelope = {
    success: true,
    data: successExample.data,
    requestId: "request_example_01",
    ...(successExample.meta === undefined ? {} : { meta: successExample.meta }),
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
    response: [
      {
        name: "Success",
        originalRequest: request,
        status: statusText(successExample.code),
        code: successExample.code,
        _postman_previewlanguage: "json",
        header: [
          {
            key: "Content-Type",
            value: "application/json; charset=utf-8",
          },
        ],
        cookie: [],
        body: JSON.stringify(successEnvelope, null, 2),
      },
    ],
  };
}

const json = (value: string): RawBody => ({ kind: "json", value });
const formData = (fileVariable: string): FormDataBody => ({
  kind: "formdata",
  fileVariable,
});

const versionBody = json(
  '{\n  "expectedVersion": {{providerVersion}}\n}',
);
const reviewReasonBody = json(
  '{\n  "reason": "{{staffReviewReason}}",\n  "expectedVersion": {{providerVersion}}\n}',
);
const rejectionReasonBody = json(
  '{\n  "reason": "{{staffRejectionReason}}",\n  "expectedVersion": {{providerVersion}}\n}',
);
const lifecycleReasonBody = json(
  '{\n  "reason": "{{staffLifecycleReason}}",\n  "expectedVersion": {{providerVersion}}\n}',
);
const invitationTokenBody = json(
  '{\n  "token": "{{providerAdminInvitationToken}}"\n}',
);

function operationFolders(): OperationFolder[] {
  return [
    {
      name: "01 — Application",
      description:
        "Create or recover the single Provider draft, read the aggregate, change a never-submitted kind, and submit the completed application.",
      item: [
        requestItem({
          name: "Create Provider Application",
          method: "POST",
          route: "/providers",
          description:
            "Creates the caller's single Provider draft or returns the existing Provider. Requires an ACTIVE eligible Individual or Company customer identity with a complete matching customer profile. Captures providerId and providerVersion.",
          expectedStatuses: [200, 201],
          body: json(
            '{\n  "providerKind": "{{providerKind}}"\n}',
          ),
          capture: "providerId",
        }),
        requestItem({
          name: "List Own Providers",
          method: "GET",
          route: "/providers",
          description:
            "Lists Provider aggregates visible to the authenticated Application Owner or accepted Provider Admin. Optional query parameters: cursor and limit (1-100).",
        }),
        requestItem({
          name: "Get Provider",
          method: "GET",
          route: "/providers/{{providerId}}",
          description:
            "Reloads the authorized private Provider aggregate. Use this request to refresh providerVersion after a 409 version conflict.",
          capture: "providerId",
        }),
        requestItem({
          name: "Change Never-Submitted Kind",
          method: "PATCH",
          route: "/providers/{{providerId}}/kind",
          description:
            "Changes INDIVIDUAL_TEAM to REGISTERED_COMPANY or the reverse only before the application has ever been submitted. Eligibility is re-evaluated for the new kind.",
          body: json(
            '{\n  "providerKind": "{{alternateProviderKind}}",\n  "expectedVersion": {{providerVersion}}\n}',
          ),
        }),
        requestItem({
          name: "Submit Application",
          method: "POST",
          route: "/providers/{{providerId}}/application/submit",
          description:
            "Submits a complete draft or resubmits after CHANGES_REQUESTED. Successful submission moves the application to PENDING_REVIEW and locks editable content during review.",
          expectedStatuses: [200, 201],
          body: versionBody,
        }),
      ],
    },
    {
      name: "02 — Profile and Private Contacts",
      description:
        "Manage the bilingual public profile, private operational contacts, and the contact-free protected preview.",
      item: [
        requestItem({
          name: "Get Profile",
          method: "GET",
          route: "/providers/{{providerId}}/profile",
          description: "Reads the editable bilingual Provider profile.",
        }),
        requestItem({
          name: "Replace Profile",
          method: "PUT",
          route: "/providers/{{providerId}}/profile",
          description:
            "Full-replaces the Provider profile. English display name and description may be null. countryCode must identify an active configured country.",
          body: json(
            '{\n  "displayNameAr": "{{providerDisplayNameAr}}",\n  "displayNameEn": "{{providerDisplayNameEn}}",\n  "descriptionAr": "{{providerDescriptionAr}}",\n  "descriptionEn": "{{providerDescriptionEn}}",\n  "countryCode": "{{countryCode}}",\n  "expectedVersion": {{providerVersion}}\n}',
          ),
        }),
        requestItem({
          name: "Get Private Contacts",
          method: "GET",
          route: "/providers/{{providerId}}/contacts",
          description:
            "Reads private operational email, phone, and optional contact channels. These values are not returned by the public-style preview.",
        }),
        requestItem({
          name: "Replace Private Contacts",
          method: "PUT",
          route: "/providers/{{providerId}}/contacts",
          description:
            "Full-replaces private operational contacts. Phone and WhatsApp examples use E.164 format. Supported channel types: WHATSAPP, SOCIAL, WEBSITE, EXTERNAL_BOOKING.",
          body: json(
            '{\n  "operationalEmail": "{{providerOperationalEmail}}",\n  "operationalPhone": "{{providerOperationalPhone}}",\n  "channels": [\n    {\n      "type": "WHATSAPP",\n      "value": "{{providerWhatsApp}}"\n    },\n    {\n      "type": "WEBSITE",\n      "value": "{{providerWebsite}}"\n    }\n  ],\n  "expectedVersion": {{providerVersion}}\n}',
          ),
        }),
        requestItem({
          name: "Protected Contact-Free Preview",
          method: "GET",
          route: "/providers/{{providerId}}/preview",
          description:
            "Returns the authorized customer-facing preview without operational email or phone. R1-P05 exposes no anonymous Provider browse endpoint.",
        }),
      ],
    },
    {
      name: "03 — Media",
      description:
        "Upload, list, order, and remove the Provider logo, cover, gallery images, and gallery videos. Upload requests are prepared as multipart/form-data.",
      item: [
        requestItem({
          name: "List Media",
          method: "GET",
          route: "/providers/{{providerId}}/media",
          description:
            "Lists authorized logo, cover, and gallery media references and processing states.",
        }),
        requestItem({
          name: "Replace Logo",
          method: "PUT",
          route: "/providers/{{providerId}}/media/logo",
          description:
            "Uploads or replaces the single Provider logo. Select providerLogoPath. Images must satisfy the server content-type, size, and normalized-dimension policy.",
          body: formData("providerLogoPath"),
        }),
        requestItem({
          name: "Replace Cover",
          method: "PUT",
          route: "/providers/{{providerId}}/media/cover",
          description:
            "Uploads or replaces the single Provider cover. Select providerCoverPath.",
          body: formData("providerCoverPath"),
        }),
        requestItem({
          name: "Add Gallery Image",
          method: "POST",
          route: "/providers/{{providerId}}/media/gallery-images",
          description:
            "Adds one gallery image, up to 12 total. Select providerGalleryImagePath. At least 3 images must be READY before submission.",
          expectedStatuses: [201],
          body: formData("providerGalleryImagePath"),
          capture: "galleryItemId",
        }),
        requestItem({
          name: "Add Gallery Video",
          method: "POST",
          route: "/providers/{{providerId}}/media/gallery-videos",
          description:
            "Adds one optional gallery video, up to 2 total. Select providerGalleryVideoPath. MP4 or WebM; authoritative maximum 40 MiB.",
          expectedStatuses: [201],
          body: formData("providerGalleryVideoPath"),
          capture: "galleryItemId",
        }),
        requestItem({
          name: "Reorder Gallery",
          method: "PUT",
          route: "/providers/{{providerId}}/media/gallery-order",
          description:
            "Full-replaces the gallery display order. Add every current gallery item ID to orderedGalleryItemIds in the desired order.",
          body: json(
            '{\n  "orderedGalleryItemIds": [\n    "{{galleryItemId}}"\n  ],\n  "expectedVersion": {{providerVersion}}\n}',
          ),
        }),
        requestItem({
          name: "Delete Logo",
          method: "DELETE",
          route: "/providers/{{providerId}}/media/logo",
          description:
            "Clears the logo association using optimistic concurrency.",
          body: versionBody,
        }),
        requestItem({
          name: "Delete Cover",
          method: "DELETE",
          route: "/providers/{{providerId}}/media/cover",
          description:
            "Clears the cover association using optimistic concurrency.",
          body: versionBody,
        }),
        requestItem({
          name: "Delete Gallery Item",
          method: "DELETE",
          route: "/providers/{{providerId}}/media/gallery/{{galleryItemId}}",
          description:
            "Removes the selected gallery image or video from this Provider.",
          body: versionBody,
        }),
      ],
    },
    {
      name: "04 — Completion, Readiness and Provider Workspace",
      description:
        "Inspect application completion, later-phase marketplace readiness, append-only history, dashboard next actions, and capability-only settings.",
      item: [
        requestItem({
          name: "Get Completion",
          method: "GET",
          route: "/providers/{{providerId}}/completion",
          description:
            "Returns kind-aware R1-P05 application completion and actionable blockers.",
        }),
        requestItem({
          name: "Get Readiness",
          method: "GET",
          route: "/providers/{{providerId}}/readiness",
          description:
            "Returns marketplace readiness gates. Approval alone does not make a Provider LIVE or eligible for public browse.",
        }),
        requestItem({
          name: "Get History",
          method: "GET",
          route: "/providers/{{providerId}}/history",
          description:
            "Returns bounded append-only Provider application and operational history. Optional query parameters: cursor and limit.",
        }),
        requestItem({
          name: "Get Dashboard",
          method: "GET",
          route: "/providers/{{providerId}}/dashboard",
          description:
            "Returns a bounded Provider workspace aggregate including the current next action.",
        }),
        requestItem({
          name: "Get Settings",
          method: "GET",
          route: "/providers/{{providerId}}/settings",
          description:
            "Returns capability-only settings. The UI must render actions from capabilities rather than infer them from status strings.",
        }),
      ],
    },
    {
      name: "05 — Members and Admin Invitations",
      description:
        "Manage OWNER and ADMIN memberships and the Provider Admin invitation lifecycle. Provider members are administrators, not cleaning workers.",
      item: [
        requestItem({
          name: "List Members",
          method: "GET",
          route: "/providers/{{providerId}}/members",
          description: "Lists Provider OWNER and ADMIN memberships.",
        }),
        requestItem({
          name: "Disable Admin Member",
          method: "DELETE",
          route: "/providers/{{providerId}}/members/{{userId}}",
          description:
            "Soft-disables an ADMIN membership. The target cannot be OWNER, and the final enabled administration invariant is enforced.",
          body: versionBody,
        }),
        requestItem({
          name: "List Admin Invitations",
          method: "GET",
          route: "/providers/{{providerId}}/admin-invitations",
          description:
            "Lists invitation lifecycle rows. Optional query parameters: status, cursor, and limit.",
        }),
        requestItem({
          name: "Create Admin Invitation",
          method: "POST",
          route: "/providers/{{providerId}}/admin-invitations",
          description:
            "Invites a Provider ADMIN by normalized email. The raw token is delivered out of band and is never returned as durable list data.",
          expectedStatuses: [202],
          body: json(
            '{\n  "email": "{{providerAdminInviteEmail}}",\n  "expectedVersion": {{providerVersion}}\n}',
          ),
          capture: "invitationId",
        }),
        requestItem({
          name: "Resend Admin Invitation",
          method: "POST",
          route:
            "/providers/{{providerId}}/admin-invitations/{{invitationId}}/resend",
          description:
            "Rotates the pending invitation verifier and sends the replacement invitation. The prior token becomes unusable.",
          expectedStatuses: [202],
          body: versionBody,
        }),
        requestItem({
          name: "Revoke Admin Invitation",
          method: "POST",
          route:
            "/providers/{{providerId}}/admin-invitations/{{invitationId}}/revoke",
          description: "Revokes a pending Provider Admin invitation.",
          body: versionBody,
        }),
      ],
    },
    {
      name: "06 — Invitation Token Onboarding",
      description:
        "Inspect an out-of-band invitation, create and verify an invitation-only identity when needed, then accept the invitation while authenticated.",
      item: [
        requestItem({
          name: "Inspect Invitation",
          method: "POST",
          route: "/provider-admin-invitations/inspect",
          description:
            "Publicly inspects a body-supplied invitation token and returns only safe invitation facts. The token must never be placed in a URL.",
          auth: "none",
          body: invitationTokenBody,
        }),
        requestItem({
          name: "Start Invitation Onboarding",
          method: "POST",
          route: "/provider-admin-invitations/onboarding/start",
          description:
            "Starts categoryless invitation-only onboarding for an invitee without a Cleanora identity. Uses the invitation's fixed email and captures challengeId when returned.",
          auth: "none",
          expectedStatuses: [202],
          body: json(
            '{\n  "token": "{{providerAdminInvitationToken}}",\n  "phone": "{{invitedAdminPhone}}",\n  "password": "{{testPassword}}"\n}',
          ),
          capture: "challengeId",
        }),
        requestItem({
          name: "Verify Invitation Email",
          method: "POST",
          route: "/provider-admin-invitations/onboarding/verify-email",
          description:
            "Consumes the invitation onboarding email code for the fixed invited email.",
          auth: "none",
          body: json(
            '{\n  "token": "{{providerAdminInvitationToken}}",\n  "challengeId": "{{challengeId}}",\n  "code": "{{emailOtp}}"\n}',
          ),
        }),
        requestItem({
          name: "Accept Invitation",
          method: "POST",
          route: "/provider-admin-invitations/accept",
          description:
            "Atomically consumes the one-time invitation and creates the Provider ADMIN membership. Authenticate as the verified invitee whose email matches the invitation.",
          body: invitationTokenBody,
        }),
      ],
    },
    {
      name: "07 — Staff Review and Lifecycle",
      description:
        "Staff Admin-only application queue, private dossier, review decisions, suspension, and reinstatement.",
      item: [
        requestItem({
          name: "List Applications Queue",
          method: "GET",
          route: "/staff/providers/applications",
          description:
            "Lists the deterministic Staff review queue. Optional filters: status, providerKind, submittedFrom, submittedTo, cursor, and limit.",
        }),
        requestItem({
          name: "Get Application Dossier",
          method: "GET",
          route: "/staff/providers/applications/{{providerId}}",
          description:
            "Reads the private Staff dossier for one submitted Provider application.",
        }),
        requestItem({
          name: "Approve Application",
          method: "POST",
          route:
            "/staff/providers/applications/{{providerId}}/approve",
          description:
            "Approves the application atomically. Approval creates the OWNER membership but leaves operational status INACTIVE.",
          body: versionBody,
        }),
        requestItem({
          name: "Request Changes",
          method: "POST",
          route:
            "/staff/providers/applications/{{providerId}}/request-changes",
          description:
            "Returns the application to the owner as editable CHANGES_REQUESTED with a private Staff reason.",
          body: reviewReasonBody,
        }),
        requestItem({
          name: "Reject Application",
          method: "POST",
          route: "/staff/providers/applications/{{providerId}}/reject",
          description:
            "Rejects the application with a required Staff reason. Rejection is terminal in R1-P05.",
          body: rejectionReasonBody,
        }),
        requestItem({
          name: "Suspend Provider",
          method: "POST",
          route: "/staff/providers/{{providerId}}/suspend",
          description:
            "Suspends an approved Provider with a required audited reason.",
          body: lifecycleReasonBody,
        }),
        requestItem({
          name: "Reinstate Provider",
          method: "POST",
          route: "/staff/providers/{{providerId}}/reinstate",
          description:
            "Reinstates a suspended Provider to INACTIVE. It never bypasses later readiness gates by setting LIVE directly.",
          body: lifecycleReasonBody,
        }),
      ],
    },
  ];
}

function environmentFolder(
  name: "Hosted (Not hosted yet)" | "Local",
  scope: "hosted" | "local",
) {
  const folders = operationFolders();
  const title = scope === "local" ? "Local development" : "Hosted deployment";
  return {
    name,
    description:
      scope === "local"
        ? "Runs all 41 R1-P05 operations against localHostUrl/localBaseUrl. Default: http://localhost:8000/api/v1."
        : "Runs the same 41 R1-P05 operations against hostedHostUrl/hostedBaseUrl. The hosted API is not deployed yet; replace the placeholders before use.",
    event: [
      {
        listen: "prerequest",
        script: {
          type: "text/javascript",
          exec: [
            `const selectedHostUrl = pm.environment.get("${scope}HostUrl") || pm.collectionVariables.get("${scope}HostUrl");`,
            `const selectedBaseUrl = pm.environment.get("${scope}BaseUrl") || pm.collectionVariables.get("${scope}BaseUrl");`,
            `if (!selectedHostUrl || !selectedBaseUrl) { throw new Error("${title} URL variables are not configured."); }`,
            ...(scope === "hosted"
              ? [
                  'if (selectedHostUrl.includes("YOUR-HOSTED-DOMAIN")) { throw new Error("Hosted API is not configured yet. Set hostedHostUrl and hostedBaseUrl in the selected Postman environment."); }',
                ]
              : []),
            'pm.variables.set("hostUrl", selectedHostUrl);',
            'pm.variables.set("baseUrl", selectedBaseUrl);',
          ],
        },
      },
    ],
    item:
      scope === "hosted"
        ? (JSON.parse(
            JSON.stringify(folders).replaceAll(
              "{{baseUrl}}",
              "{{hostUrl}}",
            ),
          ) as typeof folders)
        : folders,
  };
}

async function main(): Promise<void> {
  const documentation = await readFile(
    resolve("postman/readme_R1-P05.md"),
    "utf8",
  );

  const collection = {
    info: {
      _postman_id: "c5e0a105-p05a-4b1d-9f2e-provider-onboarding",
      name: "Cleanora R1-P05 Provider Onboarding, Profile & Lifecycle",
      description: documentation,
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    auth: {
      type: "bearer",
      bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
    },
    variable: [
      { key: "localHostUrl", value: "http://localhost:8000", type: "string" },
      {
        key: "localBaseUrl",
        value: "http://localhost:8000/api/v1",
        type: "string",
      },
      {
        key: "hostedHostUrl",
        value: "https://YOUR-HOSTED-DOMAIN.example",
        type: "string",
      },
      {
        key: "hostedBaseUrl",
        value: "https://YOUR-HOSTED-DOMAIN.example/api/v1",
        type: "string",
      },
      { key: "hostUrl", value: "", type: "string" },
      { key: "baseUrl", value: "", type: "string" },
      { key: "providerId", value: "", type: "string" },
      { key: "providerVersion", value: "1", type: "string" },
      { key: "galleryItemId", value: "", type: "string" },
      { key: "invitationId", value: "", type: "string" },
      { key: "userId", value: "", type: "string" },
      {
        key: "providerAdminInvitationToken",
        value: "",
        type: "string",
      },
    ],
    item: [
      environmentFolder("Hosted (Not hosted yet)", "hosted"),
      environmentFolder("Local", "local"),
    ],
  };

  const outputPath = resolve(
    "postman/Cleanora-R1-P05-Provider-Onboarding.postman_collection.json",
  );
  await writeFile(outputPath, `${JSON.stringify(collection, null, 2)}\n`, "utf8");
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      outputPath: "postman/Cleanora-R1-P05-Provider-Onboarding.postman_collection.json",
      environments: 2,
      requestsPerEnvironment: 41,
      totalRequests: 82,
    })}\n`,
  );
}

void main();
