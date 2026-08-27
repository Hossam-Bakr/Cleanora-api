
import {
  buildImplementedR1P07SwaggerFragments,
  R1_P07_IMPLEMENTED_OPERATION_IDS,
} from "../../../src/swagger/r1-p07-openapi.paths.js";

describe("R1-P07 runtime OpenAPI fragments", () => {
  it("selects exactly the implemented Worker, Team, readiness, and invitation operations", () => {
    const fragments = buildImplementedR1P07SwaggerFragments();
    expect(fragments.operationIds).toEqual([...R1_P07_IMPLEMENTED_OPERATION_IDS].sort());
    expect(Object.keys(fragments.paths)).toEqual([
      "/providers/{providerId}/workers",
      "/providers/{providerId}/workers/{workerId}",
      "/providers/{providerId}/workers/{workerId}/avatar",
      "/providers/{providerId}/workers/{workerId}/lifecycle-commands",
      "/providers/{providerId}/workers/{workerId}/login-access-commands",
      "/providers/{providerId}/workers/{workerId}/admin-membership-commands",
      "/providers/{providerId}/workers/{workerId}/history",
      "/providers/{providerId}/teams",
      "/providers/{providerId}/teams/{teamId}",
      "/providers/{providerId}/teams/{teamId}/lifecycle-commands",
      "/providers/{providerId}/teams/{teamId}/membership-commands",
      "/providers/{providerId}/teams/{teamId}/supervisor-commands",
      "/providers/{providerId}/teams/{teamId}/history",
      "/providers/{providerId}/workforce-readiness",
      "/workers/me",
      "/workers/me/leave",
      "/worker-invitations/inspect",
      "/worker-invitations/onboarding/start",
      "/worker-invitations/onboarding/verify-email",
      "/worker-invitations/accept",
    ]);
    expect(fragments.schemas["AvatarUploadInput"]).toBeDefined();
    expect(fragments.responses["WorkerPrivate"]).toBeDefined();
    expect(fragments.schemas["InvitationAcceptInput"]).toBeDefined();
    expect(fragments.responses["OnboardingVerify"]).toBeDefined();
    expect(fragments.paths["/providers/{providerId}/teams"]?.["post"]).toEqual(
      expect.objectContaining({ responses: expect.objectContaining({ "201": { $ref: "#/components/responses/Command" } }) }),
    );
    expect(fragments.paths["/providers/{providerId}/teams/{teamId}"]?.["put"]).toEqual(
      expect.objectContaining({ responses: expect.objectContaining({ "200": { $ref: "#/components/responses/Command" } }) }),
    );
    expect(fragments.privateCacheControl).toBe("no-store, private");
  });

  it("fails closed when a requested operation id is absent from the design contract", () => {
    expect(() => buildImplementedR1P07SwaggerFragments([
      "notARealR1P07Operation" as never,
    ])).toThrow("inventory drift");
  });
});
