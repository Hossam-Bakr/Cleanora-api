/**
 * SC-008 canonical 1,000-row scenario manifest (25 lanes × 40 interactions).
 * Leaf counts are locked to the approved SC-008 distribution in spec.md.
 */

export interface Sc008ManifestRow {
  readonly lane: number;
  readonly slot: number;
  readonly callerContext:
    | "eligible_owner"
    | "wrong_owner"
    | "category_ineligible"
    | "permission_denied"
    | "ineligible_customer"
    | "unauthenticated";
  readonly ownership: "self" | "other" | "none";
  readonly operation: string;
  readonly expectedOutcome: "success" | "validation_failure" | "authorization_failure" | "conflict";
}

const PROFILE_OPS = {
  reads_existing: 35,
  reads_not_created: 15,
  mutations_success: 70,
  media_auth: 5,
  media_add: 5,
  media_replace: 5,
  media_remove: 5,
  input_failures: 30,
  authz_failures: 30,
} as const;

const CONTACT_OPS = {
  verified_email: 45,
  unverified_phone: 45,
  absent_phone: 30,
  unauthenticated: 15,
  ineligible: 15,
} as const;

const PREFERENCE_OPS = {
  reads: 45,
  language_updates: 30,
  optional_updates: 30,
  mandatory_failures: 15,
  invalid_failures: 15,
  concurrency_failures: 15,
} as const;

const ADDRESS_OPS = {
  reads: 60,
  mutations_success: 150,
  validation_failures: 45,
  ownership_concurrency: 45,
} as const;

const PRIVACY_OPS = {
  submissions: 50,
  tracking_reads: 50,
  repeats: 30,
  cancellations: 20,
  authz_failures: 25,
  invalid_state: 25,
} as const;

function sum(values: Record<string, number>): number {
  return Object.values(values).reduce((a, b) => a + b, 0);
}

export const SC008_LOCKED_COUNTS = {
  profile: sum(PROFILE_OPS),
  contact: sum(CONTACT_OPS),
  preference: sum(PREFERENCE_OPS),
  address: sum(ADDRESS_OPS),
  privacy: sum(PRIVACY_OPS),
  total: 1000,
  lanes: 25,
  interactionsPerLane: 40,
} as const;

function pushRows(
  rows: Sc008ManifestRow[],
  count: number,
  template: Omit<Sc008ManifestRow, "lane" | "slot">,
): void {
  for (let i = 0; i < count; i += 1) {
    const index = rows.length;
    rows.push({
      ...template,
      lane: (index % SC008_LOCKED_COUNTS.lanes) + 1,
      slot: Math.floor(index / SC008_LOCKED_COUNTS.lanes) + 1,
    });
  }
}

