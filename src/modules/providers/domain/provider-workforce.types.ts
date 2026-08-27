export const WORKER_OPERATIONAL_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "REMOVED"] as const;
export type WorkerOperationalStatus = (typeof WORKER_OPERATIONAL_STATUSES)[number];

export const WORKER_LOGIN_ACCESS_STATUSES = ["INVITED", "ACTIVE", "EXPIRED", "REVOKED"] as const;
export type WorkerLoginAccessStatus = (typeof WORKER_LOGIN_ACCESS_STATUSES)[number];

export const WORKER_INVITATION_STATUSES = ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED", "SUPERSEDED"] as const;
export type WorkerInvitationStatus = (typeof WORKER_INVITATION_STATUSES)[number];

export const PROVIDER_TEAM_STATUSES = ["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"] as const;
export type ProviderTeamStatus = (typeof PROVIDER_TEAM_STATUSES)[number];

export type WorkerGender = "MALE" | "FEMALE";
export type WorkerType = "CLEANING_STAFF" | "ESCORT" | "OTHER";
export type WorkforceLocale = "AR" | "EN";
export type WorkforceActorKind = "OWNER" | "ADMIN" | "SUPERVISOR" | "SELF";

export type WorkerDeactivationReason =
  | "TEMPORARILY_UNAVAILABLE"
  | "SCHEDULE_OR_LEAVE"
  | "PERFORMANCE_OR_POLICY"
  | "PROVIDER_OPERATIONAL_CHANGE"
  | "OTHER";
export type WorkerRemovalReason =
  | "ENGAGEMENT_ENDED"
  | "PERFORMANCE_OR_POLICY"
  | "DUPLICATE_OR_INCORRECT_RECORD"
  | "OTHER";
export type WorkerAccessRevocationReason =
  | "SECURITY_CONCERN"
  | "ACCESS_NO_LONGER_REQUIRED"
  | "ENGAGEMENT_ENDED"
  | "OTHER";
export type ProviderAdminGrantReason =
  | "OPERATIONAL_RESPONSIBILITY"
  | "COVERAGE_OR_BACKUP"
  | "OTHER";
export type ProviderAdminRevocationReason =
  | "RESPONSIBILITY_ENDED"
  | "SECURITY_CONCERN"
  | "ENGAGEMENT_ENDED"
  | "OTHER";

export interface WorkforceCommandMeta {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
}

export interface VersionedWorkforceCommand extends WorkforceCommandMeta {
  readonly expectedVersion: number;
}

export interface WorkerProfileInput {
  readonly fullLegalName: string;
  readonly gender: WorkerGender;
  readonly operationalPhoneE164: string;
  readonly workerType: WorkerType;
  readonly displayTitle: string | null;
  readonly supervisorCapable: boolean;
  readonly skills: readonly string[];
}

export interface WorkerSnapshot {
  readonly id: string;
  readonly providerId: string;
  readonly identityUserId: string | null;
  readonly predecessorWorkerId: string | null;
  readonly status: WorkerOperationalStatus;
  readonly version: number;
  readonly acceptedInvitationLocale: WorkforceLocale | null;
  readonly endedAt: Date | null;
  readonly profile: WorkerProfileSnapshot;
  readonly access: WorkerAccessSnapshot | null;
}

export interface WorkerProfileSnapshot extends WorkerProfileInput {
  readonly version: number;
  readonly avatarMediaFileId: string | null;
}

export interface WorkerAccessSnapshot {
  readonly status: WorkerLoginAccessStatus;
  readonly version: number;
  readonly currentInvitationId: string | null;
}

export interface WorkerInvitationSnapshot {
  readonly id: string;
  readonly workerId: string;
  readonly invitationVersion: number;
  readonly emailNormalized: string;
  readonly locale: WorkforceLocale;
  readonly status: WorkerInvitationStatus;
  readonly version: number;
  readonly issuedByUserId: string;
  readonly acceptedByUserId: string | null;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly expiredAt: Date | null;
  readonly supersededAt: Date | null;
}

