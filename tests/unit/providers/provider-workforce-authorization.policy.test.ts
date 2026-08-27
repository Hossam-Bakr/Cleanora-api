
import {
  decideWorkforceAuthorization,
  type WorkforceAuthorizationFacts,
  type WorkforceAuthorizationOperation,
} from "../../../src/modules/providers/domain/provider-workforce-authorization.policy.js";

const actors = {
  owner: { managementLevel: "OWNER", sameProvider: true, isSelf: false, isPrimarySupervisor: false, targetIsCurrentTeamMember: false },
  admin: { managementLevel: "ADMIN", sameProvider: true, isSelf: false, isPrimarySupervisor: false, targetIsCurrentTeamMember: false },
  supervisor: { managementLevel: null, sameProvider: true, isSelf: false, isPrimarySupervisor: true, targetIsCurrentTeamMember: true },
  self: { managementLevel: null, sameProvider: true, isSelf: true, isPrimarySupervisor: false, targetIsCurrentTeamMember: false },
  other: { managementLevel: null, sameProvider: true, isSelf: false, isPrimarySupervisor: false, targetIsCurrentTeamMember: false },
  crossProvider: { managementLevel: "OWNER", sameProvider: false, isSelf: false, isPrimarySupervisor: false, targetIsCurrentTeamMember: false },
} as const satisfies Readonly<Record<string, WorkforceAuthorizationFacts>>;

const matrix: Readonly<Record<WorkforceAuthorizationOperation, readonly (keyof typeof actors)[]>> = {
  LIST_WORKFORCE: ["owner", "admin", "supervisor"],
  READ_WORKER: ["owner", "admin", "supervisor", "self"],
  CREATE_OR_EDIT_WORKER: ["owner", "admin"],
  MANAGE_WORKER_LIFECYCLE: ["owner", "admin"],
  REMOVE_WORKER: ["owner"],
  MANAGE_LOGIN_ACCESS: ["owner"],
  MANAGE_ADMIN_MEMBERSHIP: ["owner"],
  LEAVE_PROVIDER: ["self"],
  MANAGE_TEAM: ["owner", "admin"],
  UPDATE_TEAM_CLEANS: ["owner", "admin", "supervisor"],
  CONFIRM_FINAL_CLEANER: ["owner", "admin"],
  READ_HISTORY: ["owner", "admin"],
  READ_READINESS: ["owner", "admin"],
};

describe("R1-P07 deny-by-default authorization matrix", () => {
  for (const [operation, allowedActors] of Object.entries(matrix) as Array<[WorkforceAuthorizationOperation, readonly (keyof typeof actors)[]]>) {
    it(`${operation} matches exact approved scopes`, () => {
      for (const [actorName, facts] of Object.entries(actors) as Array<[keyof typeof actors, WorkforceAuthorizationFacts]>) {
        expect(decideWorkforceAuthorization(operation, facts).allowed, actorName)
          .toBe(allowedActors.includes(actorName));
      }
    });
  }

  it("removes Supervisor authority immediately outside the current Team/member join", () => {
    expect(decideWorkforceAuthorization("READ_WORKER", { ...actors.supervisor, targetIsCurrentTeamMember: false }))
      .toEqual({ allowed: false, scope: "NONE" });
    expect(decideWorkforceAuthorization("UPDATE_TEAM_CLEANS", { ...actors.supervisor, isPrimarySupervisor: false }))
      .toEqual({ allowed: false, scope: "NONE" });
  });
});
