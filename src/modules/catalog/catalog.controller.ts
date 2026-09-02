import type { Request, RequestHandler, Response } from "express";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";
import { CatalogError, rethrowAsAppError } from "./catalog.errors.js";
import type { CatalogService } from "./catalog.service.js";
import {
  catalogCategoryIdParamsSchema,
  catalogCursorQuerySchema,
  catalogMediaAssociationParamsSchema,
  catalogServiceIdParamsSchema,
  categoryLifecycleBodySchema,
  createCategoryBodySchema,
  createServiceBodySchema,
  listServicesQuerySchema,
  moveServiceBodySchema,
  removeServiceMediaBodySchema,
  replaceCategoryBodySchema,
  replaceServiceConfigurationBodySchema,
  replaceCategoryOrderBodySchema,
  replaceServiceOrderBodySchema,
  replaceServiceAvailabilityBodySchema,
  reorderServiceMediaBodySchema,
  serviceLifecycleBodySchema,
  uploadServiceMediaFieldsSchema,
} from "./catalog.schema.js";

export interface CatalogControllerDependencies {
  readonly catalogService: CatalogService;
}

function requirePrincipal(response: Response): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (value === undefined) {
    throw new AppError({
      code: "AUTHENTICATION_REQUIRED",
      message: "Authentication is required",
      statusCode: 401,
    });
  }
  return value;
}

function metaFrom(request: Request, response: Response) {
  return {
    principal: requirePrincipal(response),
    ...(typeof request.requestId === "string"
      ? { requestId: request.requestId }
      : {}),
  };
}

/**
 * Thin Catalog management HTTP handlers. Business workflows live in CatalogService.
 */
