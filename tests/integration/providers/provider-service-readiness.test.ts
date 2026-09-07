import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-service-readiness live", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("revalidates maximum changes across enablement, readiness and internal snapshot", async () => {
    const { offering } = await h.create();
    const enable = { ...h.meta(), providerServiceId: offering.id, expectedVersion: 1, action: "ENABLE" as const, reason: "Enable service" };
    await h.setPolicy(false, "100.00");
    const before = await h.state();
    await expect(h.commands.applyLifecycle(enable)).rejects.toMatchObject({ code: "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE" });
    expect(await h.state()).toEqual(before);
    await h.setPolicy();
    await h.commands.applyLifecycle(enable);
    expect((await h.queries.getServicesReady(h.provider.id))?.servicesReady).toBe(true);
    expect((await h.snapshots.getSnapshotReadyFacts(h.snapshotInput)).status).toBe("AVAILABLE");
    await h.setPolicy(false, "140.00");
    const enabledState = await h.state();
    expect(await h.queries.getServicesReady(h.provider.id)).toMatchObject({ servicesReady: false, blockerCodes: ["OFFERING_CONFIGURATION_INVALID"] });
    expect(await h.snapshots.getSnapshotReadyFacts(h.snapshotInput)).toEqual({ status: "UNAVAILABLE" });
    expect(await h.state()).toEqual(enabledState);
    await h.setPolicy();
    expect((await h.queries.getServicesReady(h.provider.id))?.servicesReady).toBe(true);
  });
  it("Catalog deactivation changes usability without rewriting offering or history", async () => {
    const { offering } = await h.create();
    await h.commands.applyLifecycle({ ...h.meta(), providerServiceId: offering.id, expectedVersion: 1, action: "ENABLE", reason: "Enable service" });
    const before = await h.state();
    await h.db.service.update({ where: { id: h.definition.serviceId }, data: { isActive: false } });
    try {
      expect((await h.queries.getServicesReady(h.provider.id))?.servicesReady).toBe(false);
      expect(await h.snapshots.getSnapshotReadyFacts(h.snapshotInput)).toEqual({ status: "UNAVAILABLE" });
      expect(await h.state()).toEqual(before);
    } finally {
      await h.db.service.update({ where: { id: h.definition.serviceId }, data: { isActive: true } });
    }
    expect((await h.queries.getServicesReady(h.provider.id))?.servicesReady).toBe(true);
  });
});
