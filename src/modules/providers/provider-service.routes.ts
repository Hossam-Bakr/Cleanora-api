/**
 * Provider Service management routes for R1-P09 US1–US3.
 */

import { Router, type RequestHandler } from "express";

import { validateRequest } from "../../middlewares/validate-request.js";
import {
  createProviderServiceController,
  createStaffProviderServiceController,
  type ProviderServiceHttpService,
  type StaffProviderServiceHttpService,
} from "./provider-service.controller.js";
import {
  createProviderServiceBodySchema,
  proposeProviderServicePriceBodySchema,
  providerServiceDetailParamsSchema,
  providerServiceHistoryQuerySchema,
  providerServiceLifecycleBodySchema,
  providerServiceListQuerySchema,
  providerServiceProviderParamsSchema,
  replaceProviderServiceConfigurationBodySchema,
  staffPendingPriceProposalParamsSchema,
  staffPendingPriceProposalsQuerySchema,
  staffPriceDecisionBodySchema,
} from "./provider-service.schema.js";

/**
 * @desc Mount authenticated Provider Service management routes.
 * @access HTTP adapter
 */
export function createProviderServiceRouter(dependencies: {
  readonly authenticateAccess: RequestHandler;
  readonly service: ProviderServiceHttpService;
}): Router {
  const router = Router();
  const controller = createProviderServiceController(dependencies.service);

  router.use(dependencies.authenticateAccess);

  router.get(
    "/:providerId/services",
    validateRequest({
      params: providerServiceProviderParamsSchema,
      query: providerServiceListQuerySchema,
    }),
    controller.listServices,
  );

  router.post(
    "/:providerId/services",
    validateRequest({
      params: providerServiceProviderParamsSchema,
      body: createProviderServiceBodySchema,
    }),
    controller.createService,
  );

  router.get(
    "/:providerId/services/:providerServiceId",
    validateRequest({ params: providerServiceDetailParamsSchema }),
    controller.getService,
  );

  router.put(
    "/:providerId/services/:providerServiceId/configuration",
    validateRequest({
      params: providerServiceDetailParamsSchema,
      body: replaceProviderServiceConfigurationBodySchema,
    }),
    controller.replaceConfiguration,
  );

  router.post(
    "/:providerId/services/:providerServiceId/price-proposals",
    validateRequest({
      params: providerServiceDetailParamsSchema,
      body: proposeProviderServicePriceBodySchema,
    }),
    controller.proposePrice,
  );

  router.post(
    "/:providerId/services/:providerServiceId/lifecycle",
    validateRequest({
      params: providerServiceDetailParamsSchema,
      body: providerServiceLifecycleBodySchema,
    }),
    controller.applyLifecycle,
  );

  router.get(
    "/:providerId/services/:providerServiceId/price-history",
    validateRequest({
      params: providerServiceDetailParamsSchema,
      query: providerServiceHistoryQuerySchema,
    }),
    controller.listPriceHistory,
  );

  router.get(
    "/:providerId/services/:providerServiceId/status-history",
    validateRequest({
      params: providerServiceDetailParamsSchema,
      query: providerServiceHistoryQuerySchema,
    }),
    controller.listStatusHistory,
  );

  return router;
}

/**
 * @desc Mount Staff price-approval routes under `/staff/providers`.
 * @access HTTP adapter
 */
export function createStaffProviderServiceRouter(dependencies: {
  readonly authenticateAccess: RequestHandler;
  readonly service: StaffProviderServiceHttpService;
}): Router {
  const router = Router();
  const controller = createStaffProviderServiceController(dependencies.service);

  router.use(dependencies.authenticateAccess);

  router.get(
    "/service-price-proposals",
    validateRequest({ query: staffPendingPriceProposalsQuerySchema }),
    controller.listPendingPriceProposals,
  );

  router.get(
    "/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId",
    validateRequest({ params: staffPendingPriceProposalParamsSchema }),
    controller.getPendingPriceDossier,
  );

  router.post(
    "/:providerId/services/:providerServiceId/price-proposals/:providerServicePriceId/decisions",
    validateRequest({
      params: staffPendingPriceProposalParamsSchema,
      body: staffPriceDecisionBodySchema,
    }),
    controller.decidePriceProposal,
  );

  return router;
}
