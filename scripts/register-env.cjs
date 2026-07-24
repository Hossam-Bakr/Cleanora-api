"use strict";

const { existsSync, readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const envPath = resolve(process.cwd(), ".env");
if (!existsSync(envPath)) {
  return;
}

const content = readFileSync(envPath, "utf8");
for (const rawLine of content.split(/\r?\n/u)) {
  const line = rawLine.trim();
  if (line.length === 0 || line.startsWith("#")) {
    continue;
  }

  const separatorIndex = line.indexOf("=");
  if (separatorIndex <= 0) {
    continue;
  }

  const key = line.slice(0, separatorIndex).trim();
  let value = line.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}
