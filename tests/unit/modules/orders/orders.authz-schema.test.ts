import {
  canViewCompletionMedia,
  classifyOrderActor,
  isFieldActor,
} from "#modules/orders/domain/order-authz";
import {
  addNoteBodySchema,
  completeOrderBodySchema,
  orderIdParamsSchema,
} from "#modules/orders/orders.schema";
import { ordersError } from "#modules/orders/orders.errors";
import { ORDERS_PUBLIC_CONTRACT } from "#modules/orders/orders.public";

describe("R1-P18 orders authz schema errors public", () => {
  it("classifies field members, managers, customers, and staff", () => {
    const facts = {
      providerId: "p",
      customerUserId: "c",
      activeMembers: [{ workerUserId: "w" }],
    };
    expect(
      classifyOrderActor({
        actorUserId: "w",
        facts,
        isProviderManager: false,
        isStaff: false,
      }),
    ).toBe("FIELD_MEMBER");
    expect(
      classifyOrderActor({
        actorUserId: "m",
        facts,
        isProviderManager: true,
        isStaff: false,
      }),
    ).toBe("PROVIDER_MANAGER");
    expect(
      classifyOrderActor({
        actorUserId: "c",
        facts,
        isProviderManager: false,
        isStaff: false,
      }),
    ).toBe("CUSTOMER");
    expect(
      classifyOrderActor({
        actorUserId: "s",
        facts,
        isProviderManager: false,
        isStaff: true,
      }),
    ).toBe("STAFF");
    expect(
      classifyOrderActor({
        actorUserId: "x",
        facts,
        isProviderManager: false,
        isStaff: false,
      }),
    ).toBe("NONE");
    expect(isFieldActor("FIELD_MEMBER")).toBe(true);
    expect(isFieldActor("CUSTOMER")).toBe(false);
    expect(
      canViewCompletionMedia({
        role: "CUSTOMER",
        orderStatus: "IN_PROGRESS",
        kind: "COMPLETION",
      }),
    ).toBe(false);
    expect(
      canViewCompletionMedia({
        role: "CUSTOMER",
        orderStatus: "COMPLETED",
        kind: "COMPLETION",
      }),
    ).toBe(true);
    expect(
      canViewCompletionMedia({
        role: "CUSTOMER",
        orderStatus: "COMPLETED",
        kind: "PROGRESS",
      }),
    ).toBe(false);
    expect(
      canViewCompletionMedia({
        role: "NONE",
        orderStatus: "COMPLETED",
        kind: "COMPLETION",
      }),
    ).toBe(false);
  });

  it("validates schemas and builds orders errors", () => {
    expect(orderIdParamsSchema.parse({ orderId: "o1" }).orderId).toBe("o1");
    expect(completeOrderBodySchema.parse({ code: "123456" }).code).toBe("123456");
    expect(addNoteBodySchema.parse({ body: "note" }).body).toBe("note");
    expect(() => completeOrderBodySchema.parse({ code: "12" })).toThrow();
    const error = ordersError("ORDER_NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(ORDERS_PUBLIC_CONTRACT).toBe("orders.public");
  });
});
