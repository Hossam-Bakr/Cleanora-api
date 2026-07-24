import { describe, expect, it } from "vitest";

import { createRedisKey } from "../../../src/core/cache/redis-key.js";
import {
  DEFAULT_JOB_POLICY,
  QUEUE_NAME_PREFIX
} from "../../../src/core/queues/queue-policy.js";
import { PAYMOB_PROVIDER_NAME } from "../../../src/core/payments/paymob.contracts.js";
import { assertNever } from "../../../src/shared/utils/assert-never.js";

describe("foundation utilities", () => {
  it("creates namespaced Redis keys from safe lowercase segments", () => {
    expect(createRedisKey("auth", "session", "user_1")).toBe(
      "cleanora:auth:session:user_1"
    );
  });

  it("rejects unsafe Redis key segments", () => {
    expect(() => createRedisKey("Auth", "session")).toThrow(
      /lowercase and namespaced/
    );
  });

  it("exposes deterministic queue and provider constants", () => {
    expect(DEFAULT_JOB_POLICY).toEqual({
      attempts: 5,
      backoffMilliseconds: 1_000
    });
    expect(QUEUE_NAME_PREFIX).toBe("cleanora");
    expect(PAYMOB_PROVIDER_NAME).toBe("paymob");
  });

  it("throws when an impossible branch reaches assertNever", () => {
    expect(() =>
      assertNever("unexpected" as never, "Unexpected state")
    ).toThrow("Unexpected state: unexpected");
  });
});
