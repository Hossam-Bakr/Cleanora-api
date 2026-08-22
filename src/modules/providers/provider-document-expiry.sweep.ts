import type { PrismaProviderVerificationRepository } from "./infrastructure/prisma-provider-verification.repository.js";

export class ProviderDocumentExpirySweep {
  public constructor(private readonly repository: PrismaProviderVerificationRepository, private readonly now: () => Date = () => new Date()) {}
  public runBatch(limit = 100): Promise<number> {
    return this.repository.expireApproved(this.now(), limit);
  }
}
