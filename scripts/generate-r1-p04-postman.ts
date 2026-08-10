import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

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
    response: [],
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
      "Executable R1-P04 customer self-service collection. Run the R1-P02 login flow first so accessToken is available. Select the Local or Railway environment, use an ACTIVE customer with the required verified category, and consult Swagger for complete error contracts. Profile-image upload uses a local JPEG/PNG/WebP file and never exports Cloudinary credentials or signed delivery URLs.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  auth: {
    type: "bearer",
    bearer: [{ key: "token", value: "{{accessToken}}", type: "string" }],
  },
  item: [
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
          description: "Creates or replaces the owned Company profile, including nullable commercial and tax registration identifiers.",
          rawBody: `{
  "companyName": "{{companyName}}",
  "representativeFullName": "{{representativeFullName}}",
  "commercialRegistrationNumber": "{{commercialRegistrationNumber}}",
  "taxRegistrationNumber": "{{taxRegistrationNumber}}"
}`,
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

async function main(): Promise<void> {
  await writeFile(
    resolve("postman/R1-P04-customer-self-service.postman_collection.json"),
    `${JSON.stringify(collection, null, 2)}\n`,
    "utf8",
  );
}

void main();
