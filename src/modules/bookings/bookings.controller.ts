import type { Request, RequestHandler, Response } from "express";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import type { BookingsBrowseReader } from "./bookings.public.js";
import {
  browseCityParamsSchema,
  browseCountryParamsSchema,
  browseProviderDetailParamsSchema,
  browseProviderDetailQuerySchema,
  browseProvidersQuerySchema,
  browseServiceParamsSchema,
  browseServiceQuerySchema,
  browseServicesQuerySchema,
} from "./bookings.schema.js";

export interface BookingsBrowseControllerDependencies {
  readonly service: BookingsBrowseReader;
}

/**
 * Read the optional principal installed by Browse authentication.
 * Guest requests intentionally return `null`.
 */
export function getOptionalBrowsePrincipal(
  response: Response,
): AuthenticationPrincipal | null {
  return (
    (response.locals["authenticationPrincipal"] as
      | AuthenticationPrincipal
      | undefined) ?? null
  );
}

function requestIdOf(request: Request): string | undefined {
  return typeof request.requestId === "string" ? request.requestId : undefined;
}

/**
 * Thin Browse HTTP handlers. Workflows live in BookingsBrowseService.
 */
export function createBookingsBrowseController(
  dependencies: BookingsBrowseControllerDependencies,
): {
  readonly listServices: RequestHandler;
  readonly getService: RequestHandler;
  readonly listCities: RequestHandler;
  readonly listDistricts: RequestHandler;
  readonly listProviders: RequestHandler;
  readonly getProviderDetail: RequestHandler;
} {
  return {
    /**
     * @desc List selectable catalog services for guest Browse.
     * @route GET /api/v1/browse/services
     * @access Guest or authenticated
     * @explanation Projects Catalog public selectables only.
     */
    async listServices(request, response, next): Promise<void> {
      try {
        getOptionalBrowsePrincipal(response);
        const query = browseServicesQuerySchema.parse(request.query);
        const data = await dependencies.service.listServices({
          countryCode: query.countryCode,
          locale: query.locale,
          limit: query.limit,
          ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        });
        sendSuccess(request, response, 200, data, {
          ...(requestIdOf(request) === undefined
            ? {}
            : { requestId: requestIdOf(request) }),
        });
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Get one selectable service definition for guest Browse.
     * @route GET /api/v1/browse/services/:serviceId
     * @access Guest or authenticated
     * @explanation Returns snapshot-ready Catalog projection or 404.
     */
    async getService(request, response, next): Promise<void> {
      try {
        getOptionalBrowsePrincipal(response);
        const params = browseServiceParamsSchema.parse(request.params);
        const query = browseServiceQuerySchema.parse(request.query);
        const data = await dependencies.service.getService({
          serviceId: params.serviceId,
          countryCode: query.countryCode,
          locale: query.locale,
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc List active cities for an active country.
     * @route GET /api/v1/browse/countries/:countryCode/cities
     * @access Guest or authenticated
     * @explanation Uses Configuration public locality lists.
     */
    async listCities(request, response, next): Promise<void> {
      try {
        getOptionalBrowsePrincipal(response);
        const params = browseCountryParamsSchema.parse(request.params);
        const cities = await dependencies.service.listCities(params.countryCode);
        sendSuccess(request, response, 200, { items: cities });
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc List active districts for a city in an active country.
     * @route GET /api/v1/browse/countries/:countryCode/cities/:cityId/districts
     * @access Guest or authenticated
     * @explanation Uses Configuration public locality lists.
     */
    async listDistricts(request, response, next): Promise<void> {
      try {
        getOptionalBrowsePrincipal(response);
        const params = browseCityParamsSchema.parse(request.params);
        const districts = await dependencies.service.listDistricts(params);
        sendSuccess(request, response, 200, { items: districts });
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc List Eligibility-eligible Provider/Team browse cards.
     * @route GET /api/v1/browse/providers
     * @access Guest or authenticated
     * @explanation Calls getStandardBrowseCandidates then filter/sort/paginate.
     */
    async listProviders(request, response, next): Promise<void> {
      try {
        getOptionalBrowsePrincipal(response);
        const query = browseProvidersQuerySchema.parse(request.query);
        const data = await dependencies.service.listEligibleProviders(query);
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },

    /**
     * @desc Contact-free detail for one eligible Provider/Team.
     * @route GET /api/v1/browse/providers/:providerId/teams/:teamId
     * @access Guest or authenticated
     * @explanation Re-evaluates Eligibility and fails closed when not eligible.
     */
    async getProviderDetail(request, response, next): Promise<void> {
      try {
        getOptionalBrowsePrincipal(response);
        const params = browseProviderDetailParamsSchema.parse(request.params);
        const query = browseProviderDetailQuerySchema.parse(request.query);
        const data = await dependencies.service.getEligibleProviderDetail({
          providerId: params.providerId,
          teamId: params.teamId,
          query,
          principal: getOptionalBrowsePrincipal(response),
        });
        sendSuccess(request, response, 200, data);
      } catch (error) {
        next(mapZod(error));
      }
    },
  };
}

function mapZod(error: unknown): unknown {
  if (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    (error as { name: unknown }).name === "ZodError" &&
    "issues" in error
  ) {
    return new AppError({
      code: "VALIDATION_FAILED",
      message: "Browse request validation failed",
      statusCode: 400,
      details: {
        issues: Array.isArray((error as { issues: unknown }).issues)
          ? ((error as { issues: readonly Record<string, unknown>[] }).issues).map(
              (issue) => ({
                path: Array.isArray(issue["path"])
                  ? issue["path"].join(".")
                  : "",
                code: issue["code"],
                message: issue["message"],
              }),
            )
          : [],
      },
    });
  }
  return error;
}