export interface ProviderAdminMembershipSnapshot {
  readonly id: string;
  readonly providerId: string;
  readonly userId: string;
  readonly level: "OWNER" | "ADMIN";
  readonly active: boolean;
  readonly version: number;
}

export interface TeamSnapshot {
  readonly id: string;
  readonly providerId: string;
  readonly name: string | null;
  readonly normalizedName: string | null;
  readonly status: ProviderTeamStatus;
  readonly primarySupervisorWorkerId: string | null;
  readonly version: number;
}

export interface TeamMemberSnapshot {
  readonly id: string;
  readonly teamId: string;
  readonly workerId: string;
  readonly cleans: boolean;
  readonly version: number;
  readonly endedAt: Date | null;
  readonly worker: WorkerSnapshot;
}

export interface WorkforceImpact {
  readonly teamId: string;
  readonly teamVersion: number;
  readonly teamWillBecomeInactive: boolean;
  readonly workersReadyWillBecomeFalse: boolean;
}

export interface SafeHistoryFacts {
  readonly status?: string;
  readonly version?: number;
  readonly workerType?: WorkerType;
  readonly cleans?: boolean;
  readonly teamId?: string | null;
  readonly predecessorWorkerId?: string | null;
  readonly locale?: WorkforceLocale;
}

export interface WorkforceHistoryInput {
  readonly providerId: string;
  readonly targetType:
    | "WORKER"
    | "WORKER_PROFILE"
    | "LOGIN_ACCESS"
    | "INVITATION"
    | "ADMIN_MEMBERSHIP"
    | "TEAM"
    | "TEAM_MEMBERSHIP"
    | "PRIMARY_SUPERVISOR"
    | "READINESS";
  readonly targetId: string;
  readonly targetVersion: number;
  readonly eventCode: string;
  readonly actorUserId: string;
  readonly reasonCode?: string;
  readonly note?: string;
  readonly safeBefore?: SafeHistoryFacts;
  readonly safeAfter?: SafeHistoryFacts;
  readonly requestId: string;
}

export interface WorkforceHistorySnapshot extends WorkforceHistoryInput {
  readonly id: string;
  readonly createdAt: Date;
}

export interface WorkforceNotificationIntentInput {
  readonly providerId: string;
  readonly template:
    | "INVITATION_ISSUED"
    | "LOGIN_ACCESS_ACTIVATED"
    | "LOGIN_ACCESS_RESET"
    | "LOGIN_ACCESS_REVOKED"
    | "WORKER_ACTIVATED"
    | "WORKER_DEACTIVATED"
    | "WORKER_REMOVED"
    | "WORKER_DEPARTED"
    | "PROVIDER_ADMIN_GRANTED"
    | "PROVIDER_ADMIN_REVOKED";
  readonly locale: WorkforceLocale;
  readonly recipientUserId?: string;
  readonly recipientEmailNormalized?: string;
  readonly invitationId?: string;
  readonly historyId?: string;
  readonly safeVariables: Readonly<Record<string, string | number | boolean | null>>;
  readonly idempotencyKey: string;
}

export type WorkforceSafeResult = Readonly<Record<string, unknown>>;

export interface WorkforceCommandRecord {
  readonly requestFingerprint: string;
  readonly status: "IN_PROGRESS" | "ACCEPTED";
  readonly safeResult: WorkforceSafeResult | null;
}

