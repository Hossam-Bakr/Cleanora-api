import {
  canCancelFromBooking,
  isLegalForwardTransition,
  isTerminalOrderStatus,
  ORDER_FORWARD_TRANSITIONS,
} from "#modules/orders/orders.matrix";

describe("R1-P18 order status matrix", () => {
  it("allows only the frozen forward path", () => {
    for (const row of ORDER_FORWARD_TRANSITIONS) {
      expect(isLegalForwardTransition(row.from, row.to)).toBe(true);
    }
  });

  it("rejects illegal jumps fail-closed", () => {
    expect(isLegalForwardTransition("ASSIGNED", "IN_PROGRESS")).toBe(false);
    expect(isLegalForwardTransition("ASSIGNED", "READY_TO_COMPLETE")).toBe(false);
    expect(isLegalForwardTransition("ASSIGNED", "COMPLETED")).toBe(false);
    expect(isLegalForwardTransition("ON_THE_WAY", "READY_TO_COMPLETE")).toBe(false);
    expect(isLegalForwardTransition("IN_PROGRESS", "COMPLETED")).toBe(false);
    expect(isLegalForwardTransition("READY_TO_COMPLETE", "ON_THE_WAY")).toBe(false);
  });

  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(isTerminalOrderStatus("COMPLETED")).toBe(true);
    expect(isTerminalOrderStatus("CANCELLED")).toBe(true);
    expect(canCancelFromBooking("ASSIGNED")).toBe(true);
    expect(canCancelFromBooking("READY_TO_COMPLETE")).toBe(true);
    expect(canCancelFromBooking("COMPLETED")).toBe(false);
    expect(canCancelFromBooking("CANCELLED")).toBe(false);
  });
});
