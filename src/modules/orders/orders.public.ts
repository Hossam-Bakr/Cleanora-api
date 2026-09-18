/**
 * Public Orders contracts for composition and Bookings cancel coordination.
 */

export const ORDERS_PUBLIC_CONTRACT = "orders.public" as const;

export type {
  BookingOrderActivationFacts,
  OrderDossier,
  OrderMediaItem,
  OrderTimelineItem,
  OrdersServiceDependencies,
} from "./orders.service.js";
export {
  OrdersService,
  createOrdersService,
} from "./orders.service.js";
export { createOrdersRouter } from "./orders.routes.js";
export type { OrdersRouterDependencies } from "./orders.routes.js";
export {
  canCancelFromBooking,
  isLegalForwardTransition,
  isTerminalOrderStatus,
  ORDER_FORWARD_TRANSITIONS,
  ORDER_STATUSES,
} from "./orders.matrix.js";
export type { OrderStatusName } from "./orders.matrix.js";
