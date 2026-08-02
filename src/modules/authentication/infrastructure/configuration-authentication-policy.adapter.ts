import { resolveEffectiveConfig } from "#modules/configuration/configuration.service";
import type {
  AuthenticationPolicyPort,
  EndpointLimitPolicy,
  RecoveryPolicy,
  SignInPolicy,
  VerificationPolicy,
} from "../domain/authentication.ports.js";

/** Resolve validated, non-secret auth policies through the configuration module's public contract. */
export class ConfigurationAuthenticationPolicyAdapter implements AuthenticationPolicyPort {
  async signIn(): Promise<SignInPolicy> {
    return (await resolveEffectiveConfig<SignInPolicy>("auth.signin_policy"))
      .value;
  }
  async verification(): Promise<VerificationPolicy> {
    return (
      await resolveEffectiveConfig<VerificationPolicy>(
        "auth.verification_policy",
      )
    ).value;
  }
  async recovery(): Promise<RecoveryPolicy> {
    return (
      await resolveEffectiveConfig<RecoveryPolicy>("auth.recovery_policy")
    ).value;
  }
  async endpointLimits(): Promise<EndpointLimitPolicy> {
    return (
      await resolveEffectiveConfig<EndpointLimitPolicy>("auth.endpoint_limits")
    ).value;
  }
}
