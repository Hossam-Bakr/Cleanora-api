import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createExamples,
  createTargetFolders,
  type PostmanItem,
  type PostmanRequest,
} from "./postman-collection-helpers.js";

type Header = { key: string; value: string };
type FormDataPart = {
  key: string;
  type: "file" | "text";
  src?: string;
  value?: string;
  description?: string;
};

interface RequestItemInput {
  readonly name: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE";
  readonly route: string;
  readonly description: string;
  readonly expectedStatuses?: readonly number[];
  readonly rawBody?: string;
  readonly formData?: readonly FormDataPart[];
  readonly capture?: readonly string[];
  readonly bodyComments?: readonly string[];
}

const hostUrl = "{{hostUrl}}";
const acceptHeader: Header = { key: "Accept", value: "application/json" };
const jsonHeader: Header = { key: "Content-Type", value: "application/json" };

const individualProfile = {
  category: "INDIVIDUAL",
  created: true,
  fullName: "Cleanora Individual",
};
const companyProfile = {
  category: "COMPANY",
  created: true,
  companyName: "Cleanora Services",
  representativeFullName: "Cleanora Representative",
};
const engineerProfile = {
  category: "ENGINEER",
  created: true,
  fullName: "Cleanora Engineer",
  professionalTitle: "Cleaning Engineer",
};
const profileImage = {
  mediaId: "<media-id>",
  url: "https://res.cloudinary.com/<cloud>/image/authenticated/s--signed--/<public-id>.webp",
  urlExpiresAt: "2026-08-09T12:15:00.000Z",
  associationVersion: 2,
  contentType: "image/webp",
  width: 1200,
  height: 900,
};
const address = {
  id: "<address-id>",
  countryCode: "EG",
  city: "Cairo",
  district: "Nasr City",
  addressText: "Example Street",
  building: "10",
  floor: "2",
  notes: null,
  version: 1,
};
const preferences = {
  version: 2,
  language: "EN",
  reminders: { sms: true, push: true },
  promotional: { sms: false, push: true },
  mandatory: {
    security: { sms: true, push: true },
    activeService: { sms: true, push: true },
  },
};
const privacyRequest = {
  id: "<privacy-request-id>",
  purpose: "EXPORT",
  status: "PENDING",
  requestedAt: "2026-08-09T12:00:00.000Z",
  updatedAt: "2026-08-09T12:00:00.000Z",
  cancelledAt: null,
  processingAt: null,
  terminalAt: null,
  outcomeCode: null,
};

function successData(method: string, route: string): unknown {
  if (route === "/customers/me/overview") {
    return {
      identity: {
        userId: "<user-id>",
        status: "ACTIVE",
        accountCategories: ["INDIVIDUAL"],
        verifiedCategories: ["INDIVIDUAL"],
        pendingCategories: [],
      },
      profiles: [individualProfile],
      profileImage,
      contactState: {
        phone: { value: "+201001234567", verified: false },
        email: { value: "user@example.test", verified: true },
      },
      preferences,
      addresses: [address],
    };
  }
  if (route === "/customers/profiles/individual") return individualProfile;
  if (route === "/customers/profiles/company") return companyProfile;
  if (route === "/customers/profiles/engineer") return engineerProfile;
  if (route === "/customers/profile-image") {
    if (method === "GET") return { profileImage };
    if (method === "DELETE") return { profiles: [individualProfile], profileImage: null };
    return { profiles: [individualProfile], profileImage };
  }
  if (route === "/customers/addresses") return method === "GET" ? [address] : address;
  if (route.includes("/customers/addresses/")) {
    return method === "DELETE" ? { deleted: true, id: "<address-id>" } : address;
  }
  if (route === "/customers/contact-state") {
    return {
      phone: { value: "+201001234567", verified: false },
      email: { value: "user@example.test", verified: true },
    };
  }
  if (route === "/customers/preferences") return preferences;
  if (route === "/customers/privacy-requests") {
    return method === "GET" ? [privacyRequest] : privacyRequest;
  }
  if (route.endsWith("/cancel")) {
    return {
      ...privacyRequest,
      status: "CANCELLED",
      cancelledAt: "2026-08-09T12:05:00.000Z",
      updatedAt: "2026-08-09T12:05:00.000Z",
    };
  }
  if (route.includes("/customers/privacy-requests/")) return privacyRequest;
  return {};
}

