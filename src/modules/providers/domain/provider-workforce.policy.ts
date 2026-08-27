import { createHash } from "node:crypto";

import type {
  ProviderTeamStatus,
  TeamMemberSnapshot,
  WorkerAccessRevocationReason,
  WorkerLoginAccessStatus,
  WorkerDeactivationReason,
  WorkerOperationalStatus,
  WorkerProfileInput,
  WorkerRemovalReason,
  ProviderAdminGrantReason,
  ProviderAdminRevocationReason,
} from "./provider-workforce.types.js";

export class WorkforcePolicyError extends Error {
  public constructor(
    public readonly code: string,
    public readonly safeDetails?: Readonly<Record<string, unknown>>,
  ) {
    super(code);
    this.name = "WorkforcePolicyError";
  }
}

export const WORKER_DEACTIVATION_REASONS = [
  "TEMPORARILY_UNAVAILABLE",
  "SCHEDULE_OR_LEAVE",
  "PERFORMANCE_OR_POLICY",
  "PROVIDER_OPERATIONAL_CHANGE",
  "OTHER",
] as const satisfies readonly WorkerDeactivationReason[];
export const WORKER_REMOVAL_REASONS = [
  "ENGAGEMENT_ENDED",
  "PERFORMANCE_OR_POLICY",
  "DUPLICATE_OR_INCORRECT_RECORD",
  "OTHER",
] as const satisfies readonly WorkerRemovalReason[];
export const WORKER_ACCESS_REVOCATION_REASONS = [
  "SECURITY_CONCERN",
  "ACCESS_NO_LONGER_REQUIRED",
  "ENGAGEMENT_ENDED",
  "OTHER",
] as const satisfies readonly WorkerAccessRevocationReason[];
export const PROVIDER_ADMIN_GRANT_REASONS = [
  "OPERATIONAL_RESPONSIBILITY",
  "COVERAGE_OR_BACKUP",
  "OTHER",
] as const satisfies readonly ProviderAdminGrantReason[];
export const PROVIDER_ADMIN_REVOCATION_REASONS = [
  "RESPONSIBILITY_ENDED",
  "SECURITY_CONCERN",
  "ENGAGEMENT_ENDED",
  "OTHER",
] as const satisfies readonly ProviderAdminRevocationReason[];

export function normalizeWorkforceLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

export function normalizeDisplayLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ");
}

export function normalizeSkills(skills: readonly string[]): readonly { displayLabel: string; normalizedLabel: string }[] {
  if (skills.length > 50) throw new WorkforcePolicyError("WORKFORCE_PROFILE_INVALID", { field: "skillTags" });
  const normalized = new Map<string, string>();
  for (const candidate of skills) {
    const displayLabel = normalizeDisplayLabel(candidate);
    const normalizedLabel = normalizeWorkforceLabel(candidate);
    if (normalizedLabel.length === 0 || displayLabel.length > 100 || normalizedLabel.length > 100) {
      throw new WorkforcePolicyError("WORKFORCE_SKILL_INVALID");
    }
    if (normalized.has(normalizedLabel)) throw new WorkforcePolicyError("WORKFORCE_SKILL_DUPLICATE");
    normalized.set(normalizedLabel, displayLabel);
  }
  return [...normalized].map(([normalizedLabel, displayLabel]) => ({ displayLabel, normalizedLabel }));
}

export function validateWorkerProfile(profile: WorkerProfileInput): void {
  const fullLegalName = normalizeDisplayLabel(profile.fullLegalName);
  if (fullLegalName.length === 0) {
    throw new WorkforcePolicyError("WORKFORCE_PROFILE_INCOMPLETE", { field: "fullLegalName" });
  }
  if (fullLegalName.length > 200) {
    throw new WorkforcePolicyError("WORKFORCE_PROFILE_INVALID", { field: "fullLegalName" });
  }
  if (!/^\+[1-9][0-9]{7,14}$/u.test(profile.operationalPhoneE164)) {
    throw new WorkforcePolicyError("WORKFORCE_PHONE_INVALID");
  }
  if (!(["MALE", "FEMALE"] as const).includes(profile.gender)) {
    throw new WorkforcePolicyError("WORKFORCE_GENDER_INVALID");
  }
  if (!(["CLEANING_STAFF", "ESCORT", "OTHER"] as const).includes(profile.workerType)) {
    throw new WorkforcePolicyError("WORKFORCE_TYPE_INVALID");
  }
  if (profile.displayTitle !== null) {
    const displayTitle = normalizeDisplayLabel(profile.displayTitle);
    if (displayTitle.length === 0 || displayTitle.length > 120) {
      throw new WorkforcePolicyError("WORKFORCE_PROFILE_INVALID", { field: "displayTitle" });
    }
  }
  normalizeSkills(profile.skills);
}

function canonicalizeFingerprintValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED");
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalizeFingerprintValue);
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const nested = (value as Record<string, unknown>)[key];
      if (nested !== undefined) output[key] = canonicalizeFingerprintValue(nested);
    }
    return output;
  }
  throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED");
}

/** Stable opaque command-meaning hash; submitted fields never enter result JSON. */
export function fingerprintWorkforceCommand(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeFingerprintValue(value)))
    .digest("hex");
}

