
import {
  assertWorkerAccessTransition,
  assertWorkerTransition,
} from "../../../src/modules/providers/domain/provider-workforce.policy.js";
import type {
  WorkerLoginAccessStatus,
  WorkerOperationalStatus,
} from "../../../src/modules/providers/domain/provider-workforce.types.js";

function acceptsWorker(from: WorkerOperationalStatus, to: WorkerOperationalStatus): boolean {
  try { assertWorkerTransition(from, to); return true; } catch { return false; }
}

function acceptsAccess(from: WorkerLoginAccessStatus | null, to: WorkerLoginAccessStatus): boolean {
  try { assertWorkerAccessTransition(from, to); return true; } catch { return false; }
}

describe("Worker and login-access transition matrices", () => {
  it("accepts exactly DRAFT -> ACTIVE <-> INACTIVE and terminal removal", () => {
    expect([
      ["DRAFT", "ACTIVE"],
      ["DRAFT", "REMOVED"],
      ["ACTIVE", "INACTIVE"],
      ["ACTIVE", "REMOVED"],
      ["INACTIVE", "ACTIVE"],
      ["INACTIVE", "REMOVED"],
    ].every(([from, to]) => acceptsWorker(from as WorkerOperationalStatus, to as WorkerOperationalStatus))).toBe(true);
    expect(acceptsWorker("REMOVED", "ACTIVE")).toBe(false);
    expect(acceptsWorker("DRAFT", "INACTIVE")).toBe(false);
    expect(acceptsWorker("ACTIVE", "DRAFT")).toBe(false);
    expect(acceptsWorker("ACTIVE", "ACTIVE")).toBe(false);
  });

  it("keeps access independent and accepts only the approved invitation/access matrix", () => {
    expect(acceptsAccess(null, "INVITED")).toBe(true);
    expect(acceptsAccess("INVITED", "ACTIVE")).toBe(true);
    expect(acceptsAccess("INVITED", "EXPIRED")).toBe(true);
    expect(acceptsAccess("INVITED", "REVOKED")).toBe(true);
    expect(acceptsAccess("EXPIRED", "INVITED")).toBe(true);
    expect(acceptsAccess("REVOKED", "INVITED")).toBe(true);
    expect(acceptsAccess("ACTIVE", "REVOKED")).toBe(true);
    expect(acceptsAccess("ACTIVE", "EXPIRED")).toBe(false);
    expect(acceptsAccess("REVOKED", "ACTIVE")).toBe(false);
    expect(acceptsAccess("ACTIVE", "ACTIVE")).toBe(false);
  });
});