function requestItem(input: RequestItemInput) {
  const expectedStatuses = input.expectedStatuses ?? [200];
  const successStatus = expectedStatuses[0] ?? 200;
  const hasJsonBody = input.rawBody !== undefined;
  const request: PostmanRequest = {
    method: input.method,
    header: [acceptHeader, ...(hasJsonBody ? [jsonHeader] : [])],
    ...(input.rawBody === undefined
      ? input.formData === undefined
        ? {}
        : { body: { mode: "formdata", formdata: input.formData } }
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
    "    pm.expect(body.success).to.eql(true);",
    "    pm.expect(body.requestId).to.be.a(\"string\");",
    "  });",
    ...(input.capture ?? []).map((line) => `  ${line}`),
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
    response: createExamples(request, {
      successData: successData(input.method, input.route),
      status: successStatus,
      ...(input.bodyComments === undefined
        ? {}
        : { bodyComments: input.bodyComments }),
    }),
  };
}

const captureProfileImageVersion = [
  "const version = body.data?.profileImage?.associationVersion ?? body.data?.associationVersion;",
  "if (version) pm.environment.set(\"profileImageAssociationVersion\", version);",
] as const;

const collection = {
  info: {
    _postman_id: "3a5c87dd-776a-49fd-b13c-0ff226458e29",
    name: "Cleanora R1-P04 Customer Self-Service",
    description:
      "Executable R1-P04 customer self-service collection with explicit Hosted and Local folders. Every request includes a saved Success example; requests with bodies also include a commented Sample of correct body. Run the matching R1-P02 login flow first so accessToken is available. Use an ACTIVE customer with the required verified category and consult Swagger for complete error contracts. Profile-image upload uses a local JPEG/PNG/WebP file and never exports Cloudinary credentials.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
  },
  item: [
    {
      name: "Profile Overview",
      item: [
        requestItem({
          name: "Get Complete Customer Profile Overview",
          method: "GET",
          route: "/customers/me/overview",
          description:
            "Preferred frontend bootstrap read for the customer profile screen. Returns customer category state, every verified category profile, profile image, contact state, preferences, and addresses in one response. It does not select a primary category; continue using the resource-specific APIs for writes.",
          capture: [
            "const imageVersion = body.data?.profileImage?.associationVersion;",
            "if (imageVersion) pm.environment.set(\"profileImageAssociationVersion\", imageVersion);",
            "const preferenceVersion = body.data?.preferences?.version;",
            "if (preferenceVersion) pm.environment.set(\"preferencesVersion\", preferenceVersion);",
            "const firstAddress = body.data?.addresses?.[0];",
            "if (firstAddress?.id) pm.environment.set(\"addressId\", firstAddress.id);",
            "if (firstAddress?.version) pm.environment.set(\"addressVersion\", firstAddress.version);",
          ],
        }),
      ],
    },
    {
      name: "Profiles",
      item: [
        requestItem({
          name: "Get Individual Profile",
          method: "GET",
          route: "/customers/profiles/individual",
          description:
            "Returns the owned Individual profile or the explicit not-created representation.",
        }),
        requestItem({
          name: "Put Individual Profile",
          method: "PUT",
          route: "/customers/profiles/individual",
          description: "Creates or replaces the owned Individual profile fields.",
          rawBody: `{
  "fullName": "{{individualFullName}}"
}`,
          bodyComments: [
            "fullName: required customer display name; trim leading/trailing spaces.",
          ],
        }),
        requestItem({
          name: "Get Company Profile",
          method: "GET",
          route: "/customers/profiles/company",
          description:
            "Returns the owned Company profile or the explicit not-created representation.",
        }),
        requestItem({
          name: "Put Company Profile",
          method: "PUT",
          route: "/customers/profiles/company",
          description: "Creates or replaces the owned Company profile fields.",
          rawBody: `{
  "companyName": "{{companyName}}",
  "representativeFullName": "{{representativeFullName}}"
}`,
          bodyComments: [
            "companyName: required public business name.",
            "representativeFullName: required responsible representative name.",
          ],
        }),
        requestItem({
          name: "Get Engineer Profile",
          method: "GET",
          route: "/customers/profiles/engineer",
          description:
            "Returns the owned Engineer profile or the explicit not-created representation.",
        }),
        requestItem({
          name: "Put Engineer Profile",
          method: "PUT",
          route: "/customers/profiles/engineer",
          description: "Creates or replaces the owned Engineer profile fields.",
          rawBody: `{
  "fullName": "{{engineerFullName}}",
  "professionalTitle": "{{professionalTitle}}"
}`,
          bodyComments: [
            "fullName: required Engineer name.",
            "professionalTitle: required professional title shown on the profile.",
          ],
        }),
      ],
    },
    {
      name: "Profile Image",
      item: [
        requestItem({
          name: "Get Profile Image",
          method: "GET",
          route: "/customers/profile-image",
          description:
            "Returns a fresh authenticated signed URL and safe metadata, or 204 when no image is associated.",
          expectedStatuses: [200, 204],
          capture: captureProfileImageVersion,
        }),
        requestItem({
          name: "Upload or Replace Profile Image",
          method: "PUT",
          route: "/customers/profile-image",
          description:
            "Always replaces the current image using the required association-version CAS token. Select a local JPEG, PNG, or WebP no larger than 5 MiB if profileImagePath is not resolved by Postman.",
          formData: [
            {
              key: "file",
              type: "file",
              src: "{{profileImagePath}}",
              description: "Local JPEG/PNG/WebP file; maximum 5 MiB.",
            },
            {
              key: "expectedAssociationVersion",
              type: "text",
              value: "{{profileImageAssociationVersion}}",
              description: "Current image association version.",
            },
          ],
          bodyComments: [
            "file: one JPEG, PNG, or WebP image no larger than 5 MiB.",
            "expectedAssociationVersion: current CAS version; use 1 for the first association.",
          ],
          capture: captureProfileImageVersion,
        }),
        requestItem({
          name: "Delete Profile Image",
          method: "DELETE",
          route: "/customers/profile-image",
          description:
            "Clears the current association using CAS. Provider deletion continues through durable cleanup.",
          rawBody: `{
  "expectedAssociationVersion": {{profileImageAssociationVersion}}
}`,
          bodyComments: [
            "expectedAssociationVersion: latest image association version returned by GET or PUT.",
          ],
          capture: captureProfileImageVersion,
        }),
      ],
    },
    {
      name: "Addresses",
      item: [
        requestItem({
          name: "List Addresses",
          method: "GET",
          route: "/customers/addresses",
          description: "Lists all owned peer text addresses; none is primary/default.",
        }),
        requestItem({
          name: "Create Address",
          method: "POST",
          route: "/customers/addresses",
          description:
            "Creates a text-only address. countryCode must identify an active configured country; geospatial fields are rejected.",
          expectedStatuses: [201],
          rawBody: `{
  "countryCode": "{{countryCode}}",
  "city": "{{city}}",
  "district": "{{district}}",
  "addressText": "{{addressText}}",
  "building": "{{building}}",
  "floor": "{{floor}}",
  "notes": "{{addressNotes}}"
}`,
          bodyComments: [
            "countryCode: active ISO alpha-2 code such as EG.",
            "city, district, addressText: required non-empty text fields.",
            "building, floor, notes: optional strings; send null to clear them.",
          ],
          capture: [
            "if (body.data?.id) pm.environment.set(\"addressId\", body.data.id);",
            "if (body.data?.version) pm.environment.set(\"addressVersion\", body.data.version);",
          ],
        }),
        requestItem({
          name: "Get Address",
          method: "GET",
          route: "/customers/addresses/{{addressId}}",
          description:
            "Returns the owned address. Missing and wrong-owner identifiers share the enumeration-safe 404 contract.",
          capture: [
            "if (body.data?.version) pm.environment.set(\"addressVersion\", body.data.version);",
          ],
        }),
        requestItem({
          name: "Update Address",
          method: "PUT",
          route: "/customers/addresses/{{addressId}}",
          description: "Full replacement using the current address version.",
          rawBody: `{
  "countryCode": "{{countryCode}}",
  "city": "{{city}}",
  "district": "{{district}}",
  "addressText": "{{addressText}}",
  "building": "{{building}}",
  "floor": "{{floor}}",
  "notes": "{{addressNotes}}",
  "version": {{addressVersion}}
}`,
          bodyComments: [
            "This is a full replacement; include every address field.",
            "version: latest CAS version returned by the API.",
            "Use null for optional building, floor, or notes when they are absent.",
          ],
          capture: [
            "if (body.data?.version) pm.environment.set(\"addressVersion\", body.data.version);",
          ],
        }),
        requestItem({
          name: "Delete Address",
          method: "DELETE",
          route: "/customers/addresses/{{addressId}}",
          description: "Deletes the owned address using its current version.",
          rawBody: `{
  "version": {{addressVersion}}
}`,
          bodyComments: [
            "version: latest address CAS version; stale values return a conflict.",
          ],
        }),
      ],
    },
    {
      name: "Contact and Preferences",
      item: [
        requestItem({
          name: "Get Contact State",
          method: "GET",
          route: "/customers/contact-state",
          description:
            "Returns authoritative email/phone presence and verification labels from Authentication.",
        }),
        requestItem({
          name: "Get Preferences",
          method: "GET",
          route: "/customers/preferences",
          description: "Returns the current or default complete preference matrix.",
          capture: [
            "if (body.data?.version) pm.environment.set(\"preferencesVersion\", body.data.version);",
          ],
        }),
        requestItem({
          name: "Replace Preferences",
          method: "PUT",
          route: "/customers/preferences",
          description:
            "DEC-032 full replacement. version, language, reminders, promotional, and mandatory notice fields are all required.",
          rawBody: `{
  "version": {{preferencesVersion}},
  "language": "EN",
  "reminders": {
    "sms": true,
    "push": true
  },
  "promotional": {
    "sms": false,
    "push": true
  },
  "mandatory": {
    "security": {
      "sms": true,
      "push": true
    },
    "activeService": {
      "sms": true,
      "push": true
    }
  }
}`,
          bodyComments: [
            "DEC-032 full replacement: every shown field is required.",
            "language: AR, EN, or null.",
            "reminders/promotional: sms and push must both be booleans.",
            "mandatory security and activeService values must remain true.",
            "version: latest preference CAS version returned by GET or PUT.",
          ],
          capture: [
            "if (body.data?.version) pm.environment.set(\"preferencesVersion\", body.data.version);",
          ],
        }),
      ],
    },
    {
      name: "Privacy Requests",
      item: [
        requestItem({
          name: "List Privacy Requests",
          method: "GET",
          route: "/customers/privacy-requests",
          description: "Lists owned, non-purged privacy-request metadata.",
        }),
        requestItem({
          name: "Submit Privacy Request",
          method: "POST",
          route: "/customers/privacy-requests",
          description:
            "Submits DEACTIVATION, DELETION, or EXPORT. Submission does not execute or fulfill the request.",
          expectedStatuses: [201],
          rawBody: `{
  "purpose": "{{privacyPurpose}}"
}`,
          bodyComments: [
            "purpose: exactly DEACTIVATION, DELETION, or EXPORT.",
            "Do not include rationale, processor, status, or outcome fields.",
          ],
          capture: [
            "if (body.data?.id) pm.environment.set(\"privacyRequestId\", body.data.id);",
          ],
        }),
        requestItem({
          name: "Get Privacy Request",
          method: "GET",
          route: "/customers/privacy-requests/{{privacyRequestId}}",
          description:
            "Returns owned request metadata. Missing and wrong-owner identifiers share the same safe 404 contract.",
        }),
        requestItem({
          name: "Cancel Privacy Request",
          method: "POST",
          route: "/customers/privacy-requests/{{privacyRequestId}}/cancel",
          description: "Cancels an owned request only while it is PENDING.",
        }),
      ],
    },
  ],
};

const exportedCollection = {
  ...collection,
  item: createTargetFolders(collection.item as readonly PostmanItem[]),
};

async function main(): Promise<void> {
  await writeFile(
    resolve("postman/R1-P04-customer-self-service.postman_collection.json"),
    `${JSON.stringify(exportedCollection, null, 2)}\n`,
    "utf8",
  );
}

void main();
