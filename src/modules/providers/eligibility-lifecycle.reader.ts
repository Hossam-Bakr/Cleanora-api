/**
 * Narrow Eligibility Provider lifecycle projection (R1-P11 / DEC-084).
 *
 * PRESENT|MISSING only — no ownerUserId, documents, or Worker IDs.
 */

import type {
  EligibilityProviderLifecycleFacts,
  EligibilityProviderLifecycleReader,
} from "./providers.public.js";

type LifecycleProviderRow = {
  readonly id: string;
  readonly applicationStatus: string;
  readonly operationalStatus: string;
  readonly version: number | bigint | string;
};

type LifecycleDatabase = {
  readonly provider: {
    findUnique(args: {
      readonly where: { readonly id: string };
      readonly select: {
        readonly id: true;
        readonly applicationStatus: true;
        readonly operationalStatus: true;
        readonly version: true;
      };
    }): Promise<LifecycleProviderRow | null>;
  };
};

export interface EligibilityLifecycleReaderDependencies {
  readonly database: LifecycleDatabase;
  /**
   * Optional verification satisfaction override. When omitted, verification is
   * treated as not-required (satisfied) for approved Providers until a dedicated
   * verification projection is wired by composition.
   */
  readonly isVerificationSatisfiedOrNotRequired?: (
    providerId: string,
  ) => Promise<boolean>;
}

/**
 * @desc Bound Eligibility lifecycle reader over Provider rows.
 * @access Application / public projection
 */
export class EligibilityProviderLifecycleReaderService
  implements EligibilityProviderLifecycleReader
{
  public constructor(
    private readonly deps: EligibilityLifecycleReaderDependencies,
  ) {}

  public async getLifecycleFacts(
    providerId: string,
  ): Promise<EligibilityProviderLifecycleFacts> {
    const row = await this.deps.database.provider.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        applicationStatus: true,
        operationalStatus: true,
        version: true,
      },
    });
    if (row === null) {
      return { status: "MISSING", providerId };
    }

    const approved = row.applicationStatus === "APPROVED";
    const live = row.operationalStatus === "LIVE";
    const suspended = row.operationalStatus === "SUSPENDED";
    if (live && suspended) {
      throw Object.assign(new Error("INVALID_PROVIDER_LIFECYCLE_DTO"), {
        code: "INVALID_DEPENDENCY_DTO",
      });
    }

    const verificationSatisfiedOrNotRequired =
      this.deps.isVerificationSatisfiedOrNotRequired === undefined
        ? true
        : await this.deps.isVerificationSatisfiedOrNotRequired(providerId);

    return {
      status: "PRESENT",
      providerId: row.id,
      approved,
      live,
      suspended,
      verificationSatisfiedOrNotRequired,
      aggregateVersion: String(row.version),
    };
  }
}

/**
 * @desc Create a lifecycle reader bound to an opaque Prisma transaction/client.
 * @access Composition
 */
export function createBoundEligibilityProviderLifecycleReader(
  transactionContext: unknown,
  options?: Pick<
    EligibilityLifecycleReaderDependencies,
    "isVerificationSatisfiedOrNotRequired"
  >,
): EligibilityProviderLifecycleReader {
  const database = transactionContext as LifecycleDatabase;
  return new EligibilityProviderLifecycleReaderService({
    database,
    ...(options?.isVerificationSatisfiedOrNotRequired === undefined
      ? {}
      : {
          isVerificationSatisfiedOrNotRequired:
            options.isVerificationSatisfiedOrNotRequired,
        }),
  });
}
