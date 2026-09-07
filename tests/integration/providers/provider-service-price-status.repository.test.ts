import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-service-price-status.repository live", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("retains superseded commercial values and exposes only real status transitions", async () => {
    const { offering } = await h.create();
    await h.commands.proposePrice({ ...h.meta(), providerServiceId: offering.id, expectedVersion: 1, catalogPriceUnitId: h.catalogPriceUnitId, price: "160.00", minimumCharge: "180.00", reason: "New price" });
    await h.commands.applyLifecycle({ ...h.meta(), providerServiceId: offering.id, expectedVersion: 2, action: "ENABLE", reason: "Enable service" });
    await h.commands.applyLifecycle({ ...h.meta(), providerServiceId: offering.id, expectedVersion: 3, action: "DISABLE", reason: "Disable service" });
    const state = await h.state();
    expect(state.offerings[0]?.version).toBe(4);
    expect(state.prices.map((price) => [price.status, price.providerPriceMinorUnits.toFixed(0)]).sort()).toEqual([["EFFECTIVE", "16000"], ["SUPERSEDED", "12000"]]);
    const history = await h.queries.listStatusHistory({ actorUserId: h.owner.id, providerId: h.provider.id, providerServiceId: offering.id });
    expect(history.items.map((item) => item.event).sort()).toEqual(["OFFERING_DISABLED", "OFFERING_ENABLED"]);
  });
  it("rejects SQL rewrites/deletes of retained price and history rows", async () => {
    const { offering } = await h.create();
    const priceId = offering.effectivePrice!.id;
    const before = await h.state();
    await expect(h.db.providerServicePrice.update({ where: { id: priceId }, data: { providerPriceMinorUnits: "13000" } })).rejects.toThrow();
    await expect(h.db.providerServicePrice.delete({ where: { id: priceId } })).rejects.toThrow();
    await expect(h.db.providerServicePriceHistory.updateMany({ where: { providerId: h.provider.id }, data: { reasonText: "tampered" } })).rejects.toThrow();
    await expect(h.db.providerServiceStatusHistory.deleteMany({ where: { providerId: h.provider.id } })).rejects.toThrow();
    expect(await h.state()).toEqual(before);
  });
});
