import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("R1-P06 bounded query and index evidence", () => {
  const migration = readFileSync(resolve("prisma/migrations/r1_p06_provider_verification_external_payout_destinations/migration.sql"), "utf8");
  const payoutRepository = readFileSync(resolve("src/modules/providers/infrastructure/prisma-provider-payout.repository.ts"), "utf8");
  const verificationRepository = readFileSync(resolve("src/modules/providers/infrastructure/prisma-provider-verification.repository.ts"), "utf8");

  it("indexes document and payout review queues in their stable cursor order", () => {
    expect(migration).toMatch(/provider_document_versions[\s\S]*status[\s\S]*submitted_at[\s\S]*id/iu);
    expect(migration).toMatch(/provider_payout_destination_versions[\s\S]*status[\s\S]*submitted_at[\s\S]*id/iu);
  });

  it("caps ordinary and Staff repository reads", () => {
    expect(payoutRepository).toMatch(/Math\.min\(101, Math\.max\(1, input\.limit\)\)/u);
    expect(verificationRepository).toMatch(/Math\.min\(101, Math\.max\(1, input\.limit\)\)/u);
  });

  it("uses deterministic lock statements for high-contention payout commands", () => {
    expect(payoutRepository).toMatch(/FOR UPDATE/u);
    expect(payoutRepository).toMatch(/provider_payout_destination_versions/u);
  });
});
