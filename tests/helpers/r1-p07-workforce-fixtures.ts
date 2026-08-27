export const R1_P07_IDS = {
  providerId: "provider-r1p07-synthetic",
  otherProviderId: "provider-r1p07-other",
  ownerUserId: "owner-r1p07-synthetic",
  adminUserId: "admin-r1p07-synthetic",
  workerUserId: "worker-r1p07-synthetic",
  supervisorUserId: "supervisor-r1p07-synthetic",
  workerId: "worker-engagement-r1p07-synthetic",
  teamId: "team-r1p07-synthetic",
  membershipId: "membership-r1p07-synthetic",
  invitationId: "invitation-r1p07-synthetic",
  requestId: "request-r1p07-synthetic",
  sessionId: "session-r1p07-synthetic",
  idempotencyKey: "00000000-0000-4000-8000-000000000007",
} as const;

export const R1_P07_SENTINELS = {
  operationalPhone: "+201012345678",
  invitationProof: "r1p07.synthetic.invitation.proof.never-runtime",
  password: "R1P07-Synthetic-Password-Only!",
  otp: "070707",
  storageKey: "r1p07/synthetic/private-worker-avatar.webp",
} as const;

export function buildWorkerProfile(overrides: Partial<{
  fullLegalName: string;
  gender: "male" | "female";
  operationalPhone: string;
  workerType: "CLEANING_STAFF" | "ESCORT" | "OTHER";
  displayTitle: string | null;
  supervisorCapable: boolean;
  skills: readonly string[];
}> = {}) {
  return {
    fullLegalName: "R1-P07 Synthetic Worker",
    gender: "female" as const,
    operationalPhone: R1_P07_SENTINELS.operationalPhone,
    workerType: "CLEANING_STAFF" as const,
    displayTitle: null,
    supervisorCapable: false,
    skills: ["Deep Cleaning"],
    ...overrides,
  };
}

export function buildWorkforceCommand(overrides: Partial<{
  expectedVersion: number;
  idempotencyKey: string;
  requestId: string;
}> = {}) {
  return {
    expectedVersion: 1,
    idempotencyKey: R1_P07_IDS.idempotencyKey,
    requestId: R1_P07_IDS.requestId,
    ...overrides,
  };
}

export function buildTeamDraft(overrides: Partial<{
  name: string | null;
  expectedProviderVersion: number;
  idempotencyKey: string;
}> = {}) {
  return {
    name: "R1-P07 Synthetic Crew",
    expectedProviderVersion: 1,
    idempotencyKey: R1_P07_IDS.idempotencyKey,
    ...overrides,
  };
}

export class R1P07TestClock {
  public constructor(private current = new Date("2026-08-22T09:00:00.000Z")) {}

  public now(): Date {
    return new Date(this.current);
  }

  public advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

/** Sorts explicit delete callbacks so database cleanup remains deterministic. */
export async function cleanupR1P07Fixtures(
  callbacks: readonly (() => Promise<void>)[],
): Promise<void> {
  for (const callback of [...callbacks].reverse()) {
    await callback();
  }
}

/**
 * Database-backed R1-P07 suites fail closed unless the explicitly supplied
 * test target is phase-named. This prevents an older phase proof database from
 * being mutated merely because it remains in a local .env file.
 */
export function hasExplicitR1P07TestDatabase(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env["TEST_DATABASE_URL"];
  if (typeof value !== "string" || value.length === 0) return false;
  try {
    const databaseName = decodeURIComponent(new URL(value).pathname.split("/").filter(Boolean).at(-1) ?? "")
      .toLocaleLowerCase("en-US");
    return /^cleanora_r1_p07(?:_[a-z0-9]+)*_(?:test|proof|clean|ci)$/u.test(databaseName);
  } catch {
    return false;
  }
}
