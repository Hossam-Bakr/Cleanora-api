type PostmanHeader = { readonly key: string; readonly value: string };

type PostmanBody =
  | {
      readonly mode: "raw";
      raw: string;
      readonly options?: { readonly raw?: { readonly language?: string } };
    }
  | {
      readonly mode: "formdata";
      readonly formdata: readonly Record<string, unknown>[];
    };

export interface PostmanRequest {
  readonly method: string;
  readonly auth?: unknown;
  readonly header?: readonly PostmanHeader[];
  body?: PostmanBody;
  url: string;
  readonly description?: string;
}

export interface PostmanItem {
  name: string;
  readonly auth?: unknown;
  readonly event?: readonly unknown[];
  readonly request?: PostmanRequest;
  readonly response?: readonly unknown[];
  readonly item?: readonly PostmanItem[];
}

interface ExampleOptions {
  readonly successData?: unknown;
  readonly status?: number;
  readonly bodyComments?: readonly string[];
  readonly responseBody?: string;
}

interface TargetFoldersOptions {
  readonly hostedNameOverrides?: Readonly<Record<string, string>>;
}

const requestId = "7ebf45ad-7384-41ab-8e74-e864ae048d30";

function statusText(status: number): string {
  const values: Record<number, string> = {
    200: "OK",
    201: "Created",
    202: "Accepted",
    204: "No Content",
    302: "Found",
  };
  return values[status] ?? "Success";
}

function successEnvelope(data: unknown): string {
  return JSON.stringify({ success: true, data, requestId }, null, 2);
}

function documentedRequest(
  request: PostmanRequest,
  comments: readonly string[],
): PostmanRequest {
  const clone = structuredClone(request);
  if (clone.body?.mode === "raw") {
    clone.body.raw = [
      "// Documentation sample only. Remove comments before sending raw JSON.",
      ...comments.map((comment) => `// ${comment}`),
      clone.body.raw,
    ].join("\n");
  }
  return clone;
}

export function createExamples(
  request: PostmanRequest,
  options: ExampleOptions,
): readonly unknown[] {
  const status = options.status ?? 200;
  const success = {
    name: "Success",
    originalRequest: request,
    status: statusText(status),
    code: status,
    _postman_previewlanguage: "json",
    header: status === 204 ? [] : [{ key: "Content-Type", value: "application/json" }],
    cookie: [],
    body:
      options.responseBody ??
      (status === 204 ? "" : successEnvelope(options.successData ?? {})),
  };

  if (request.body === undefined) return [success];

  const bodyComments = options.bodyComments ?? [
    "Replace every {{variable}} from the selected Postman environment.",
    "Keep the exact required field names and value types shown below.",
  ];
  const sampleRequest = documentedRequest(request, bodyComments);
  return [
    success,
    {
      name: "Sample of correct body",
      originalRequest: sampleRequest,
      status: "Documentation Example",
      code: 200,
      _postman_previewlanguage: "json",
      header: [{ key: "Content-Type", value: "application/json" }],
      cookie: [],
      body: JSON.stringify(
        {
          note:
            request.body.mode === "formdata"
              ? "Use the multipart fields and descriptions shown in the example request."
              : "The request body shown above is JSONC documentation. Remove // comments before sending it as raw JSON.",
        },
        null,
        2,
      ),
    },
  ];
}

function requestKey(item: PostmanItem): string | undefined {
  if (item.request === undefined) return undefined;
  const route = item.request.url
    .replace(/^\{\{(?:hostedUrl|localUrl|hostUrl)\}\}/u, "")
    .split("?")[0];
  return `${item.request.method.toUpperCase()} ${route}`;
}

function applyHostedNames(
  items: readonly PostmanItem[],
  overrides: Readonly<Record<string, string>>,
): void {
  for (const item of items) {
    const key = requestKey(item);
    if (key !== undefined && overrides[key] !== undefined) {
      item.name = overrides[key];
    }
    if (item.item !== undefined) applyHostedNames(item.item, overrides);
  }
}

function cloneForTarget(
  items: readonly PostmanItem[],
  targetVariable: "hostedUrl" | "localUrl",
): PostmanItem[] {
  return JSON.parse(
    JSON.stringify(items).replaceAll("{{hostUrl}}", `{{${targetVariable}}}`),
  ) as PostmanItem[];
}

export function createTargetFolders(
  baseItems: readonly PostmanItem[],
  options: TargetFoldersOptions = {},
): readonly PostmanItem[] {
  const hostedItems = cloneForTarget(baseItems, "hostedUrl");
  applyHostedNames(hostedItems, options.hostedNameOverrides ?? {});
  return [
    {
      name: "Hosted",
      item: hostedItems,
    },
    {
      name: "Local",
      item: cloneForTarget(baseItems, "localUrl"),
    },
  ];
}
