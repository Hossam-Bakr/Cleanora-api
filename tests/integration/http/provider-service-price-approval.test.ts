import request from "supertest";
import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-service-price-approval live HTTP", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("protects Staff queue/dossier/decision and commits an approved price", async () => {
    await h.setPolicy(true);
    const { offering } = await h.create();
    const root = "/api/v1/staff/providers";
    const path = root + "/" + h.provider.id + "/services/" + offering.id + "/price-proposals/" + offering.pendingPrice!.id;
    await request(h.app()).get(root + "/service-price-proposals").expect(403);
    const queue = await request(h.app(h.staff.id)).get(root + "/service-price-proposals?limit=100").expect(200);
    expect(queue.body.data.some((item: { providerId: string }) => item.providerId === h.provider.id)).toBe(true);
    expect((await request(h.app(h.staff.id)).get(path).expect(200)).body.data.pendingPrice.id).toBe(offering.pendingPrice!.id);
    await request(h.app(h.staff.id)).post(path + "/decisions").send({ decision: "APPROVE", reason: "Reviewed", expectedVersion: 1, idempotencyKey: h.meta().idempotencyKey }).expect(200);
    expect((await h.state()).prices[0]?.status).toBe("EFFECTIVE");
  });
});