export function createCatalogController(
  dependencies: CatalogControllerDependencies,
): {
  readonly listCategories: RequestHandler;
  readonly getCategory: RequestHandler;
  readonly createCategory: RequestHandler;
  readonly replaceCategory: RequestHandler;
  readonly changeCategoryLifecycle: RequestHandler;
  readonly listServices: RequestHandler;
  readonly getService: RequestHandler;
  readonly createService: RequestHandler;
  readonly moveService: RequestHandler;
  readonly changeServiceLifecycle: RequestHandler;
  readonly replaceServiceConfiguration: RequestHandler;
  readonly replaceCategoryOrder: RequestHandler;
  readonly replaceServiceOrder: RequestHandler;
  readonly replaceServiceAvailability: RequestHandler;
  readonly uploadServiceMedia: RequestHandler;
  readonly reorderServiceMedia: RequestHandler;
  readonly removeServiceMedia: RequestHandler;
} {
  return {
    /**
     * @desc List categories for staff management including inactive drafts.
     * @route GET /api/v1/staff/catalog/categories
     * @access staff_admin with catalog.management.read
     */
    async listCategories(request, response, next): Promise<void> {
      try {
        const query = catalogCursorQuerySchema.parse(request.query);
        const listQuery: { cursor?: string; limit?: number } = {};
        if (query.cursor !== undefined) {
          listQuery.cursor = query.cursor;
        }
        if (query.limit !== undefined) {
          listQuery.limit = query.limit;
        }
        const result = await dependencies.catalogService.listCategoriesForManagement(
          metaFrom(request, response),
          listQuery,
        );
        sendSuccess(request, response, 200, result.items, {
          ...(result.nextCursor === null
            ? {}
            : { nextCursor: result.nextCursor }),
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Read one category for staff management.
     * @route GET /api/v1/staff/catalog/categories/:categoryId
     * @access staff_admin with catalog.management.read
     */
    async getCategory(request, response, next): Promise<void> {
      try {
        const params = catalogCategoryIdParamsSchema.parse(request.params);
        const category = await dependencies.catalogService.getCategoryForManagement(
          metaFrom(request, response),
          params.categoryId,
        );
        sendSuccess(request, response, 200, category);
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Create an inactive category draft.
     * @route POST /api/v1/staff/catalog/categories
     * @access staff_admin with catalog.management.write + reason
     */
    async createCategory(request, response, next): Promise<void> {
      try {
        const body = createCategoryBodySchema.parse(request.body);
        const result = await dependencies.catalogService.createCategory(
          metaFrom(request, response),
          body,
        );
        sendSuccess(request, response, result.replayed ? 200 : 201, result.category, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Replace category localized content at an exact version.
     * @route PUT /api/v1/staff/catalog/categories/:categoryId
     * @access staff_admin with catalog.management.write + reason
     */
    async replaceCategory(request, response, next): Promise<void> {
      try {
        const params = catalogCategoryIdParamsSchema.parse(request.params);
        const body = replaceCategoryBodySchema.parse(request.body);
        const result = await dependencies.catalogService.replaceCategoryContent(
          metaFrom(request, response),
          params.categoryId,
          body,
        );
        sendSuccess(request, response, 200, result.category, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Activate or deactivate a category at an exact version.
     * @route POST /api/v1/staff/catalog/categories/:categoryId/lifecycle
     * @access staff_admin with catalog.management.write + reason
     */
    async changeCategoryLifecycle(request, response, next): Promise<void> {
      try {
        const params = catalogCategoryIdParamsSchema.parse(request.params);
        const body = categoryLifecycleBodySchema.parse(request.body);
        const result = await dependencies.catalogService.changeCategoryLifecycle(
          metaFrom(request, response),
          params.categoryId,
          body,
        );
        sendSuccess(request, response, 200, result.category, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc List services for staff management including inactive drafts.
     * @route GET /api/v1/staff/catalog/services
     * @access staff_admin with catalog.management.read
     */
    async listServices(request, response, next): Promise<void> {
      try {
        const query = listServicesQuerySchema.parse(request.query);
        const listQuery: {
          categoryId?: string;
          cursor?: string;
          limit?: number;
        } = {};
        if (query.categoryId !== undefined) {
          listQuery.categoryId = query.categoryId;
        }
        if (query.cursor !== undefined) {
          listQuery.cursor = query.cursor;
        }
        if (query.limit !== undefined) {
          listQuery.limit = query.limit;
        }
        const result = await dependencies.catalogService.listServicesForManagement(
          metaFrom(request, response),
          listQuery,
        );
        sendSuccess(request, response, 200, result.items, {
          ...(result.nextCursor === null
            ? {}
            : { nextCursor: result.nextCursor }),
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Read one service for staff management.
     * @route GET /api/v1/staff/catalog/services/:serviceId
     * @access staff_admin with catalog.management.read
     */
    async getService(request, response, next): Promise<void> {
      try {
        const params = catalogServiceIdParamsSchema.parse(request.params);
        const service = await dependencies.catalogService.getServiceForManagement(
          metaFrom(request, response),
          params.serviceId,
        );
        sendSuccess(request, response, 200, service);
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Create an inactive service draft under a category.
     * @route POST /api/v1/staff/catalog/services
     * @access staff_admin with catalog.management.write + reason
     */
    async createService(request, response, next): Promise<void> {
      try {
        const body = createServiceBodySchema.parse(request.body);
        const result = await dependencies.catalogService.createService(
          metaFrom(request, response),
          body,
        );
        sendSuccess(request, response, result.replayed ? 200 : 201, result.service, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Move a service to another category at an exact version.
     * @route PUT /api/v1/staff/catalog/services/:serviceId
     * @access staff_admin with catalog.management.write + reason
     */
    async moveService(request, response, next): Promise<void> {
      try {
        const params = catalogServiceIdParamsSchema.parse(request.params);
        const body = moveServiceBodySchema.parse(request.body);
        const result = await dependencies.catalogService.moveService(
          metaFrom(request, response),
          params.serviceId,
          body,
        );
        sendSuccess(request, response, 200, result.service, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Activate or deactivate a service at an exact version.
     * @route POST /api/v1/staff/catalog/services/:serviceId/lifecycle
     * @access staff_admin with catalog.management.write + reason
     */
    async changeServiceLifecycle(request, response, next): Promise<void> {
      try {
        const params = catalogServiceIdParamsSchema.parse(request.params);
        const body = serviceLifecycleBodySchema.parse(request.body);
        const result = await dependencies.catalogService.changeServiceLifecycle(
          metaFrom(request, response),
          params.serviceId,
          body,
        );
        sendSuccess(request, response, 200, result.service, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Replace service price units and field/option graph at an exact version.
     * @route PUT /api/v1/staff/catalog/services/:serviceId/configuration
     * @access staff_admin with catalog.management.write + reason
     */
    async replaceServiceConfiguration(request, response, next): Promise<void> {
      try {
        const params = catalogServiceIdParamsSchema.parse(request.params);
        const body = replaceServiceConfigurationBodySchema.parse(request.body);
        const result = await dependencies.catalogService.replaceServiceConfiguration(
          metaFrom(request, response),
          params.serviceId,
          body,
        );
        sendSuccess(request, response, 200, result.service, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Replace the full category display-order vector at exact versions.
     * @route PUT /api/v1/staff/catalog/categories/order
     * @access staff_admin with catalog.management.write + reason
     */
    async replaceCategoryOrder(request, response, next): Promise<void> {
      try {
        const body = replaceCategoryOrderBodySchema.parse(request.body);
        const result = await dependencies.catalogService.replaceCategoryOrder(
          metaFrom(request, response),
          body,
        );
        sendSuccess(request, response, 200, result.categories, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Replace the full service display-order vector within one category.
     * @route PUT /api/v1/staff/catalog/services/order
     * @access staff_admin with catalog.management.write + reason
     */
    async replaceServiceOrder(request, response, next): Promise<void> {
      try {
        const body = replaceServiceOrderBodySchema.parse(request.body);
        const result = await dependencies.catalogService.replaceServiceOrder(
          metaFrom(request, response),
          body,
        );
        sendSuccess(request, response, 200, result.services, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Replace country availability for one service at an exact version.
     * @route PUT /api/v1/staff/catalog/services/:serviceId/availability
     * @access staff_admin with catalog.management.write + reason
     */
    async replaceServiceAvailability(request, response, next): Promise<void> {
      try {
        const params = catalogServiceIdParamsSchema.parse(request.params);
        const body = replaceServiceAvailabilityBodySchema.parse(request.body);
        const result = await dependencies.catalogService.replaceServiceAvailability(
          metaFrom(request, response),
          params.serviceId,
          body,
        );
        sendSuccess(request, response, 200, result.service, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Upload and associate a Catalog service image through Media.
     * @route POST /api/v1/staff/catalog/services/:serviceId/media
     * @access staff_admin with catalog.management.write + reason
     */
    async uploadServiceMedia(request, response, next): Promise<void> {
      try {
        const params = catalogServiceIdParamsSchema.parse(request.params);
        const body = uploadServiceMediaFieldsSchema.parse(request.body);
        const file = request.file;
        if (file === undefined) {
          throw new CatalogError(
            "CATALOG_MEDIA_INVALID",
            "Catalog service image file is required",
          );
        }
        const result = await dependencies.catalogService.uploadServiceMedia(
          {
            serviceId: params.serviceId,
            ...body,
            declaredContentType: file.mimetype,
            bytes: file.buffer,
          },
          metaFrom(request, response),
        );
        sendSuccess(
          request,
          response,
          result.replayed ? 200 : 201,
          result.service,
          { replayed: result.replayed },
        );
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Replace the exact service-media association order.
     * @route PUT /api/v1/staff/catalog/services/:serviceId/media/order
     * @access staff_admin with catalog.management.write + reason
     */
    async reorderServiceMedia(request, response, next): Promise<void> {
      try {
        const params = catalogServiceIdParamsSchema.parse(request.params);
        const body = reorderServiceMediaBodySchema.parse(request.body);
        const result = await dependencies.catalogService.reorderServiceMedia(
          { serviceId: params.serviceId, ...body },
          metaFrom(request, response),
        );
        sendSuccess(request, response, 200, result.service, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Detach a service-media association without deleting the Media file.
     * @route POST /api/v1/staff/catalog/services/:serviceId/media/:associationId/remove
     * @access staff_admin with catalog.management.write + reason
     */
    async removeServiceMedia(request, response, next): Promise<void> {
      try {
        const params = catalogMediaAssociationParamsSchema.parse(request.params);
        const body = removeServiceMediaBodySchema.parse(request.body);
        const result = await dependencies.catalogService.removeServiceMedia(
          {
            serviceId: params.serviceId,
            associationId: params.associationId,
            ...body,
          },
          metaFrom(request, response),
        );
        sendSuccess(request, response, 200, result.service, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },
  };
}

function mapHandlerError(error: unknown): unknown {
  if (error instanceof CatalogError) {
    try {
      rethrowAsAppError(error);
    } catch (mapped) {
      return mapped;
    }
  }
  return error;
}
