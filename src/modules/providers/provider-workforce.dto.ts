import type {
  SafeHistoryFacts,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerSnapshot,
} from "./domain/provider-workforce.types.js";
import { WorkforcePolicyError } from "./domain/provider-workforce.policy.js";

const forbiddenKeys = /(?:phone|email|proof|password|otp|cookie|token|credential|storage.?key)/iu;

export function assertSafeWorkforceFacts(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKeys.test(key)) throw new WorkforcePolicyError("WORKFORCE_HISTORY_UNSAFE");
    assertSafeWorkforceFacts(nested);
  }
}

export function mapWorkerListItem(worker: WorkerSnapshot, currentTeamId: string | null = null) {
  return {
    workerId: worker.id,
    providerId: worker.providerId,
    fullLegalName: worker.profile.fullLegalName,
    gender: worker.profile.gender === "MALE" ? "male" as const : "female" as const,
    workerType: worker.profile.workerType,
    displayTitle: worker.profile.displayTitle,
    operationalStatus: worker.status,
    supervisorCapable: worker.profile.supervisorCapable,
    currentTeamId,
    workerVersion: worker.version,
    profileVersion: worker.profile.version,
  };
}

export function mapWorkerPrivateDto(
  worker: WorkerSnapshot,
  avatar: { readonly url: string; readonly expiresAt: string } | null = null,
) {
  return {
    viewScope: "PROVIDER_MANAGEMENT" as const,
    worker: mapWorkerListItem(worker),
    operationalPhoneE164: worker.profile.operationalPhoneE164,
    skills: worker.profile.skills,
    loginAccessStatus: worker.access?.status ?? null,
    avatar,
  };
}

export function mapWorkerSupervisorDto(worker: WorkerSnapshot, member: TeamMemberSnapshot) {
  return {
    viewScope: "PRIMARY_SUPERVISOR" as const,
    workerId: worker.id,
    providerId: worker.providerId,
    teamId: member.teamId,
    fullLegalName: worker.profile.fullLegalName,
    gender: worker.profile.gender === "MALE" ? "male" as const : "female" as const,
    workerType: worker.profile.workerType,
    displayTitle: worker.profile.displayTitle,
    operationalPhoneE164: worker.profile.operationalPhoneE164,
    cleans: member.cleans,
    membershipVersion: member.version,
  };
}

export function mapWorkerSelfDto(
  worker: WorkerSnapshot,
  avatar: { readonly url: string; readonly expiresAt: string } | null = null,
) {
  return { ...mapWorkerPrivateDto(worker, avatar), viewScope: "SELF" as const };
}

export function mapBookingSafeMemberFact(member: TeamMemberSnapshot) {
  return {
    workerId: member.workerId,
    gender: member.worker.profile.gender === "MALE" ? "male" as const : "female" as const,
    workerType: member.worker.profile.workerType,
    cleans: member.cleans,
  };
}

export function mapTeamDto(team: TeamSnapshot, members: readonly TeamMemberSnapshot[]) {
  return {
    id: team.id,
    providerId: team.providerId,
    name: team.name,
    status: team.status,
    primarySupervisorWorkerId: team.primarySupervisorWorkerId,
    version: team.version,
    members: members.map((member) => ({
      id: member.id,
      workerId: member.workerId,
      cleans: member.cleans,
      version: member.version,
    })),
  };
}

export function sanitizeHistoryFacts(facts: SafeHistoryFacts | undefined): SafeHistoryFacts | undefined {
  if (facts === undefined) return undefined;
  assertSafeWorkforceFacts(facts);
  return { ...facts };
}
