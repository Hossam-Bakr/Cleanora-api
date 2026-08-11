/**
 * Authentication factories for Provider composition wiring.
 *
 * Composition may import these create functions; other business modules must
 * continue to import only `authentication.public.ts` types/interfaces.
 */

export { createPrismaProviderIdentityReader } from "./infrastructure/prisma-provider-identity.reader.js";
export {
  createPrismaProviderIdentityAuthorityWriter,
  createPrismaProviderIdentityAuthorityWriterFactory,
} from "./infrastructure/prisma-provider-identity-authority.writer.js";
export {
  createProviderInvitationIdentityOnboarding,
  type ProviderInvitationOnboardingDependencies,
} from "./infrastructure/prisma-provider-invitation-onboarding.js";
