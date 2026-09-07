import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-service-snapshot-consistency live", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("returns exact locale and a copied stable value while refusing unavailable scope", async () => {
    const { offering } = await h.create();
    await h.commands.applyLifecycle({ ...h.meta(), providerServiceId: offering.id, expectedVersion: 1, action: "ENABLE", reason: "Enable service" });
    const before = await h.state();
    const value = await h.snapshots.getSnapshotReadyFacts(h.snapshotInput);
    expect(value).toMatchObject({ status: "AVAILABLE", value: { price: "120.00", serviceNote: "Service note" } });
    expect(await h.state()).toEqual(before);
    const copied = JSON.stringify(value);
    expect(await h.snapshots.getSnapshotReadyFacts({ ...h.snapshotInput, countryCode: "SA" })).toEqual({ status: "UNAVAILABLE" });
    expect(await h.snapshots.getSnapshotReadyFacts({ ...h.snapshotInput, locale: "FR" as "EN" })).toEqual({ status: "UNAVAILABLE" });
    await h.commands.replaceConfiguration({ ...h.meta(), providerServiceId: offering.id, expectedVersion: 2, estimatedDurationMinutes: 100, noteAr: null, noteEn: null });
    expect(JSON.stringify(value)).toBe(copied);
    await h.db.provider.update({ where: { id: h.provider.id }, data: { applicationStatus: "REJECTED", ownerUserId: null, approvedAt: null, rejectedAt: new Date() } });
    expect(await h.snapshots.getSnapshotReadyFacts(h.snapshotInput)).toEqual({ status: "UNAVAILABLE" });
  });
  it("shares a repeatable-read view across Provider and Configuration under concurrent policy change", async () => {
    const { offering } = await h.create();
    await h.commands.applyLifecycle({ ...h.meta(), providerServiceId: offering.id, expectedVersion: 1, action: "ENABLE", reason: "Enable service" });
    let reached!: () => void;
    let resume!: () => void;
    const reachedPromise = new Promise<void>((resolve) => { reached = resolve; });
    const resumePromise = new Promise<void>((resolve) => { resume = resolve; });
    const read = h.uow.runReadSnapshot(async (context) => {
      const provider = await context.providerServices.lockProviderScope(h.provider.id);
      reached();
      await resumePromise;
      const policy = await context.pricingPolicy.readForCountry({ countryCode: "EG" });
      expect(provider?.applicationStatus).toBe("APPROVED");
      return policy;
    });
    await reachedPromise;
    try { await h.setPolicy(false, "100.00"); } finally { resume(); }
    expect(await read).toMatchObject({ status: "AVAILABLE", value: { maximumPrice: "9999.99" } });
    expect(await h.snapshots.getSnapshotReadyFacts(h.snapshotInput)).toEqual({ status: "UNAVAILABLE" });
  });
});
