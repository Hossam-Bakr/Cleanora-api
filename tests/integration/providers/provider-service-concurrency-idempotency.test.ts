import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-service-concurrency-idempotency live", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("accepts one of two concurrent creates without duplicate identity or histories", async () => {
    const results = await Promise.allSettled([h.create(), h.create()]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await h.state()).offerings).toHaveLength(1);
    expect(await h.state()).toMatchObject({ priceHistory: 1, statusHistory: 1, audits: 1 });
  });
  it("serializes two price writers and rejects stale versions without extra events", async () => {
    const { offering } = await h.create();
    const command = { ...h.meta(), providerServiceId: offering.id, expectedVersion: 1, catalogPriceUnitId: h.catalogPriceUnitId, price: "160.00", minimumCharge: "180.00", reason: "Change price" };
    const results = await Promise.allSettled([
      h.commands.proposePrice(command), h.commands.proposePrice({ ...command, ...h.meta(), price: "170.00" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const before = await h.state();
    expect(before.offerings[0]?.version).toBe(2);
    expect(before.prices.filter((price) => price.status === "EFFECTIVE")).toHaveLength(1);
    await expect(h.commands.proposePrice({ ...command, ...h.meta() })).rejects.toMatchObject({ code: "PROVIDER_SERVICE_VERSION_CONFLICT" });
    expect(await h.state()).toEqual(before);
  });
  it("replays the original create after newer commands and rejects key-content conflicts", async () => {
    const command = h.createCommand();
    const original = await h.commands.createOffering(command);
    await h.commands.applyLifecycle({ ...h.meta(), providerServiceId: original.offering.id, expectedVersion: 1, action: "ENABLE", reason: "Enable service" });
    const before = await h.state();
    expect(await h.commands.createOffering(command)).toEqual({ ...original, replayed: true });
    await expect(h.commands.createOffering({ ...command, price: "130.00" })).rejects.toMatchObject({ code: "PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT" });
    expect(await h.state()).toEqual(before);
  });
});
