import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createExamples,
  createTargetFolders,
  type PostmanItem,
  type PostmanRequest,
} from "./postman-collection-helpers.js";

const schema =
  "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";

function healthRequest(input: {
  readonly name: string;
  readonly route: string;
  readonly description: string;
  readonly data: object;
  readonly testScript?: readonly string[];
}): PostmanItem {
  const request: PostmanRequest = {
    method: "GET",
    header: [{ key: "Accept", value: "application/json" }],
    url: `{{hostUrl}}${input.route}`,
    description: input.description,
  };
  return {
    name: input.name,
    ...(input.testScript === undefined
      ? {}
      : {
          event: [
            {
              listen: "test",
              script: { type: "text/javascript", exec: input.testScript },
            },
          ],
        }),
    request,
    response: createExamples(request, { successData: input.data }),
  };
}

const live = (name = "Liveness", testScript?: readonly string[]) =>
  healthRequest({
    name,
    route: "/system/health/live",
    description: "Confirms that the API process is alive.",
    data: { status: "ok", service: "cleanora-backend" },
    ...(testScript === undefined ? {} : { testScript }),
  });
const ready = (name = "Readiness", testScript?: readonly string[]) =>
  healthRequest({
    name,
    route: "/system/health/ready",
    description: "Confirms that required runtime dependencies are ready.",
    data: { status: "ready" },
    ...(testScript === undefined ? {} : { testScript }),
  });
const database = (testScript?: readonly string[]) =>
  healthRequest({
    name: "Database",
    route: "/system/health/database",
    description: "Confirms that the configured database can be reached safely.",
    data: { status: "up", database: "reachable" },
    ...(testScript === undefined ? {} : { testScript }),
  });

const liveTests = [
  "pm.test('returns liveness envelope', () => {",
  "  const body = pm.response.json();",
  "  pm.expect(pm.response.code).to.eql(200);",
  "  pm.expect(body.success).to.eql(true);",
  "  pm.expect(body.data.status).to.eql('ok');",
  "  pm.expect(body.requestId).to.be.a('string');",
  "  const headerRequestId = pm.response.headers.get('x-request-id');",
  "  pm.expect(headerRequestId).to.eql(body.requestId);",
  "});",
] as const;
const readyTests = [
  "pm.test('returns readiness envelope', () => {",
  "  const body = pm.response.json();",
  "  pm.expect([200, 503]).to.include(pm.response.code);",
  "  pm.expect(body.requestId).to.be.a('string');",
  "  const headerRequestId = pm.response.headers.get('x-request-id');",
  "  pm.expect(headerRequestId).to.eql(body.requestId);",
  "  if (pm.response.code === 200) {",
  "    pm.expect(body.success).to.eql(true);",
  "    pm.expect(body.data.status).to.eql('ready');",
  "  } else {",
  "    pm.expect(body.error).to.include({ code: 'DEPENDENCY_NOT_READY', statusCode: 503 });",
  "  }",
  "});",
] as const;
const databaseTests = [
  "pm.test('returns database health envelope', () => {",
  "  const body = pm.response.json();",
  "  pm.expect([200, 503]).to.include(pm.response.code);",
  "  pm.expect(body.requestId).to.be.a('string');",
  "  const headerRequestId = pm.response.headers.get('x-request-id');",
  "  pm.expect(headerRequestId).to.eql(body.requestId);",
  "  if (pm.response.code === 200) {",
  "    pm.expect(body.success).to.eql(true);",
  "    pm.expect(body.data.status).to.eql('up');",
  "  } else {",
  "    pm.expect(body.error).to.include({ code: 'DATABASE_UNAVAILABLE', statusCode: 503 });",
  "  }",
  "});",
] as const;

function collection(input: {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly folderName: string;
  readonly requests: readonly PostmanItem[];
}) {
  return {
    info: {
      _postman_id: input.id,
      name: input.name,
      description: input.description,
      schema,
    },
    item: createTargetFolders([{ name: input.folderName, item: input.requests }]),
  };
}

async function main(): Promise<void> {
  await writeFile(
    resolve("postman/R1-P00-foundation.postman_collection.json"),
    `${JSON.stringify(
      collection({
        id: "9b38f4ae-657c-47db-a8d3-815d0dd0f000",
        name: "Cleanora R1-P00 Foundation",
        description:
          "R1-P00 foundation health endpoints, duplicated into explicit Hosted and Local folders. Every request includes a saved Success example.",
        folderName: "System",
        requests: [live(), ready()],
      }),
      null,
      2,
    )}\n`,
    "utf8",
  );
  await writeFile(
    resolve("postman/R1-P01-foundation-country-configuration.postman_collection.json"),
    `${JSON.stringify(
      collection({
        id: "c2461ed5-5611-4c5d-882c-815d0dd0f001",
        name: "Cleanora R1-P01 Foundation & Country Configuration",
        description:
          "R1-P01 operational health endpoints, duplicated into explicit Hosted and Local folders. Every request includes a saved Success example.",
        folderName: "System health",
        requests: [
          live("Live", liveTests),
          ready("Ready", readyTests),
          database(databaseTests),
        ],
      }),
      null,
      2,
    )}\n`,
    "utf8",
  );
}

void main();