/** Build the canonical exact 1,000-row SC-008 manifest. */
export function buildSc008Manifest(): readonly Sc008ManifestRow[] {
  const rows: Sc008ManifestRow[] = [];

  pushRows(rows, PROFILE_OPS.reads_existing, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "profile.read.existing",
    expectedOutcome: "success",
  });
  pushRows(rows, PROFILE_OPS.reads_not_created, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "profile.read.not_created",
    expectedOutcome: "success",
  });
  pushRows(rows, PROFILE_OPS.mutations_success, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "profile.mutation.success",
    expectedOutcome: "success",
  });
  pushRows(rows, PROFILE_OPS.media_auth, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "profile.media.auth",
    expectedOutcome: "success",
  });
  pushRows(rows, PROFILE_OPS.media_add, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "profile.media.add",
    expectedOutcome: "success",
  });
  pushRows(rows, PROFILE_OPS.media_replace, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "profile.media.replace",
    expectedOutcome: "success",
  });
  pushRows(rows, PROFILE_OPS.media_remove, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "profile.media.remove",
    expectedOutcome: "success",
  });
  pushRows(rows, PROFILE_OPS.input_failures, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "profile.input_failure",
    expectedOutcome: "validation_failure",
  });
  pushRows(rows, PROFILE_OPS.authz_failures, {
    callerContext: "wrong_owner",
    ownership: "other",
    operation: "profile.authz_failure",
    expectedOutcome: "authorization_failure",
  });

  pushRows(rows, CONTACT_OPS.verified_email, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "contact.read.verified_email",
    expectedOutcome: "success",
  });
  pushRows(rows, CONTACT_OPS.unverified_phone, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "contact.read.unverified_phone",
    expectedOutcome: "success",
  });
  pushRows(rows, CONTACT_OPS.absent_phone, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "contact.read.absent_phone",
    expectedOutcome: "success",
  });
  pushRows(rows, CONTACT_OPS.unauthenticated, {
    callerContext: "unauthenticated",
    ownership: "none",
    operation: "contact.unauthenticated",
    expectedOutcome: "authorization_failure",
  });
  pushRows(rows, CONTACT_OPS.ineligible, {
    callerContext: "ineligible_customer",
    ownership: "self",
    operation: "contact.ineligible",
    expectedOutcome: "authorization_failure",
  });

  pushRows(rows, PREFERENCE_OPS.reads, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "preferences.read",
    expectedOutcome: "success",
  });
  pushRows(rows, PREFERENCE_OPS.language_updates, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "preferences.language_update",
    expectedOutcome: "success",
  });
  pushRows(rows, PREFERENCE_OPS.optional_updates, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "preferences.optional_update",
    expectedOutcome: "success",
  });
  pushRows(rows, PREFERENCE_OPS.mandatory_failures, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "preferences.mandatory_failure",
    expectedOutcome: "validation_failure",
  });
  pushRows(rows, PREFERENCE_OPS.invalid_failures, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "preferences.invalid_failure",
    expectedOutcome: "validation_failure",
  });
  pushRows(rows, PREFERENCE_OPS.concurrency_failures, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "preferences.concurrency_failure",
    expectedOutcome: "conflict",
  });

  pushRows(rows, ADDRESS_OPS.reads, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "address.read",
    expectedOutcome: "success",
  });
  pushRows(rows, ADDRESS_OPS.mutations_success, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "address.mutation.success",
    expectedOutcome: "success",
  });
  pushRows(rows, ADDRESS_OPS.validation_failures, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "address.validation_failure",
    expectedOutcome: "validation_failure",
  });
  pushRows(rows, ADDRESS_OPS.ownership_concurrency, {
    callerContext: "wrong_owner",
    ownership: "other",
    operation: "address.ownership_concurrency",
    expectedOutcome: "authorization_failure",
  });

  pushRows(rows, PRIVACY_OPS.submissions, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "privacy.submit",
    expectedOutcome: "success",
  });
  pushRows(rows, PRIVACY_OPS.tracking_reads, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "privacy.read",
    expectedOutcome: "success",
  });
  pushRows(rows, PRIVACY_OPS.repeats, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "privacy.repeat",
    expectedOutcome: "success",
  });
  pushRows(rows, PRIVACY_OPS.cancellations, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "privacy.cancel",
    expectedOutcome: "success",
  });
  pushRows(rows, PRIVACY_OPS.authz_failures, {
    callerContext: "wrong_owner",
    ownership: "other",
    operation: "privacy.authz_failure",
    expectedOutcome: "authorization_failure",
  });
  pushRows(rows, PRIVACY_OPS.invalid_state, {
    callerContext: "eligible_owner",
    ownership: "self",
    operation: "privacy.invalid_state",
    expectedOutcome: "validation_failure",
  });

  return rows;
}

/** Validate locked SC-008 counts and lane/slot assignment. */
export function validateSc008Manifest(
  rows: readonly Sc008ManifestRow[],
): void {
  if (rows.length !== SC008_LOCKED_COUNTS.total) {
    throw new Error(`SC-008 manifest must contain exactly 1000 rows, got ${rows.length}`);
  }

  const byLane = new Map<number, number>();
  for (const row of rows) {
    byLane.set(row.lane, (byLane.get(row.lane) ?? 0) + 1);
    if (row.lane < 1 || row.lane > SC008_LOCKED_COUNTS.lanes) {
      throw new Error(`Invalid lane ${row.lane}`);
    }
  }
  for (let lane = 1; lane <= SC008_LOCKED_COUNTS.lanes; lane += 1) {
    if (byLane.get(lane) !== SC008_LOCKED_COUNTS.interactionsPerLane) {
      throw new Error(
        `Lane ${lane} must have exactly ${SC008_LOCKED_COUNTS.interactionsPerLane} interactions`,
      );
    }
  }

  const profileCount = rows.filter((row) => row.operation.startsWith("profile.")).length;
  const contactCount = rows.filter((row) => row.operation.startsWith("contact.")).length;
  const preferenceCount = rows.filter((row) =>
    row.operation.startsWith("preferences."),
  ).length;
  const addressCount = rows.filter((row) => row.operation.startsWith("address.")).length;
  const privacyCount = rows.filter((row) => row.operation.startsWith("privacy.")).length;

  if (profileCount !== SC008_LOCKED_COUNTS.profile) {
    throw new Error(`Profile leaf count mismatch: ${profileCount}`);
  }
  if (contactCount !== SC008_LOCKED_COUNTS.contact) {
    throw new Error(`Contact leaf count mismatch: ${contactCount}`);
  }
  if (preferenceCount !== SC008_LOCKED_COUNTS.preference) {
    throw new Error(`Preference leaf count mismatch: ${preferenceCount}`);
  }
  if (addressCount !== SC008_LOCKED_COUNTS.address) {
    throw new Error(`Address leaf count mismatch: ${addressCount}`);
  }
  if (privacyCount !== SC008_LOCKED_COUNTS.privacy) {
    throw new Error(`Privacy leaf count mismatch: ${privacyCount}`);
  }
}
