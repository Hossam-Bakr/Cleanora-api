
import type {
  ProvidersWorkforceTransactionContext,
  ProvidersWorkforceUnitOfWorkPort,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "../../src/modules/providers/domain/provider-workforce.types.js";
import { WorkforcePolicyError } from "../../src/modules/providers/domain/provider-workforce.policy.js";
import { ProviderTeamMembershipService } from "../../src/modules/providers/provider-team-membership.service.js";

const worker: WorkerSnapshot = {
  id: "worker-final-cleaner",
  providerId: "provider-1",
  identityUserId: "worker-user-1",
  predecessorWorkerId: null,
  status: "ACTIVE",
  version: 3,
  acceptedInvitationLocale: "EN",
  endedAt: null,
  profile: {
    fullLegalName: "Final Cleaner",
    gender: "FEMALE",
    operationalPhoneE164: "+201011111111",
    workerType: "CLEANING_STAFF",
    displayTitle: null,
    supervisorCapable: false,
    skills: [],
    avatarMediaFileId: null,
    version: 1,
  },
  access: { status: "ACTIVE", version: 1, currentInvitationId: "invitation-1" },
};

const initialTeam: TeamSnapshot = {
  id: "team-1",
  providerId: "provider-1",
  name: "Atomic Crew",
  normalizedName: "atomic crew",
  status: "ACTIVE",
  primarySupervisorWorkerId: null,
  version: 4,
};

const initialMembership: TeamMemberSnapshot = {
  id: "membership-final-cleaner",
  teamId: initialTeam.id,
  workerId: worker.id,
  cleans: true,
  version: 2,
  endedAt: null,
  worker,
};

interface HarnessState {
  team: TeamSnapshot;
  membership: TeamMemberSnapshot;
  histories: Array<Record<string, unknown>>;
  audits: Array<Record<string, unknown>>;
  accepted: Array<Record<string, unknown>>;
}

export const finalCleanerCommand = {
  actorUserId: "owner-1",
  providerId: "provider-1",
  teamId: "team-1",
  workerId: worker.id,
  action: "UPDATE_CLEANS" as const,
  membershipId: initialMembership.id,
  cleans: false,
  expectedVersion: initialTeam.version,
  expectedWorkerVersion: worker.version,
  expectedMembershipVersion: initialMembership.version,
  confirmLastCleanerImpact: true,
  requestId: "00000000-0000-4000-8000-000000000761",
  idempotencyKey: "00000000-0000-4000-8000-000000000762",
};

export function createFinalCleanerHarness(options: {
  readonly failHistoryAt?: number;
  readonly serializeTransactions?: boolean;
} = {}) {
  let state: HarnessState = {
    team: structuredClone(initialTeam),
    membership: structuredClone(initialMembership),
    histories: [],
    audits: [],
    accepted: [],
  };
  let historyAttempts = 0;
  let transactionTail: Promise<unknown> = Promise.resolve();

  const execute = async <T>(callback: (context: ProvidersWorkforceTransactionContext) => Promise<T>): Promise<T> => {
    const before = structuredClone(state);
    const context = {
      workforce: {
        lockProvider: vi.fn(async () => ({ id: "provider-1", workforceStateVersion: 1 })),
        lockWorker: vi.fn(async () => worker),
        lockTeam: vi.fn(async (_providerId: string, teamId: string) => teamId === state.team.id ? state.team : null),
        readActorMembership: vi.fn(async () => ({ level: "OWNER" as const, active: true, version: 1 })),
        getWorker: vi.fn(async () => worker),
        getMembership: vi.fn(async (_teamId: string, membershipId: string) => membershipId === state.membership.id ? state.membership : null),
        getCurrentMembershipForWorker: vi.fn(async () => state.membership.endedAt === null ? state.membership : null),
        listCurrentTeamMembers: vi.fn(async () => state.membership.endedAt === null ? [state.membership] : []),
        updateMembership: vi.fn(async (input: {
          readonly expectedMembershipVersion: number;
          readonly expectedTeamVersion?: number;
          readonly cleans?: boolean;
          readonly endedAt?: Date;
        }) => {
          if (state.membership.version !== input.expectedMembershipVersion
            || (input.expectedTeamVersion !== undefined && state.team.version !== input.expectedTeamVersion)) {
            throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
          }
          if (input.expectedTeamVersion !== undefined) state.team = { ...state.team, version: state.team.version + 1 };
          state.membership = {
            ...state.membership,
            ...(input.cleans === undefined ? {} : { cleans: input.cleans }),
            ...(input.endedAt === undefined ? {} : { endedAt: input.endedAt }),
            version: state.membership.version + 1,
          };
          return state.membership;
        }),
        updateTeam: vi.fn(async (input: { readonly expectedVersion: number; readonly status?: TeamSnapshot["status"] }) => {
          if (state.team.version !== input.expectedVersion) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
          state.team = {
            ...state.team,
            ...(input.status === undefined ? {} : { status: input.status }),
            version: state.team.version + 1,
          };
          return state.team;
        }),
      },
      commands: {
        begin: vi.fn(async () => ({ replay: false, result: null })),
        accept: vi.fn(async (input) => { state.accepted.push(structuredClone(input)); }),
      },
      history: {
        append: vi.fn(async (input) => {
          historyAttempts += 1;
          if (historyAttempts === options.failHistoryAt) throw new Error("synthetic history failure");
          state.histories.push(structuredClone(input));
          return { id: `history-${state.histories.length}` };
        }),
      },
      audit: {
        append: vi.fn(async (input) => {
          state.audits.push(structuredClone(input));
          return { id: `audit-${state.audits.length}`, createdAt: new Date().toISOString() };
        }),
      },
    } as unknown as ProvidersWorkforceTransactionContext;
    try {
      return await callback(context);
    } catch (error: unknown) {
      state = before;
      throw error;
    }
  };

  const unitOfWork: ProvidersWorkforceUnitOfWorkPort = {
    run<T>(callback: (context: ProvidersWorkforceTransactionContext) => Promise<T>): Promise<T> {
      if (options.serializeTransactions !== true) return execute(callback);
      const result = transactionTail.then(() => execute(callback));
      transactionTail = result.catch(() => undefined);
      return result;
    },
  };

  return {
    service: new ProviderTeamMembershipService({ unitOfWork }),
    state: () => structuredClone(state),
  };
}