const workerTransitions: Readonly<Record<WorkerOperationalStatus, readonly WorkerOperationalStatus[]>> = {
  DRAFT: ["ACTIVE", "REMOVED"],
  ACTIVE: ["INACTIVE", "REMOVED"],
  INACTIVE: ["ACTIVE", "REMOVED"],
  REMOVED: [],
};

export function assertWorkerTransition(from: WorkerOperationalStatus, to: WorkerOperationalStatus): void {
  if (!workerTransitions[from].includes(to)) {
    throw new WorkforcePolicyError("WORKFORCE_INVALID_WORKER_TRANSITION", { from, to });
  }
}

const workerAccessTransitions: Readonly<Record<WorkerLoginAccessStatus | "NONE", readonly WorkerLoginAccessStatus[]>> = {
  NONE: ["INVITED"],
  INVITED: ["ACTIVE", "EXPIRED", "REVOKED"],
  ACTIVE: ["REVOKED"],
  EXPIRED: ["INVITED"],
  REVOKED: ["INVITED"],
};

export function assertWorkerAccessTransition(
  from: WorkerLoginAccessStatus | null,
  to: WorkerLoginAccessStatus,
): void {
  const current = from ?? "NONE";
  if (!workerAccessTransitions[current].includes(to)) {
    throw new WorkforcePolicyError("WORKFORCE_INVALID_ACCESS_TRANSITION", { from, to });
  }
}

const teamTransitions: Readonly<Record<ProviderTeamStatus, readonly ProviderTeamStatus[]>> = {
  DRAFT: ["ACTIVE"],
  ACTIVE: ["INACTIVE"],
  INACTIVE: ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

export function assertTeamTransition(from: ProviderTeamStatus, to: ProviderTeamStatus): void {
  if (!teamTransitions[from].includes(to)) {
    throw new WorkforcePolicyError("WORKFORCE_INVALID_TEAM_TRANSITION", { from, to });
  }
}

export function validateReason(
  action: "WORKER_DEACTIVATE" | "WORKER_REMOVE" | "ACCESS_REVOKE" | "ADMIN_GRANT" | "ADMIN_REVOKE",
  reason: string,
  note?: string,
): void {
  const catalogs = {
    WORKER_DEACTIVATE: WORKER_DEACTIVATION_REASONS,
    WORKER_REMOVE: WORKER_REMOVAL_REASONS,
    ACCESS_REVOKE: WORKER_ACCESS_REVOCATION_REASONS,
    ADMIN_GRANT: PROVIDER_ADMIN_GRANT_REASONS,
    ADMIN_REVOKE: PROVIDER_ADMIN_REVOCATION_REASONS,
  } as const;
  if (!(catalogs[action] as readonly string[]).includes(reason)) {
    throw new WorkforcePolicyError("WORKFORCE_REASON_INVALID", { action });
  }
  if ((action === "WORKER_REMOVE" || reason === "OTHER") && (note?.trim().length ?? 0) < 10) {
    throw new WorkforcePolicyError("WORKFORCE_REASON_NOTE_REQUIRED", { minimumLength: 10 });
  }
  if (note !== undefined) assertSafeWorkforceNote(note);
}

const UNSAFE_NOTE_VALUE = /(?:\+[1-9][0-9\s().-]{7,}|[^\s@]+@[^\s@]+\.[^\s@]+|\b(?:bearer|cookie|credential|otp|password|proof|secret|storage.?key|token)\s*[:=])/iu;

/** Free-form reason notes are retained evidence and therefore must stay PII/secret-free. */
export function assertSafeWorkforceNote(note: string): void {
  if (UNSAFE_NOTE_VALUE.test(note)) {
    throw new WorkforcePolicyError("WORKFORCE_VALIDATION_FAILED", { field: "note" });
  }
}

export function assertEscortMembership(workerType: string, cleans: boolean): void {
  if (workerType === "ESCORT" && cleans) {
    throw new WorkforcePolicyError("WORKFORCE_ESCORT_CANNOT_CLEAN");
  }
}

export function assertCleanerToEscortAllowed(workerType: string, currentMembershipCleans: boolean): void {
  if (workerType === "ESCORT" && currentMembershipCleans) {
    throw new WorkforcePolicyError("WORKFORCE_ESCORT_MEMBERSHIP_CONFLICT");
  }
}

export function isValidCleaningMember(member: TeamMemberSnapshot): boolean {
  return member.endedAt === null
    && member.cleans
    && member.worker.status === "ACTIVE"
    && member.worker.profile.workerType === "CLEANING_STAFF";
}

export function assertTeamActivation(name: string | null, members: readonly TeamMemberSnapshot[]): void {
  if (name === null || normalizeDisplayLabel(name).length === 0 || !members.some(isValidCleaningMember)) {
    throw new WorkforcePolicyError("WORKFORCE_TEAM_ACTIVATION_INVALID");
  }
}

export function isQualifyingWorker(input: {
  readonly status: WorkerOperationalStatus;
  readonly profileComplete: boolean;
  readonly workerType: string;
  readonly identityActive: boolean;
  readonly workerRoleEnabled: boolean;
  readonly loginAccessActive: boolean;
}): boolean {
  return input.status === "ACTIVE"
    && input.profileComplete
    && input.workerType === "CLEANING_STAFF"
    && input.identityActive
    && input.workerRoleEnabled
    && input.loginAccessActive;
}
