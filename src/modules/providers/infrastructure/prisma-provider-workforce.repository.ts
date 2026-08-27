import type { Prisma, PrismaClient } from "#generated/prisma/client";

import type {
  ProviderWorkforceRepositoryPort,
  ProviderAdminMembershipSnapshot,
  TeamMemberSnapshot,
  TeamSnapshot,
  WorkerInvitationSnapshot,
  WorkerSnapshot,
} from "../domain/provider-workforce.types.js";
import { normalizeSkills, WorkforcePolicyError } from "../domain/provider-workforce.policy.js";

type DbClient = Prisma.TransactionClient | PrismaClient;

const workerInclude = {
  profile: { include: { worker: false, avatarMediaFile: false } },
  loginAccess: true,
} as const;

type WorkerRow = Prisma.ProviderWorkerGetPayload<{ include: typeof workerInclude }>;

function mapProfile(row: NonNullable<WorkerRow["profile"]>): WorkerSnapshot["profile"] {
  return {
    fullLegalName: row.fullLegalName,
    gender: row.gender,
    operationalPhoneE164: row.operationalPhoneE164,
    workerType: row.workerType,
    displayTitle: row.displayTitle,
    supervisorCapable: row.supervisorCapable,
    skills: [],
    avatarMediaFileId: row.avatarMediaFileId,
    version: row.version,
  };
}

function mapWorker(row: WorkerRow & { readonly skills?: readonly { readonly displayLabel: string }[] }): WorkerSnapshot {
  if (row.profile === null) throw new WorkforcePolicyError("WORKFORCE_PROFILE_MISSING");
  return {
    id: row.id,
    providerId: row.providerId,
    identityUserId: row.identityUserId,
    predecessorWorkerId: row.predecessorWorkerId,
    status: row.status,
    version: row.version,
    acceptedInvitationLocale: row.acceptedInvitationLocale,
    endedAt: row.endedAt,
    profile: {
      ...mapProfile(row.profile),
      skills: row.skills?.map((skill) => skill.displayLabel) ?? [],
    },
    access: row.loginAccess === null ? null : {
      status: row.loginAccess.status,
      version: row.loginAccess.version,
      currentInvitationId: row.loginAccess.currentInvitationId,
    },
  };
}

function mapTeam(row: {
  readonly id: string;
  readonly providerId: string;
  readonly name: string | null;
  readonly normalizedName: string | null;
  readonly status: TeamSnapshot["status"];
  readonly primarySupervisorWorkerId: string | null;
  readonly version: number;
}): TeamSnapshot {
  return { ...row };
}

function mapInvitation(row: {
  readonly id: string;
  readonly workerId: string;
  readonly invitationVersion: number;
  readonly emailNormalized: string;
  readonly locale: "AR" | "EN";
  readonly status: WorkerInvitationSnapshot["status"];
  readonly version: number;
  readonly issuedByUserId: string;
  readonly acceptedByUserId: string | null;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly acceptedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly expiredAt: Date | null;
  readonly supersededAt: Date | null;
}): WorkerInvitationSnapshot {
  return { ...row };
}

export class PrismaProviderWorkforceRepository implements ProviderWorkforceRepositoryPort {
  public constructor(private readonly db: DbClient) {}

  public async lockProvider(providerId: string) {
    const rows = await this.db.$queryRaw<Array<{ id: string; workforce_state_version: number }>>`
      SELECT "id", "workforce_state_version" FROM "providers" WHERE "id" = ${providerId} FOR UPDATE
    `;
    const row = rows[0];
    return row === undefined ? null : { id: row.id, workforceStateVersion: row.workforce_state_version };
  }

  public async getProviderOwnerUserId(providerId: string): Promise<string | null> {
    const provider = await this.db.provider.findUnique({
      where: { id: providerId },
      select: { ownerUserId: true },
    });
    return provider?.ownerUserId ?? null;
  }

