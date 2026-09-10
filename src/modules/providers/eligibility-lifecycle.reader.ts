/**
 * Narrow Eligibility Provider lifecycle projection (R1-P11 / DEC-084).
 *
 * PRESENT|MISSING only — no ownerUserId, documents, or Worker IDs.
 * Verification satisfaction is mandatory and Providers-owned (DEC-073/079/084).
 */

import { deriveDocumentVerificationTruth } from "./domain/provider-verification.policy.js";
import type {
  EligibilityProviderLifecycleFacts,
  EligibilityProviderLifecycleReader,
} from "./providers.public.js";

type LifecycleProviderRow = {
  readonly id: string;
  readonly kind: "INDIVIDUAL_TEAM" | "REGISTERED_COMPANY" | string;
  readonly applicationStatus: string;
  readonly operationalStatus: string;
  readonly version: number | bigint | string;
  readonly profile: { readonly countryId: string | null } | null;
};

type VerificationPolicyRow = {
  readonly items: readonly {
    readonly isRequired: boolean;
    readonly documentType: { readonly code: string };
  }[];
};

type LifecycleDatabase = {
  readonly provider: {
    findUnique(args: {
      readonly where: { readonly id: string };
      readonly select: {
        readonly id: true;
        readonly kind: true;
        readonly applicationStatus: true;
        readonly operationalStatus: true;
        readonly version: true;
        readonly profile: { readonly select: { readonly countryId: true } };
      };
    }): Promise<LifecycleProviderRow | null>;
  };
  readonly verificationDocumentPolicyVersion: {
    findFirst(args: {
      readonly where: {
        readonly countryId: string;
        readonly providerKind: "REGISTERED_COMPANY";
        readonly status: "PUBLISHED";
        readonly effectiveAt: { readonly lte: Date };
      };
      readonly orderBy: readonly [
        { readonly policyVersion: "desc" },
        { readonly id: "desc" },
      ];
      readonly include: {
        readonly items: {
          readonly where: { readonly isActive: true };
          readonly orderBy: readonly [
            { readonly position: "asc" },
            { readonly id: "asc" },
          ];
          readonly include: { readonly documentType: true };
        };
      };
    }): Promise<VerificationPolicyRow | null>;
  };
  readonly providerDocumentChain: {
    findMany(args: {
      readonly where: {
        readonly providerId: string;
        readonly effectiveVersion: {
          readonly status: "APPROVED";
          readonly OR: readonly [
            { readonly expiresAt: null },
            { readonly expiresAt: { readonly gt: Date } },
          ];
        };
      };
      readonly select: {
        readonly documentType: { readonly select: { readonly code: true } };
      };
    }): Promise<readonly { readonly documentType: { readonly code: string } }[]>;
  };
};

export interface EligibilityLifecycleReaderDependencies {
  readonly database: LifecycleDatabase;
  /**
   * Captured evaluation instant for policy/document effectiveness.
   * Required — missing verification wiring must not fail open.
   */
  readonly evaluatedAt: Date;
  /**
   * Optional override for tests. Production composition omits this and uses
   * the mandatory Providers-owned projection below.
   */
  readonly isVerificationSatisfiedOrNotRequired?: (
    providerId: string,
  ) => Promise<boolean>;
}

/**
 * @desc Compute verificationSatisfiedOrNotRequired from Providers policy truth.
 * @access Application / public projection
 * @explanation Individual Team ⇒ not required. Registered Company uses effective
 * policy + approved document types at evaluatedAt. Failures abort (no fail-open).
 */
