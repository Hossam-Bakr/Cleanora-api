import { describe, expect, it, vi } from "vitest";

import { registerModules } from "../../../src/routes/register-modules.js";

const express = require("express") as typeof import("express");

describe("registerModules", () => {
  it("registers each uniquely named module once", () => {
    const app = express();
    const first = vi.fn();
    const second = vi.fn();

    registerModules(app, [
      { name: "first", register: first },
      { name: "second", register: second }
    ]);

    expect(first).toHaveBeenCalledWith(app);
    expect(second).toHaveBeenCalledWith(app);
  });

  it("rejects duplicate module registration names", () => {
    const app = express();

    expect(() =>
      registerModules(app, [
        { name: "duplicate", register: vi.fn() },
        { name: "duplicate", register: vi.fn() }
      ])
    ).toThrow("Duplicate module registration: duplicate");
  });
});