  public async readActorMembership(providerId: string, actorUserId: string) {
    const rows = await this.db.$queryRaw<Array<{ level: "OWNER" | "ADMIN"; status: "ACTIVE" | "DISABLED"; version: number }>>`
      SELECT "level", "status", "version" FROM "provider_members"
      WHERE "provider_id" = ${providerId} AND "user_id" = ${actorUserId}
      FOR UPDATE
    `;
    const row = rows[0];
    return row === undefined ? null : { level: row.level, active: row.status === "ACTIVE", version: row.version };
  }

  public async lockWorker(providerId: string, workerId: string): Promise<WorkerSnapshot | null> {
    const rows = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "provider_workers"
      WHERE "id" = ${workerId} AND "provider_id" = ${providerId}
      FOR UPDATE
    `;
    if (rows.length === 0) return null;
    await this.db.$queryRaw`SELECT "worker_id" FROM "provider_worker_profiles" WHERE "worker_id" = ${workerId} FOR UPDATE`;
    await this.db.$queryRaw`SELECT "worker_id" FROM "provider_worker_login_access" WHERE "worker_id" = ${workerId} FOR UPDATE`;
    await this.db.$queryRaw`SELECT "id" FROM "provider_worker_invitations" WHERE "worker_id" = ${workerId} ORDER BY "invitation_version", "id" FOR UPDATE`;
    return this.getWorker(providerId, workerId);
  }

  public async getWorker(providerId: string, workerId: string): Promise<WorkerSnapshot | null> {
    const row = await this.db.providerWorker.findFirst({
      where: { id: workerId, providerId },
      include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } },
    });
    return row === null ? null : mapWorker(row);
  }

  public async getCurrentWorkerByIdentity(identityUserId: string): Promise<WorkerSnapshot | null> {
    const row = await this.db.providerWorker.findFirst({
      where: { identityUserId, endedAt: null },
      include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } },
    });
    return row === null ? null : mapWorker(row);
  }

  public async getLatestWorkerByIdentity(identityUserId: string): Promise<WorkerSnapshot | null> {
    const row = await this.db.providerWorker.findFirst({
      where: { identityUserId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } },
    });
    return row === null ? null : mapWorker(row);
  }

  public async getLatestRemovedWorkerByIdentity(
    providerId: string,
    identityUserId: string,
  ): Promise<WorkerSnapshot | null> {
    const row = await this.db.providerWorker.findFirst({
      where: {
        providerId,
        identityUserId,
        status: "REMOVED",
        endedAt: { not: null },
      },
      orderBy: [{ endedAt: "desc" }, { id: "desc" }],
      include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } },
    });
    return row === null ? null : mapWorker(row);
  }

  public async listWorkers(providerId: string, limit: number, cursor?: string): Promise<readonly WorkerSnapshot[]> {
    const rows = await this.db.providerWorker.findMany({
      where: { providerId },
      take: limit,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
      orderBy: { id: "asc" },
      include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } },
    });
    return rows.map(mapWorker);
  }

  public async createWorker(input: Parameters<ProviderWorkforceRepositoryPort["createWorker"]>[0]): Promise<WorkerSnapshot> {
    const providerChanged = await this.db.provider.updateMany({
      where: { id: input.providerId, workforceStateVersion: input.expectedProviderVersion },
      data: { workforceStateVersion: { increment: 1 } },
    });
    if (providerChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const skills = normalizeSkills(input.profile.skills);
    const row = await this.db.providerWorker.create({
      data: {
        id: input.workerId,
        providerId: input.providerId,
        predecessorWorkerId: input.predecessorWorkerId ?? null,
        profile: {
          create: {
            fullLegalName: input.profile.fullLegalName.trim(),
            gender: input.profile.gender,
            operationalPhoneE164: input.profile.operationalPhoneE164,
            workerType: input.profile.workerType,
            displayTitle: input.profile.displayTitle,
            supervisorCapable: input.profile.supervisorCapable,
          },
        },
        skills: { create: [...skills] },
      },
      include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } },
    });
    const worker = await this.getWorker(input.providerId, row.id);
    if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return worker;
  }

  public async replaceWorkerProfile(input: Parameters<ProviderWorkforceRepositoryPort["replaceWorkerProfile"]>[0]): Promise<WorkerSnapshot> {
    const workerChanged = await this.db.providerWorker.updateMany({
      where: { id: input.workerId, providerId: input.providerId, version: input.expectedVersion, endedAt: null },
      data: { version: { increment: 1 } },
    });
    if (workerChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const profileChanged = await this.db.providerWorkerProfile.updateMany({
      where: { workerId: input.workerId, version: input.expectedProfileVersion },
      data: {
        fullLegalName: input.profile.fullLegalName.trim(),
        gender: input.profile.gender,
        operationalPhoneE164: input.profile.operationalPhoneE164,
        workerType: input.profile.workerType,
        displayTitle: input.profile.displayTitle,
        supervisorCapable: input.profile.supervisorCapable,
        version: { increment: 1 },
      },
    });
    if (profileChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    await this.db.providerWorkerSkill.deleteMany({ where: { workerId: input.workerId } });
    const skills = normalizeSkills(input.profile.skills);
    if (skills.length > 0) await this.db.providerWorkerSkill.createMany({ data: skills.map((skill) => ({ workerId: input.workerId, ...skill })) });
    const worker = await this.getWorker(input.providerId, input.workerId);
    if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return worker;
  }

  public async setWorkerAvatar(input: Parameters<ProviderWorkforceRepositoryPort["setWorkerAvatar"]>[0]): Promise<WorkerSnapshot> {
    const changed = await this.db.providerWorkerProfile.updateMany({
      where: {
        workerId: input.workerId,
        version: input.expectedProfileVersion,
        worker: { providerId: input.providerId },
      },
      data: {
        avatarMediaFileId: input.mediaFileId,
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const worker = await this.getWorker(input.providerId, input.workerId);
    if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return worker;
  }

  public async getCurrentMembershipForWorker(workerId: string): Promise<TeamMemberSnapshot | null> {
    const row = await this.db.providerTeamMembership.findFirst({
      where: { workerId, endedAt: null },
      include: { worker: { include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } } } },
    });
    return row === null ? null : {
      id: row.id,
      teamId: row.teamId,
      workerId: row.workerId,
      cleans: row.cleans,
      version: row.version,
      endedAt: row.endedAt,
      worker: mapWorker(row.worker),
    };
  }

  public async setWorkerStatus(input: Parameters<ProviderWorkforceRepositoryPort["setWorkerStatus"]>[0]): Promise<WorkerSnapshot> {
    const changed = await this.db.providerWorker.updateMany({
      where: { id: input.workerId, providerId: input.providerId, version: input.expectedVersion },
      data: { status: input.status, ...(input.endedAt === undefined ? {} : { endedAt: input.endedAt }), version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const worker = await this.getWorker(input.providerId, input.workerId);
    if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return worker;
  }

  public async setWorkerAccessStatus(input: Parameters<ProviderWorkforceRepositoryPort["setWorkerAccessStatus"]>[0]): Promise<WorkerSnapshot> {
    const changed = await this.db.providerWorkerLoginAccess.updateMany({
      where: {
        workerId: input.workerId,
        version: input.expectedAccessVersion,
        worker: { providerId: input.providerId },
      },
      data: {
        status: input.status,
        ...(input.status === "ACTIVE"
          ? { activatedAt: input.transitionedAt, revokedAt: null }
          : { revokedAt: input.transitionedAt }),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const worker = await this.getWorker(input.providerId, input.workerId);
    if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return worker;
  }

  public async listReadinessCandidates(providerId: string): Promise<readonly WorkerSnapshot[]> {
    const rows = await this.db.providerWorker.findMany({
      where: {
        providerId,
        endedAt: null,
      },
      include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } },
      orderBy: { id: "asc" },
    });
    return rows.map(mapWorker);
  }

  public async countActiveAccessForIdentity(identityUserId: string): Promise<number> {
    return this.db.providerWorker.count({
      where: { identityUserId, endedAt: null, loginAccess: { is: { status: "ACTIVE" } } },
    });
  }

  public async lockProviderMember(providerId: string, userId: string): Promise<ProviderAdminMembershipSnapshot | null> {
    const rows = await this.db.$queryRaw<Array<{
      id: string;
      provider_id: string;
      user_id: string;
      level: "OWNER" | "ADMIN";
      status: "ACTIVE" | "DISABLED";
      version: number;
    }>>`
      SELECT "id", "provider_id", "user_id", "level", "status", "version"
      FROM "provider_members" WHERE "provider_id" = ${providerId} AND "user_id" = ${userId}
      FOR UPDATE
    `;
    const row = rows[0];
    return row === undefined ? null : {
      id: row.id,
      providerId: row.provider_id,
      userId: row.user_id,
      level: row.level,
      active: row.status === "ACTIVE",
      version: row.version,
    };
  }

  public async setProviderAdminMembership(input: Parameters<ProviderWorkforceRepositoryPort["setProviderAdminMembership"]>[0]) {
    const existing = await this.db.providerMember.findUnique({
      where: { providerId_userId: { providerId: input.providerId, userId: input.userId } },
    });
    if (existing?.level === "OWNER") throw new WorkforcePolicyError("WORKFORCE_PERMISSION_DENIED");
    if (input.expectedMembershipVersion === null) {
      if (existing !== null) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
      const created = await this.db.providerMember.create({
        data: {
          providerId: input.providerId,
          userId: input.userId,
          level: "ADMIN",
          status: input.active ? "ACTIVE" : "DISABLED",
          invitedByUserId: input.actorUserId,
          enabledAt: input.changedAt,
          ...(input.active ? {} : { disabledAt: input.changedAt }),
        },
      });
      return {
        id: created.id,
        providerId: created.providerId,
        userId: created.userId,
        level: created.level,
        active: created.status === "ACTIVE",
        version: created.version,
      };
    }
    const changed = await this.db.providerMember.updateMany({
      where: {
        providerId: input.providerId,
        userId: input.userId,
        level: "ADMIN",
        version: input.expectedMembershipVersion,
      },
      data: {
        status: input.active ? "ACTIVE" : "DISABLED",
        ...(input.active
          ? { enabledAt: input.changedAt, disabledAt: null }
          : { disabledAt: input.changedAt }),
        version: { increment: 1 },
      },
    });
    if (changed.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const updated = await this.db.providerMember.findUniqueOrThrow({
      where: { providerId_userId: { providerId: input.providerId, userId: input.userId } },
    });
    return {
      id: updated.id,
      providerId: updated.providerId,
      userId: updated.userId,
      level: updated.level,
      active: updated.status === "ACTIVE",
      version: updated.version,
    };
  }

  public async countActiveAdminMemberships(userId: string): Promise<number> {
    return this.db.providerMember.count({
      where: { userId, level: "ADMIN", status: "ACTIVE" },
    });
  }

  public async getInvitation(invitationId: string): Promise<WorkerInvitationSnapshot | null> {
    const row = await this.db.providerWorkerInvitation.findUnique({ where: { id: invitationId } });
    return row === null ? null : mapInvitation(row);
  }

  public async getWorkerForInvitation(invitationId: string): Promise<WorkerSnapshot | null> {
    const row = await this.db.providerWorkerInvitation.findUnique({
      where: { id: invitationId },
      include: {
        worker: { include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } } },
      },
    });
    return row === null ? null : mapWorker(row.worker);
  }

  public async getLatestInvitation(workerId: string): Promise<WorkerInvitationSnapshot | null> {
    const row = await this.db.providerWorkerInvitation.findFirst({
      where: { workerId },
      orderBy: [{ invitationVersion: "desc" }, { id: "desc" }],
    });
    return row === null ? null : mapInvitation(row);
  }

  public async issueInvitation(input: Parameters<ProviderWorkforceRepositoryPort["issueInvitation"]>[0]) {
    const workerChanged = await this.db.providerWorker.updateMany({
      where: { id: input.workerId, providerId: input.providerId, version: input.expectedWorkerVersion, endedAt: null },
      data: { version: { increment: 1 } },
    });
    if (workerChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const existingAccess = await this.db.providerWorkerLoginAccess.findUnique({ where: { workerId: input.workerId } });
    if (input.expectedAccessVersion === null) {
      if (existingAccess !== null) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    } else if (existingAccess?.version !== input.expectedAccessVersion) {
      throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    }
    await this.db.providerWorkerInvitation.updateMany({
      where: { workerId: input.workerId, status: "PENDING" },
      data: { status: "SUPERSEDED", supersededAt: input.issuedAt, version: { increment: 1 } },
    });
    const invitation = await this.db.providerWorkerInvitation.create({
      data: {
        id: input.invitationId,
        workerId: input.workerId,
        invitationVersion: input.invitationVersion,
        emailNormalized: input.emailNormalized,
        locale: input.locale,
        issuedByUserId: input.actorUserId,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
      },
    });
    if (existingAccess === null) {
      await this.db.providerWorkerLoginAccess.create({
        data: { workerId: input.workerId, status: "INVITED", currentInvitationId: invitation.id },
      });
    } else {
      const accessChanged = await this.db.providerWorkerLoginAccess.updateMany({
        where: { workerId: input.workerId, version: input.expectedAccessVersion ?? -1 },
        data: {
          status: "INVITED",
          currentInvitationId: invitation.id,
          activatedAt: null,
          revokedAt: null,
          version: { increment: 1 },
        },
      });
      if (accessChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    }
    const worker = await this.getWorker(input.providerId, input.workerId);
    if (worker === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return { worker, invitation: mapInvitation(invitation) };
  }

  public async transitionInvitation(input: Parameters<ProviderWorkforceRepositoryPort["transitionInvitation"]>[0]) {
    const invitationChanged = await this.db.providerWorkerInvitation.updateMany({
      where: {
        id: input.invitationId,
        workerId: input.workerId,
        version: input.expectedInvitationVersion,
        status: "PENDING",
      },
      data: {
        status: input.status,
        ...(input.status === "EXPIRED"
          ? { expiredAt: input.transitionedAt }
          : { revokedAt: input.transitionedAt }),
        version: { increment: 1 },
      },
    });
    if (invitationChanged.count !== 1) throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
    const accessChanged = await this.db.providerWorkerLoginAccess.updateMany({
      where: {
        workerId: input.workerId,
        currentInvitationId: input.invitationId,
        version: input.expectedAccessVersion,
        status: "INVITED",
      },
      data: { status: input.status, version: { increment: 1 } },
    });
    if (accessChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const worker = await this.getWorker(input.providerId, input.workerId);
    const invitation = await this.getInvitation(input.invitationId);
    if (worker === null || invitation === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return { worker, invitation };
  }

  public async acceptInvitation(input: Parameters<ProviderWorkforceRepositoryPort["acceptInvitation"]>[0]) {
    const invitationChanged = await this.db.providerWorkerInvitation.updateMany({
      where: {
        id: input.invitationId,
        workerId: input.workerId,
        version: input.expectedInvitationVersion,
        status: "PENDING",
        expiresAt: { gt: input.acceptedAt },
      },
      data: {
        status: "ACCEPTED",
        acceptedByUserId: input.identityUserId,
        acceptedAt: input.acceptedAt,
        version: { increment: 1 },
      },
    });
    if (invitationChanged.count !== 1) throw new WorkforcePolicyError("WORKER_INVITATION_INVALID");
    const workerChanged = await this.db.providerWorker.updateMany({
      where: {
        id: input.workerId,
        providerId: input.providerId,
        version: input.expectedWorkerVersion,
        OR: [{ identityUserId: null }, { identityUserId: input.identityUserId }],
        endedAt: null,
      },
      data: {
        identityUserId: input.identityUserId,
        predecessorWorkerId: input.predecessorWorkerId,
        acceptedInvitationLocale: input.acceptedLocale,
        version: { increment: 1 },
      },
    });
    if (workerChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const profileChanged = await this.db.providerWorkerProfile.updateMany({
      where: { workerId: input.workerId },
      data: {
        operationalPhoneE164: input.operationalPhoneE164,
        version: { increment: 1 },
      },
    });
    if (profileChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const accessChanged = await this.db.providerWorkerLoginAccess.updateMany({
      where: {
        workerId: input.workerId,
        currentInvitationId: input.invitationId,
        version: input.expectedAccessVersion,
        status: "INVITED",
      },
      data: {
        status: "ACTIVE",
        activatedAt: input.acceptedAt,
        revokedAt: null,
        version: { increment: 1 },
      },
    });
    if (accessChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const worker = await this.getWorker(input.providerId, input.workerId);
    const invitation = await this.getInvitation(input.invitationId);
    if (worker === null || invitation === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return { worker, invitation };
  }

  public async getTeam(providerId: string, teamId: string): Promise<TeamSnapshot | null> {
    const row = await this.db.providerTeam.findFirst({ where: { id: teamId, providerId } });
    return row === null ? null : mapTeam(row);
  }

  public async lockTeam(providerId: string, teamId: string): Promise<TeamSnapshot | null> {
    const rows = await this.db.$queryRaw<Array<{
      id: string;
      provider_id: string;
      name: string | null;
      normalized_name: string | null;
      status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
      primary_supervisor_worker_id: string | null;
      version: number;
    }>>`
      SELECT "id", "provider_id", "name", "normalized_name", "status",
             "primary_supervisor_worker_id", "version"
      FROM "provider_teams"
      WHERE "id" = ${teamId} AND "provider_id" = ${providerId}
      FOR UPDATE
    `;
    const row = rows[0];
    return row === undefined ? null : {
      id: row.id,
      providerId: row.provider_id,
      name: row.name,
      normalizedName: row.normalized_name,
      status: row.status,
      primarySupervisorWorkerId: row.primary_supervisor_worker_id,
      version: row.version,
    };
  }

  public async listTeams(providerId: string, limit: number, cursor?: string): Promise<readonly TeamSnapshot[]> {
    const rows = await this.db.providerTeam.findMany({ where: { providerId }, take: limit, ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }), orderBy: { id: "asc" } });
    return rows.map(mapTeam);
  }

  public async listCurrentTeamMembers(teamId: string): Promise<readonly TeamMemberSnapshot[]> {
    const rows = await this.db.providerTeamMembership.findMany({
      where: { teamId, endedAt: null },
      orderBy: { id: "asc" },
      include: { worker: { include: { ...workerInclude, skills: { orderBy: { normalizedLabel: "asc" } } } } },
    });
    return rows.map((row) => ({
      id: row.id, teamId: row.teamId, workerId: row.workerId, cleans: row.cleans,
      version: row.version, endedAt: row.endedAt, worker: mapWorker(row.worker),
    }));
  }

  public async getMembership(teamId: string, membershipId: string): Promise<TeamMemberSnapshot | null> {
    const locked = await this.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "provider_team_memberships"
      WHERE "id" = ${membershipId} AND "team_id" = ${teamId}
      FOR UPDATE
    `;
    if (locked[0] === undefined) return null;
    const row = await this.db.providerTeamMembership.findUnique({
      where: { id: membershipId },
      include: { worker: { include: { ...workerInclude, skills: true } } },
    });
    return row === null ? null : {
      id: row.id,
      teamId: row.teamId,
      workerId: row.workerId,
      cleans: row.cleans,
      version: row.version,
      endedAt: row.endedAt,
      worker: mapWorker(row.worker),
    };
  }

