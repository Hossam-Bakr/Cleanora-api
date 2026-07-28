import { randomBytes } from "node:crypto";
import type { Router } from "express";

import { cleanoraOpenApiDocument } from "./openapi.document.js";

const express = require("express") as typeof import("express");

const SWAGGER_UI_VERSION = "5.17.14";

function swaggerHtml(openApiUrl: string, scriptNonce: string): string {
  const serializedUrl = JSON.stringify(openApiUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Cleanora professional interactive API documentation" />
    <title>Cleanora API Documentation</title>
    <link rel="icon" href="data:," />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui.css" />
    <style>
      :root { color-scheme: light; --cleanora-green: #0f766e; --cleanora-ink: #102a2e; --cleanora-bg: #f4f8f7; }
      html { box-sizing: border-box; background: var(--cleanora-bg); }
      *, *::before, *::after { box-sizing: inherit; }
      body { margin: 0; background: var(--cleanora-bg); color: var(--cleanora-ink); }
      .cleanora-header { background: linear-gradient(120deg, #0b4f4a, #0f766e); color: white; padding: 24px max(24px, calc((100vw - 1240px) / 2)); box-shadow: 0 8px 30px rgba(15, 118, 110, .2); }
      .cleanora-header__eyebrow { font: 700 12px/1.4 system-ui, sans-serif; letter-spacing: .14em; text-transform: uppercase; opacity: .78; }
      .cleanora-header h1 { margin: 6px 0 4px; font: 700 28px/1.2 system-ui, sans-serif; }
      .cleanora-header p { margin: 0; max-width: 760px; font: 400 14px/1.6 system-ui, sans-serif; opacity: .88; }
      .swagger-ui .topbar { display: none; }
      .swagger-ui .information-container { padding-top: 28px; }
      .swagger-ui .info { margin: 28px 0 34px; }
      .swagger-ui .info .title { color: var(--cleanora-ink); }
      .swagger-ui .scheme-container { background: white; box-shadow: 0 8px 24px rgba(16, 42, 46, .08); border-radius: 12px; }
      .swagger-ui .opblock-tag { color: var(--cleanora-ink); }
      .swagger-ui .opblock { border-radius: 10px; overflow: hidden; box-shadow: 0 4px 18px rgba(16, 42, 46, .06); }
      .swagger-ui .btn.authorize { color: var(--cleanora-green); border-color: var(--cleanora-green); }
      .swagger-ui .btn.authorize svg { fill: var(--cleanora-green); }
      .swagger-ui select { border-radius: 6px; }
    </style>
  </head>
  <body>
    <header class="cleanora-header">
      <div class="cleanora-header__eyebrow">Release 1 | Living API Contract</div>
      <h1>Cleanora API Documentation</h1>
      <p>Interactive, security-aware documentation for system health, authentication, sessions, recovery, verification, and Google identity.</p>
    </header>
    <main id="swagger-ui" aria-label="Interactive API documentation"></main>
    <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@${SWAGGER_UI_VERSION}/swagger-ui-standalone-preset.js"></script>
    <script nonce="${scriptNonce}">
      window.addEventListener("load", function () {
        window.ui = SwaggerUIBundle({
          url: ${serializedUrl},
          dom_id: "#swagger-ui",
          deepLinking: true,
          filter: true,
          displayRequestDuration: true,
          docExpansion: "list",
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 2,
          operationsSorter: "alpha",
          tagsSorter: "alpha",
          persistAuthorization: false,
          tryItOutEnabled: true,
          validatorUrl: null,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "StandaloneLayout"
        });
      });
    </script>
  </body>
</html>`;
}

function setSwaggerContentSecurityPolicy(
  response: import("express").Response,
  scriptNonce: string,
) {
  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      `script-src 'self' https://unpkg.com 'nonce-${scriptNonce}'`,
      "style-src 'self' 'unsafe-inline' https://unpkg.com",
      "img-src 'self' data:",
      "font-src 'self' https://unpkg.com",
      "connect-src 'self'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
  );
}

/**
 * @desc         Create the public read-only Swagger documentation router.
 * @route        GET /api/v1/docs and GET /api/v1/docs/openapi.json
 * @access       Public
 * @explanation  Serves interactive documentation and its machine-readable
 *               OpenAPI contract without exposing runtime secrets.
 */
export function createSwaggerRouter(apiPrefix: string): Router {
  const router = express.Router();
  const openApiUrl = `${apiPrefix}/docs/openapi.json`;

  router.get("/openapi.json", (_request, response) => {
    response.setHeader("Cache-Control", "public, max-age=300");
    response.type("application/json").send(cleanoraOpenApiDocument);
  });

  router.get("/", (_request, response) => {
    const scriptNonce = randomBytes(18).toString("base64");
    setSwaggerContentSecurityPolicy(response, scriptNonce);
    response.setHeader("Cache-Control", "no-store");
    response.type("html").send(swaggerHtml(openApiUrl, scriptNonce));
  });

  return router;
}
