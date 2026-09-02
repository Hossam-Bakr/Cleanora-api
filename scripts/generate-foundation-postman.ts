/**
 * @desc Generate the R1-P00 and R1-P01 foundation Postman collections.
 * @access Maintainer tooling
 * @explanation Keeps the health collections consistent with the later-phase
 * Hosted/Local layout and provides one Saved Success Example per request.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

interface HealthRequestInput {
  readonly name: string;
  readonly route: string;
  readonly successStatus: "ok" | "ready" | "up";
  readonly unavailableCode?: "DEPENDENCY_NOT_READY" | "DATABASE_UNAVAILABLE";
}

function healthRequest(
  input: HealthRequestInput,
  urlVariable: "hostUrl" | "baseUrl",
) {
  const request = {
    method: "GET",
    header: [{ key: "Accept", value: "application/json" }],
    url: `{{${urlVariable}}}${input.route}`,
    description:
      input.unavailableCode === undefined
        ? `Returns 200 when the ${input.name.toLowerCase()} health contract succeeds.`
        : `Returns 200 when healthy or 503 ${input.unavailableCode} without leaking infrastructure details.`,
    auth: { type: "noauth" },
  };
  const tests = [
    "const body = pm.response.json();",
    `pm.test("Expected health status", () => pm.expect(${input.unavailableCode === undefined ? "[200]" : "[200, 503]"}).to.include(pm.response.code));`,
    "pm.test('Uses a correlated Cleanora response envelope', () => {",
    "  pm.expect(body.requestId).to.be.a('string');",
    "  pm.expect(pm.response.headers.get('x-request-id')).to.eql(body.requestId);",
    "  if (pm.response.code === 200) {",
    "    pm.expect(body.success).to.eql(true);",
    `    pm.expect(body.data.status).to.eql('${input.successStatus}');`,
    "  }",
    "});",
    ...(input.unavailableCode === undefined
      ? []
      : [
          "if (pm.response.code === 503) {",
          "  pm.test('Returns a safe dependency failure', () => {",
          "    pm.expect(body.success).to.eql(false);",
          `    pm.expect(body.error).to.include({ code: '${input.unavailableCode}', statusCode: 503 });`,
          "    pm.expect(JSON.stringify(body)).not.to.match(/postgres(?:ql)?:\\/\\/|DATABASE_URL|SELECT\\s/i);",
          "  });",
          "}",
        ]),
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
    response: [
      {
        name: "Success",
        originalRequest: request,
        status: "OK",
        code: 200,
        _postman_previewlanguage: "json",
        header: [
          { key: "Content-Type", value: "application/json; charset=utf-8" },
          { key: "x-request-id", value: "request_example_01" },
        ],
        cookie: [],
        body: JSON.stringify(
          {
            success: true,
            data: { status: input.successStatus },
            requestId: "request_example_01",
          },
          null,
          2,
        ),
      },
    ],
  };
}

function environmentFolder(
  requests: readonly HealthRequestInput[],
  name: "Hosted (Not hosted yet)" | "Local",
  urlVariable: "hostUrl" | "baseUrl",
  innerFolderName: string,
) {
  return {
    name,
    description:
      urlVariable === "hostUrl"
        ? "Health requests using {{hostUrl}}. Configure/select the hosted environment before use."
        : "Health requests using {{baseUrl}}. Default local API root: http://localhost:8000/api/v1.",
    item: [
      {
        name: innerFolderName,
        item: requests.map((request) => healthRequest(request, urlVariable)),
      },
    ],
  };
}

async function collection(input: {
  readonly id: string;
  readonly name: string;
  readonly documentationPath: string;
  readonly innerFolderName: string;
  readonly requests: readonly HealthRequestInput[];
}) {
  return {
    info: {
      _postman_id: input.id,
      name: input.name,
      description: await readFile(resolve(input.documentationPath), "utf8"),
      schema:
        "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: [
      environmentFolder(
        input.requests,
        "Hosted (Not hosted yet)",
        "hostUrl",
        input.innerFolderName,
      ),
      environmentFolder(
        input.requests,
        "Local",
        "baseUrl",
        input.innerFolderName,
      ),
    ],
  };
}

async function main(): Promise<void> {
  const r1P00 = await collection({
    id: "534205cd-61cf-4f16-95b5-4966f792cba3",
    name: "Cleanora R1-P00 Foundation",
    documentationPath: "postman/readme_R1-P00.md",
    innerFolderName: "System",
    requests: [
      {
        name: "Liveness",
        route: "/system/health/live",
        successStatus: "ok",
      },
      {
        name: "Readiness",
        route: "/system/health/ready",
        successStatus: "ready",
        unavailableCode: "DEPENDENCY_NOT_READY",
      },
    ],
  });
  const r1P01 = await collection({
    id: "0b9d9188-9c13-4dfa-98e0-r1p01-foundation",
    name: "Cleanora R1-P01 Foundation & Country Configuration",
    documentationPath: "postman/readme_R1-P01.md",
    innerFolderName: "System Health",
    requests: [
      { name: "Live", route: "/system/health/live", successStatus: "ok" },
      {
        name: "Ready",
        route: "/system/health/ready",
        successStatus: "ready",
        unavailableCode: "DEPENDENCY_NOT_READY",
      },
      {
        name: "Database",
        route: "/system/health/database",
        successStatus: "up",
        unavailableCode: "DATABASE_UNAVAILABLE",
      },
    ],
  });

  await Promise.all([
    writeFile(
      resolve("postman/Cleanora-R1-P00-Foundation.postman_collection.json"),
      `${JSON.stringify(r1P00, null, 2)}\n`,
      "utf8",
    ),
    writeFile(
      resolve(
        "postman/Cleanora-R1-P01-Foundation-Country-Configuration.postman_collection.json",
      ),
      `${JSON.stringify(r1P01, null, 2)}\n`,
      "utf8",
    ),
  ]);
  process.stdout.write(
    `${JSON.stringify({ ok: true, collections: 2, environments: 2 })}\n`,
  );
}

void main();