export interface ProviderWorkforceRepositoryPort {
  lockProvider(providerId: string): Promise<{ readonly id: string; readonly workforceStateVersion: number } | null>;
  getProviderOwnerUserId(providerId: string): Promise<string | null>;
  readActorMembership(providerId: string, actorUserId: string): Promise<{ readonly level: "OWNER" | "ADMIN"; readonly active: boolean; readonly version: number } | null>;
  lockWorker(providerId: string, workerId: string): Promise<WorkerSnapshot | null>;
  getWorker(providerId: string, workerId: string): Promise<WorkerSnapshot | null>;
  getCurrentWorkerByIdentity(identityUserId: string): Promise<WorkerSnapshot | null>;
  getLatestWorkerByIdentity(identityUserId: string): Promise<WorkerSnapshot | null>;
  getLatestRemovedWorkerByIdentity(providerId: string, identityUserId: string): Promise<WorkerSnapshot | null>;
  listWorkers(providerId: string, limit: number, cursor?: string): Promise<readonly WorkerSnapshot[]>;
  createWorker(input: WorkforceCommandMeta & { readonly expectedProviderVersion: number; readonly workerId: string; readonly profile: WorkerProfileInput; readonly predecessorWorkerId?: string }): Promise<WorkerSnapshot>;
  replaceWorkerProfile(input: VersionedWorkforceCommand & { readonly workerId: string; readonly expectedProfileVersion: number; readonly profile: WorkerProfileInput }): Promise<WorkerSnapshot>;
  setWorkerAvatar(input: WorkforceCommandMeta & {
    readonly workerId: string;
    readonly expectedProfileVersion: number;
    readonly mediaFileId: string | null;
  }): Promise<WorkerSnapshot>;
  getCurrentMembershipForWorker(workerId: string): Promise<TeamMemberSnapshot | null>;
  setWorkerStatus(input: VersionedWorkforceCommand & { readonly workerId: string; readonly status: WorkerOperationalStatus; readonly endedAt?: Date | null }): Promise<WorkerSnapshot>;
  setWorkerAccessStatus(input: WorkforceCommandMeta & {
    readonly workerId: string;
    readonly expectedAccessVersion: number;
    readonly status: "ACTIVE" | "REVOKED";
    readonly transitionedAt: Date;
  }): Promise<WorkerSnapshot>;
  listReadinessCandidates(providerId: string): Promise<readonly WorkerSnapshot[]>;
  countActiveAccessForIdentity(identityUserId: string): Promise<number>;
  lockProviderMember(providerId: string, userId: string): Promise<ProviderAdminMembershipSnapshot | null>;
  setProviderAdminMembership(input: WorkforceCommandMeta & {
    readonly userId: string;
    readonly expectedMembershipVersion: number | null;
    readonly active: boolean;
    readonly changedAt: Date;
  }): Promise<ProviderAdminMembershipSnapshot>;
  countActiveAdminMemberships(userId: string): Promise<number>;
  getInvitation(invitationId: string): Promise<WorkerInvitationSnapshot | null>;
  getWorkerForInvitation(invitationId: string): Promise<WorkerSnapshot | null>;
  getLatestInvitation(workerId: string): Promise<WorkerInvitationSnapshot | null>;
  issueInvitation(input: WorkforceCommandMeta & {
    readonly workerId: string;
    readonly expectedWorkerVersion: number;
    readonly expectedAccessVersion: number | null;
    readonly invitationId: string;
    readonly invitationVersion: number;
    readonly emailNormalized: string;
    readonly locale: WorkforceLocale;
    readonly issuedAt: Date;
    readonly expiresAt: Date;
  }): Promise<{ readonly worker: WorkerSnapshot; readonly invitation: WorkerInvitationSnapshot }>;
  transitionInvitation(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly invitationId: string;
    readonly expectedInvitationVersion: number;
    readonly expectedAccessVersion: number;
    readonly status: "EXPIRED" | "REVOKED";
    readonly transitionedAt: Date;
  }): Promise<{ readonly worker: WorkerSnapshot; readonly invitation: WorkerInvitationSnapshot }>;
  acceptInvitation(input: WorkforceCommandMeta & {
    readonly workerId: string;
    readonly invitationId: string;
    readonly expectedInvitationVersion: number;
    readonly expectedWorkerVersion: number;
    readonly expectedAccessVersion: number;
    readonly identityUserId: string;
    readonly predecessorWorkerId: string | null;
    readonly operationalPhoneE164: string;
    readonly acceptedLocale: WorkforceLocale;
    readonly acceptedAt: Date;
  }): Promise<{ readonly worker: WorkerSnapshot; readonly invitation: WorkerInvitationSnapshot }>;
  getTeam(providerId: string, teamId: string): Promise<TeamSnapshot | null>;
  lockTeam(providerId: string, teamId: string): Promise<TeamSnapshot | null>;
  listTeams(providerId: string, limit: number, cursor?: string): Promise<readonly TeamSnapshot[]>;
  listCurrentTeamMembers(teamId: string): Promise<readonly TeamMemberSnapshot[]>;
  getMembership(teamId: string, membershipId: string): Promise<TeamMemberSnapshot | null>;
  createTeam(input: WorkforceCommandMeta & { readonly expectedProviderVersion: number; readonly teamId: string; readonly name: string | null; readonly normalizedName: string | null }): Promise<TeamSnapshot>;
  updateTeam(input: VersionedWorkforceCommand & { readonly teamId: string; readonly name?: string | null; readonly normalizedName?: string | null; readonly status?: ProviderTeamStatus; readonly primarySupervisorWorkerId?: string | null }): Promise<TeamSnapshot>;
  addMembership(input: VersionedWorkforceCommand & { readonly teamId: string; readonly workerId: string; readonly membershipId: string; readonly cleans: boolean }): Promise<TeamMemberSnapshot>;
  updateMembership(input: WorkforceCommandMeta & {
    readonly teamId: string;
    readonly membershipId: string;
    readonly expectedMembershipVersion: number;
    readonly expectedTeamVersion?: number;
    readonly cleans?: boolean;
    readonly endedAt?: Date;
  }): Promise<TeamMemberSnapshot>;
  countPrimarySupervisorAssignments(identityUserId: string): Promise<number>;
}

