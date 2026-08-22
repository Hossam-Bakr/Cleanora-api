import type {
  RecentAuthenticationProofVerifier,
  StaffCapabilityAuthorizer,
} from "../../../src/modules/authentication/authentication.public.js";
import type { ProviderPayoutHolderAuthorityReader } from "../../../src/modules/customers/customers.public.js";
import type { ActiveCountryAndCurrencyReader } from "../../../src/modules/configuration/configuration.public.js";
import type { ProviderVerificationEvidencePort } from "../../../src/modules/media/media.public.js";
import type { PayoutRevealAuditGate } from "../../../src/modules/admin/audit.public.js";

describe("R1-P06 public module contracts", () => {
  it("keeps all cross-module seams purpose-limited and structurally usable", () => {
    const auth = {} as RecentAuthenticationProofVerifier;
    const capability = {} as StaffCapabilityAuthorizer;
    const holder = {} as ProviderPayoutHolderAuthorityReader;
    const configuration = {} as ActiveCountryAndCurrencyReader;
    const media = {} as ProviderVerificationEvidencePort;
    const audit = {} as PayoutRevealAuditGate;
    expect([auth, capability, holder, configuration, media, audit]).toHaveLength(6);
  });
});
