
import {
  AUTHENTICATION_PUBLIC_CONTRACT,
  type TransactionalWorkerIdentityAuthorityWriter,
  type TransactionalWorkerProofUseAuthorizer,
  type WorkerIdentityReader,
  type WorkerInvitationIdentityOnboarding,
  type WorkerRecentAuthenticationProofVerifier,
} from "../../../src/modules/authentication/authentication.public.js";
import { ADMIN_AUDIT_PUBLIC_CONTRACT } from "../../../src/modules/admin/audit.public.js";
import {
  MEDIA_PUBLIC_CONTRACT,
  WORKER_PROFILE_IMAGE,
  type TransactionalWorkerAvatarAuthorizer,
  type WorkerAvatarPort,
} from "../../../src/modules/media/media.public.js";
import {
  PROVIDERS_PUBLIC_CONTRACT,
  createUnavailableProviderPublicReader,
  projectContactFreeProviderPreview,
  type ProviderWorkforcePublicReader,
} from "../../../src/modules/providers/providers.public.js";
import type { ProvidersWorkforceUnitOfWorkPort } from "../../../src/modules/providers/domain/provider-workforce.types.js";

describe("R1-P07 public module contracts", () => {
  it("exposes only the approved named module entry points", () => {
    expect(AUTHENTICATION_PUBLIC_CONTRACT).toBe("authentication.public");
    expect(MEDIA_PUBLIC_CONTRACT).toBe("media.public");
    expect(ADMIN_AUDIT_PUBLIC_CONTRACT).toBe("admin.audit.public");
    expect(PROVIDERS_PUBLIC_CONTRACT).toBe("providers.public");
    expect(WORKER_PROFILE_IMAGE).toBe("WORKER_PROFILE_IMAGE");
  });

  it("keeps Authentication, Media, Admin and Providers contracts structural and persistence-free", () => {
    expectTypeOf<WorkerIdentityReader>().toHaveProperty("getIdentity");
    expectTypeOf<WorkerInvitationIdentityOnboarding>().toHaveProperty("startNewUser");
    expectTypeOf<WorkerRecentAuthenticationProofVerifier>().toHaveProperty("verify");
    expectTypeOf<TransactionalWorkerIdentityAuthorityWriter>().toHaveProperty("reconcileWorkerRole");
    expectTypeOf<TransactionalWorkerProofUseAuthorizer>().toHaveProperty("assertConsumed");
    expectTypeOf<WorkerAvatarPort>().toHaveProperty("ingest");
    expectTypeOf<TransactionalWorkerAvatarAuthorizer>().toHaveProperty("assertReadyOwnedProfileImage");
    expectTypeOf<ProviderWorkforcePublicReader>().toHaveProperty("getWorkersReady");
    expectTypeOf<ProvidersWorkforceUnitOfWorkPort>().toHaveProperty("run");
  });

  it("keeps the public Provider fallback and contact-free projection executable and private-field free", async () => {
    const reader = createUnavailableProviderPublicReader();
    await expect(reader.getProviderIdentity("provider-1")).resolves.toBeNull();
    await expect(reader.getMembershipScope({ userId: "user-1", providerId: "provider-1" })).resolves.toBeNull();
    await expect(reader.getMarketplaceReadiness("provider-1")).resolves.toBeNull();
    await expect(reader.getContactFreePreview?.("provider-1")).resolves.toBeNull();
    const projected = projectContactFreeProviderPreview({
      provider: { id: "provider-1", kind: "INDIVIDUAL_TEAM" },
      profile: { displayNameAr: null, displayNameEn: "Safe Provider", descriptionAr: null, descriptionEn: "Safe" },
      countryCode: "EG",
    });
    expect(projected).toMatchObject({ providerId: "provider-1", displayNameEn: "Safe Provider" });
    expect(JSON.stringify(projected)).not.toMatch(/phone|email|whatsapp|social|booking/iu);
  });
});