export interface WorkforceCommandRepositoryPort {
  begin(input: {
    readonly providerId: string;
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly requestFingerprint: string;
    readonly actorUserId: string | null;
  }): Promise<{ readonly replay: boolean; readonly result: WorkforceSafeResult | null }>;
  accept(input: {
    readonly scopeKey: string;
    readonly idempotencyKey: string;
    readonly safeResultCode: string;
    readonly safeResult: WorkforceSafeResult;
  }): Promise<void>;
}

export interface WorkforceHistoryRepositoryPort {
  append(input: WorkforceHistoryInput): Promise<{ readonly id: string }>;
  list(input: {
    readonly providerId: string;
    readonly targetType: WorkforceHistoryInput["targetType"];
    readonly targetId: string;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly WorkforceHistorySnapshot[]>;
  listForWorker(input: {
    readonly providerId: string;
    readonly workerId: string;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly WorkforceHistorySnapshot[]>;
}

export interface WorkforceNotificationRepositoryPort {
  insert(input: WorkforceNotificationIntentInput): Promise<void>;
}

export interface ProvidersWorkforceTransactionContext {
  readonly workforce: ProviderWorkforceRepositoryPort;
  readonly commands: WorkforceCommandRepositoryPort;
  readonly history: WorkforceHistoryRepositoryPort;
  readonly notifications: WorkforceNotificationRepositoryPort;
  readonly identityReader: import("../../authentication/authentication.public.js").WorkerIdentityReader;
  readonly identityAuthority: import("../../authentication/authentication.public.js").TransactionalWorkerIdentityAuthorityWriter;
  readonly proofUseAuthorizer: import("../../authentication/authentication.public.js").TransactionalWorkerProofUseAuthorizer;
  readonly avatarAuthorizer: import("../../media/media.public.js").TransactionalWorkerAvatarAuthorizer;
  readonly audit: import("../../admin/audit.public.js").GeneralTransactionalAuditWriter;
}

export interface ProvidersWorkforceUnitOfWorkPort {
  run<T>(callback: (context: ProvidersWorkforceTransactionContext) => Promise<T>): Promise<T>;
}
