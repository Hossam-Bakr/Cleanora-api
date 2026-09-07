import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-service-approval.repository live", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("approves an initial price then preserves it through pending replacement and rejection", async () => {
    await h.setPolicy(true);
    const initial = (await h.create()).offering;
    expect(initial.effectivePrice).toBeNull();
    const decide = (id: string, version: number, decision: "APPROVE" | "REJECT") => h.commands.decidePriceProposal({ ...h.meta(), actorUserId: h.staff.id, providerServiceId: initial.id, providerServicePriceId: id, expectedVersion: version, decision, reason: "Reviewed price" });
    await decide(initial.pendingPrice!.id, 1, "APPROVE");
    const replacement = (await h.commands.proposePrice({ ...h.meta(), providerServiceId: initial.id, expectedVersion: 2, catalogPriceUnitId: h.catalogPriceUnitId, price: "160.00", minimumCharge: "180.00", reason: "Replacement" })).offering;
    expect(replacement.effectivePrice?.id).toBe(initial.pendingPrice!.id);
    await decide(replacement.pendingPrice!.id, 3, "REJECT");
    const state = await h.state();
    expect(state.offerings[0]?.version).toBe(4);
    expect(state.prices.find((price) => price.id === initial.pendingPrice!.id)?.status).toBe("EFFECTIVE");
    expect(state.prices.find((price) => price.id === replacement.pendingPrice!.id)?.status).toBe("REJECTED");
    expect(state.audits).toBe(4);
  });
  it("allows one Staff race winner and makes late retries side-effect free", async () => {
    await h.setPolicy(true);
    const { offering } = await h.create();
    const command = { ...h.meta(), actorUserId: h.staff.id, providerServiceId: offering.id, providerServicePriceId: offering.pendingPrice!.id, expectedVersion: 1, decision: "APPROVE" as const, reason: "Reviewed price" };
    const results = await Promise.allSettled([h.commands.decidePriceProposal(command), h.commands.decidePriceProposal({ ...command, idempotencyKey: h.meta().idempotencyKey })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await h.state()).toMatchObject({ priceHistory: 2, audits: 2 });
  });
  it("rejects revoked Staff and policy-invalid approvals without any write", async () => {
    await h.setPolicy(true);
    const { offering } = await h.create();
    const command = { ...h.meta(), actorUserId: h.staff.id, providerServiceId: offering.id, providerServicePriceId: offering.pendingPrice!.id, expectedVersion: 1, decision: "APPROVE" as const, reason: "Reviewed price" };
    await h.setPolicy(true, "100.00");
    const before = await h.state();
    await expect(h.commands.decidePriceProposal(command)).rejects.toMatchObject({ code: "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE" });
    expect(await h.state()).toEqual(before);
    await h.setPolicy(true);
    await h.db.userRole.updateMany({ where: { userId: h.staff.id }, data: { status: "DISABLED", disabledAt: new Date() } });
    await expect(h.commands.decidePriceProposal(command)).rejects.toMatchObject({ code: "PROVIDER_SERVICE_FORBIDDEN" });
    expect(await h.state()).toEqual(before);
  });
});
