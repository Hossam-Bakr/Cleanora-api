import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-service-create.repository live", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("commits disabled version one, exact money, both histories and audit", async () => {
    const result = await h.create();
    expect(result.offering).toMatchObject({ enabled: false, version: 1, effectivePrice: { price: "120.00", minimumCharge: "150.00" } });
    const state = await h.state();
    expect(state.offerings).toHaveLength(1);
    expect(state.prices[0]?.providerPriceMinorUnits.toFixed(0)).toBe("12000");
    expect(state).toMatchObject({ priceHistory: 1, statusHistory: 1, audits: 1 });
  });
  it("rolls back offering, price and histories if the atomic audit fails", async () => {
    const before = await h.state();
    h.faults.audit = true;
    await expect(h.create()).rejects.toThrow("Injected audit failure");
    expect(await h.state()).toEqual(before);
  });
  it("rejects invalid money and another provider actor without partial writes", async () => {
    const before = await h.state();
    await expect(h.commands.createOffering({ ...h.createCommand(), price: "1e2" })).rejects.toMatchObject({ code: "PROVIDER_SERVICE_PRICE_INVALID" });
    await expect(h.commands.createOffering({ ...h.createCommand(), actorUserId: h.staff.id })).rejects.toMatchObject({ code: "PROVIDER_SERVICE_FORBIDDEN" });
    expect(await h.state()).toEqual(before);
  });
});
