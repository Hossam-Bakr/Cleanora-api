import type {
  CreateCategorylessInviteeResult,
  ProviderInvitationIdentityOnboarding,
  RestrictedInvitationOnboardingPrincipal,
} from "../authentication/authentication.public.js";
import { AppError } from "#shared/errors/app-error";
import { providersError } from "./domain/providers.errors.js";
import type { ProviderRepositoryPort } from "./domain/providers.ports.js";
import { ProviderInvitationAcceptanceService } from "./provider-invitation-acceptance.service.js";

export interface ProviderInvitationOnboardingServiceDependencies {
  readonly providers: ProviderRepositoryPort;
  readonly acceptance: ProviderInvitationAcceptanceService;
  readonly invitationOnboarding: ProviderInvitationIdentityOnboarding;
}

/**
 * Providers-owned orchestration for invitation-only new-user onboarding.
 * Never trusts caller email; revalidates the invitation before Auth work.
 */
export class ProviderInvitationOnboardingService {
  public constructor(
    private readonly dependencies: ProviderInvitationOnboardingServiceDependencies,
  ) {}

  public async start(input: {
    readonly token: string;
    readonly phone: string;
    readonly password: string;
  }): Promise<CreateCategorylessInviteeResult> {
    const invitation =
      await this.dependencies.acceptance.resolveInvitationFromToken(
        input.token,
      );
    const provider = await this.dependencies.providers.findById(
      invitation.providerId,
    );
    if (provider?.applicationStatus !== "APPROVED") {
      throw providersError("PROVIDER_INVITATION_INVALID");
    }

    let result: CreateCategorylessInviteeResult;
    try {
      result =
        await this.dependencies.invitationOnboarding.createCategorylessInvitee({
          emailNormalized: invitation.emailNormalized,
          phoneE164: input.phone,
          password: input.password,
        });
    } catch (error) {
      if (
        error instanceof AppError &&
        (error.code === "AUTH_EMAIL_ALREADY_REGISTERED" ||
          error.code === "AUTH_PHONE_ALREADY_REGISTERED" ||
          error.code === "AUTH_SIGNUP_IDENTIFIERS_ALREADY_REGISTERED")
      ) {
        throw providersError("PROVIDER_INVITATION_CONFLICT", {
          reason: "IDENTITY_ALREADY_EXISTS",
        });
      }
      throw error;
    }

    await this.dependencies.acceptance.resolveInvitationFromToken(input.token);
    return result;
  }

  public async verifyEmail(input: {
    readonly token: string;
    readonly challengeId: string;
    readonly code: string;
  }): Promise<RestrictedInvitationOnboardingPrincipal> {
    const invitation =
      await this.dependencies.acceptance.resolveInvitationFromToken(
        input.token,
      );
    const principal =
      await this.dependencies.invitationOnboarding.verifyInvitationEmailOtp({
        challengeId: input.challengeId,
        code: input.code,
        fixedEmailNormalized: invitation.emailNormalized,
      });
    await this.dependencies.acceptance.resolveInvitationFromToken(input.token);
    return principal;
  }
}
