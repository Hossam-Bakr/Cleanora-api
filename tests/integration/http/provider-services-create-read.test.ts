import request from "supertest";
import { hasExplicitR1P09TestDatabase } from "../../helpers/r1-p09-provider-services-fixtures.js";
import { createProviderServicesLiveHarness, type ProviderServicesLiveHarness } from "../../helpers/r1-p09-provider-services-live.js";

describe.skipIf(!hasExplicitR1P09TestDatabase())("provider-services-create-read live HTTP", () => {
  let h: ProviderServicesLiveHarness;
  beforeEach(async () => { h = await createProviderServicesLiveHarness(); });
  afterEach(async () => { await h?.close(); });

  it("creates, lists and reads real persisted services; rejects caller totals and unauthorized scope", async () => {
    const path = "/api/v1/providers/" + h.provider.id + "/services";
    const { actorUserId: _actor, providerId: _provider, requestId: _request, ...body } = h.createCommand();
    const before = await h.state();
    await request(h.app()).post(path).send({ ...body, total: "999.00" }).expect(400);
    await request(h.app(null)).post(path).send(body).expect(401);
    await request(h.app(h.staff.id)).post(path).send(body).expect(403);
    expect(await h.state()).toEqual(before);
    const created = await request(h.app()).post(path).send(body).expect(201);
    expect(created.body.data).toMatchObject({ enabled: false, version: 1, effectivePrice: { price: "120.00" } });
    const id = created.body.data.id as string;
    const detail = await request(h.app()).get(path + "/" + id).expect(200);
    expect(detail.headers["cache-control"]).toContain("no-store");
    expect(detail.body.data.id).toBe(id);
    const list = await request(h.app()).get(path).expect(200);
    expect(list.body.data).toHaveLength(1);
    await request(h.app()).put(path + "/" + id + "/configuration").send({ estimatedDurationMinutes: 100, noteAr: null, noteEn: null, expectedVersion: 1, idempotencyKey: h.meta().idempotencyKey }).expect(200);
    expect((await h.state()).offerings[0]?.version).toBe(2);
  });
});
