import { providersError } from "./domain/providers.errors.js";
import type { ProviderDenialAuditPort } from "./domain/providers.ports.js";

type DenialAuditContextValue = string | number | boolean;

type DenialAuditInput = {
  readonly actorUserId: string;
  readonly action: string;
  readonly targetId?: string;
  readonly reason?: string;
  readonly requestId?: string;
  readonly context?: Readonly<Record<string, DenialAuditContextValue>>;
};

/**
 * Consistent cross-provider and unauthorized-access denial audit (FR-052,
 * FR-053, FR-085, FR-086). Appends a minimized audit row, then throws the
 * matching safe public error. Never includes contacts, tokens, or profile text.
 */
export class ProviderDenialAuditService {
  public constructor(private readonly writer: ProviderDenialAuditPort) {}

  public async denyAsUnavailable(input: DenialAuditInput): Promise<never> {
    await this.append(input, "DENIED");
    throw providersError("PROVIDER_NOT_FOUND");
  }

  public async denyAccess(input: DenialAuditInput): Promise<never> {
    await this.append(input, "DENIED");
    throw providersError("PROVIDER_ACCESS_DENIED");
  }

  public async denyEligibility(input: {
    readonly actorUserId: string;
    readonly action: string;
    readonly denialCodes: readonly string[];
    readonly recoveryHints: readonly string[];
    readonly providerKind?: string;
    readonly requiredCategory?: string;
    readonly requestId?: string;
  }): Promise<never> {
    await this.writer.append({
      actorType: "USER",
      actorId: input.actorUserId,
      action: input.action,
      targetType: "provider",
      outcome: "DENIED",
      reason: "PROVIDER_ELIGIBILITY_DENIED",
      context: {
        denialCodes: input.denialCodes.join(","),
        recoveryHints: input.recoveryHints.join(","),
        ...(input.providerKind === undefined
          ? {}
          : { providerKind: input.providerKind }),
        ...(input.requiredCategory === undefined
          ? {}
          : { requiredCategory: input.requiredCategory }),
      },
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    });
    throw providersError("PROVIDER_ELIGIBILITY_DENIED", {
      denialCodes: input.denialCodes,
      recoveryHints: input.recoveryHints,
    });
  }

  private async append(
    input: DenialAuditInput,
    outcome: string,
  ): Promise<void> {
    await this.writer.append({
      actorType: "USER",
      actorId: input.actorUserId,
      action: input.action,
      targetType: "provider",
      ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
      outcome,
      reason: input.reason ?? "SCOPE_DENIED",
      ...(input.context === undefined ? {} : { context: input.context }),
      ...(input.requestId === undefined ? {} : { requestId: input.requestId }),
    });
  }
}

export function createProviderDenialAuditService(
  writer: ProviderDenialAuditPort,
): ProviderDenialAuditService {
  return new ProviderDenialAuditService(writer);
}