export async function readVerificationSatisfiedOrNotRequired(
  database: LifecycleDatabase,
  provider: LifecycleProviderRow,
  evaluatedAt: Date,
): Promise<boolean> {
  if (provider.kind === "INDIVIDUAL_TEAM") {
    return deriveDocumentVerificationTruth({
      providerKind: "INDIVIDUAL_TEAM",
      applicationStatus: provider.applicationStatus as
        | "DRAFT"
        | "PENDING_REVIEW"
        | "CHANGES_REQUESTED"
        | "APPROVED"
        | "REJECTED",
      effectivePolicyPresent: true,
      requiredTypeCodes: [],
      effectiveApprovedTypeCodes: [],
    }).satisfied;
  }

  if (provider.kind !== "REGISTERED_COMPANY") {
    throw Object.assign(new Error("INVALID_PROVIDER_KIND_FOR_VERIFICATION"), {
      code: "INVALID_DEPENDENCY_DTO",
    });
  }

  const countryId = provider.profile?.countryId ?? null;
  if (countryId === null) {
    return deriveDocumentVerificationTruth({
      providerKind: "REGISTERED_COMPANY",
      applicationStatus: provider.applicationStatus as
        | "DRAFT"
        | "PENDING_REVIEW"
        | "CHANGES_REQUESTED"
        | "APPROVED"
        | "REJECTED",
      effectivePolicyPresent: false,
      requiredTypeCodes: [],
      effectiveApprovedTypeCodes: [],
    }).satisfied;
  }

  const policy = await database.verificationDocumentPolicyVersion.findFirst({
    where: {
      countryId,
      providerKind: "REGISTERED_COMPANY",
      status: "PUBLISHED",
      effectiveAt: { lte: evaluatedAt },
    },
    orderBy: [{ policyVersion: "desc" }, { id: "desc" }],
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ position: "asc" }, { id: "asc" }],
        include: { documentType: true },
      },
    },
  });

  const effectiveApproved = await database.providerDocumentChain.findMany({
    where: {
      providerId: provider.id,
      effectiveVersion: {
        status: "APPROVED",
        OR: [{ expiresAt: null }, { expiresAt: { gt: evaluatedAt } }],
      },
    },
    select: { documentType: { select: { code: true } } },
  });

  return deriveDocumentVerificationTruth({
    providerKind: "REGISTERED_COMPANY",
    applicationStatus: provider.applicationStatus as
      | "DRAFT"
      | "PENDING_REVIEW"
      | "CHANGES_REQUESTED"
      | "APPROVED"
      | "REJECTED",
    effectivePolicyPresent: policy !== null,
    requiredTypeCodes:
      policy?.items
        .filter((item) => item.isRequired)
        .map((item) => item.documentType.code) ?? [],
    effectiveApprovedTypeCodes: effectiveApproved.map(
      (row) => row.documentType.code,
    ),
  }).satisfied;
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
        kind: true,
        applicationStatus: true,
        operationalStatus: true,
        version: true,
        profile: { select: { countryId: true } },
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

    let verificationSatisfiedOrNotRequired: boolean;
    try {
      verificationSatisfiedOrNotRequired =
        this.deps.isVerificationSatisfiedOrNotRequired === undefined
          ? await readVerificationSatisfiedOrNotRequired(
              this.deps.database,
              row,
              this.deps.evaluatedAt,
            )
          : await this.deps.isVerificationSatisfiedOrNotRequired(providerId);
    } catch (error: unknown) {
      throw Object.assign(
        new Error("ELIGIBILITY_VERIFICATION_DEPENDENCY_FAILED"),
        {
          code: "DEPENDENCY_FAILURE",
          cause: error,
        },
      );
    }

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
  options?: {
    readonly evaluatedAt?: Date;
    readonly isVerificationSatisfiedOrNotRequired?: (
      providerId: string,
    ) => Promise<boolean>;
  },
): EligibilityProviderLifecycleReader {
  const database = transactionContext as LifecycleDatabase;
  return new EligibilityProviderLifecycleReaderService({
    database,
    evaluatedAt: options?.evaluatedAt ?? new Date(),
    ...(options?.isVerificationSatisfiedOrNotRequired === undefined
      ? {}
      : {
          isVerificationSatisfiedOrNotRequired:
            options.isVerificationSatisfiedOrNotRequired,
        }),
  });
}
