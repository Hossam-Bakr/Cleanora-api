import request from "supertest";
import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-services-price-lifecycle live HTTP", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("enables, replaces price, reads histories and rejects stale HTTP changes", async () => {
    const { offering } = await h.create();
    const path = "/api/v1/providers/" + h.provider.id + "/services/" + offering.id;
    await request(h.app()).post(path + "/lifecycle").send({ action: "ENABLE", reason: "Ready", expectedVersion: 1, idempotencyKey: h.meta().idempotencyKey }).expect(200);
    await request(h.app()).post(path + "/price-proposals").send({ catalogPriceUnitId: h.catalogPriceUnitId, price: "160.00", minimumCharge: "180.00", reason: "Replacement", expectedVersion: 2, idempotencyKey: h.meta().idempotencyKey }).expect(201);
    const before = await h.state();
    await request(h.app()).post(path + "/lifecycle").send({ action: "DISABLE", reason: "Stale", expectedVersion: 1, idempotencyKey: h.meta().idempotencyKey }).expect(409);
    expect(await h.state()).toEqual(before);
    expect((await request(h.app()).get(path + "/price-history").expect(200)).body.data).toHaveLength(3);
    expect((await request(h.app()).get(path + "/status-history").expect(200)).body.data).toHaveLength(1);
  });
});