  public async createTeam(input: Parameters<ProviderWorkforceRepositoryPort["createTeam"]>[0]): Promise<TeamSnapshot> {
    const changed = await this.db.provider.updateMany({ where: { id: input.providerId, workforceStateVersion: input.expectedProviderVersion }, data: { workforceStateVersion: { increment: 1 } } });
    if (changed.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    return mapTeam(await this.db.providerTeam.create({ data: { id: input.teamId, providerId: input.providerId, name: input.name, normalizedName: input.normalizedName } }));
  }

  public async updateTeam(input: Parameters<ProviderWorkforceRepositoryPort["updateTeam"]>[0]): Promise<TeamSnapshot> {
    const changed = await this.db.providerTeam.updateMany({
      where: { id: input.teamId, providerId: input.providerId, version: input.expectedVersion },
      data: { ...(input.name === undefined ? {} : { name: input.name }), ...(input.normalizedName === undefined ? {} : { normalizedName: input.normalizedName }), ...(input.status === undefined ? {} : { status: input.status }), ...(input.primarySupervisorWorkerId === undefined ? {} : { primarySupervisorWorkerId: input.primarySupervisorWorkerId }), version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const team = await this.getTeam(input.providerId, input.teamId);
    if (team === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return team;
  }

  public async addMembership(input: Parameters<ProviderWorkforceRepositoryPort["addMembership"]>[0]): Promise<TeamMemberSnapshot> {
    const teamChanged = await this.db.providerTeam.updateMany({ where: { id: input.teamId, providerId: input.providerId, version: input.expectedVersion }, data: { version: { increment: 1 } } });
    if (teamChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const row = await this.db.providerTeamMembership.create({ data: { id: input.membershipId, teamId: input.teamId, workerId: input.workerId, cleans: input.cleans }, include: { worker: { include: { ...workerInclude, skills: true } } } });
    return { id: row.id, teamId: row.teamId, workerId: row.workerId, cleans: row.cleans, version: row.version, endedAt: row.endedAt, worker: mapWorker(row.worker) };
  }

  public async updateMembership(input: Parameters<ProviderWorkforceRepositoryPort["updateMembership"]>[0]): Promise<TeamMemberSnapshot> {
    if (input.expectedTeamVersion !== undefined) {
      const teamChanged = await this.db.providerTeam.updateMany({
        where: { id: input.teamId, providerId: input.providerId, version: input.expectedTeamVersion },
        data: { version: { increment: 1 } },
      });
      if (teamChanged.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    }
    const changed = await this.db.providerTeamMembership.updateMany({
      where: {
        id: input.membershipId,
        teamId: input.teamId,
        version: input.expectedMembershipVersion,
        team: { providerId: input.providerId },
      },
      data: { ...(input.cleans === undefined ? {} : { cleans: input.cleans }), ...(input.endedAt === undefined ? {} : { endedAt: input.endedAt }), version: { increment: 1 } },
    });
    if (changed.count !== 1) throw new WorkforcePolicyError("WORKFORCE_STATE_CONFLICT");
    const row = await this.db.providerTeamMembership.findUnique({ where: { id: input.membershipId }, include: { worker: { include: { ...workerInclude, skills: true } } } });
    if (row === null) throw new WorkforcePolicyError("WORKFORCE_RESOURCE_NOT_FOUND");
    return { id: row.id, teamId: row.teamId, workerId: row.workerId, cleans: row.cleans, version: row.version, endedAt: row.endedAt, worker: mapWorker(row.worker) };
  }

  public async countPrimarySupervisorAssignments(identityUserId: string): Promise<number> {
    return this.db.providerTeam.count({
      where: {
        status: { not: "ARCHIVED" },
        primarySupervisor: { identityUserId, endedAt: null, status: "ACTIVE" },
      },
    });
  }

}
