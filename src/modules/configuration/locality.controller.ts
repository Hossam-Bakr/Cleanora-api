import type { Request, RequestHandler, Response } from "express";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import { AppError } from "#shared/errors/app-error";
import { sendSuccess } from "#shared/http/api-response";

import { rethrowLocalityAsAppError, LocalityError } from "./locality.types.js";
import type { LocalityService } from "./locality.service.js";
import {
  cityIdParamsSchema,
  cityDistrictsParamsSchema,
  countryIdParamsSchema,
  createCityBodySchema,
  createDistrictBodySchema,
  districtIdParamsSchema,
  patchCityBodySchema,
  patchDistrictBodySchema,
  putCountryTimeZoneBodySchema,
} from "./locality.schema.js";

export interface LocalityControllerDependencies {
  readonly localityService: LocalityService;
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

function mapHandlerError(error: unknown): unknown {
  if (error instanceof LocalityError) {
    try {
      rethrowLocalityAsAppError(error);
    } catch (mapped) {
      return mapped;
    }
  }
  return error;
}

/**
 * Thin Staff locality/time-zone HTTP handlers. Business workflows live in
 * LocalityService; routes never touch Prisma or repositories directly.
 */
export function createLocalityController(
  dependencies: LocalityControllerDependencies,
): {
  readonly listCities: RequestHandler;
  readonly createCity: RequestHandler;
  readonly patchCity: RequestHandler;
  readonly listDistricts: RequestHandler;
  readonly createDistrict: RequestHandler;
  readonly patchDistrict: RequestHandler;
  readonly getCountryTimeZone: RequestHandler;
  readonly putCountryTimeZone: RequestHandler;
} {
  return {
    /**
     * @desc List cities for staff management within one country.
     * @route GET /api/v1/staff/configuration/countries/:countryId/cities
     * @access staff_admin with configuration.localities.read
     */
    async listCities(request, response, next): Promise<void> {
      try {
        const params = countryIdParamsSchema.parse(request.params);
        const cities = await dependencies.localityService.listCities(
          metaFrom(request, response),
          params.countryId,
        );
        sendSuccess(request, response, 200, cities);
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Create a city within one country.
     * @route POST /api/v1/staff/configuration/countries/:countryId/cities
     * @access staff_admin with configuration.localities.write + reason
     */
    async createCity(request, response, next): Promise<void> {
      try {
        const params = countryIdParamsSchema.parse(request.params);
        const body = createCityBodySchema.parse(request.body);
        const result = await dependencies.localityService.createCity(
          metaFrom(request, response),
          params.countryId,
          body,
        );
        sendSuccess(request, response, result.replayed ? 200 : 201, result.city, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Update a city's localized content or active status at an exact version.
     * @route PATCH /api/v1/staff/configuration/cities/:cityId
     * @access staff_admin with configuration.localities.write + reason
     */
    async patchCity(request, response, next): Promise<void> {
      try {
        const params = cityIdParamsSchema.parse(request.params);
        const body = patchCityBodySchema.parse(request.body);
        const result = await dependencies.localityService.patchCity(
          metaFrom(request, response),
          params.cityId,
          body,
        );
        sendSuccess(request, response, 200, result.city, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc List districts for staff management within one city.
     * @route GET /api/v1/staff/configuration/cities/:cityId/districts
     * @access staff_admin with configuration.localities.read
     */
    async listDistricts(request, response, next): Promise<void> {
      try {
        const params = cityDistrictsParamsSchema.parse(request.params);
        const districts = await dependencies.localityService.listDistricts(
          metaFrom(request, response),
          params.cityId,
        );
        sendSuccess(request, response, 200, districts);
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Create a district within one city.
     * @route POST /api/v1/staff/configuration/cities/:cityId/districts
     * @access staff_admin with configuration.localities.write + reason
     */
    async createDistrict(request, response, next): Promise<void> {
      try {
        const params = cityDistrictsParamsSchema.parse(request.params);
        const body = createDistrictBodySchema.parse(request.body);
        const result = await dependencies.localityService.createDistrict(
          metaFrom(request, response),
          params.cityId,
          body,
        );
        sendSuccess(
          request,
          response,
          result.replayed ? 200 : 201,
          result.district,
          { replayed: result.replayed },
        );
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Update a district's localized content or active status at an exact version.
     * @route PATCH /api/v1/staff/configuration/districts/:districtId
     * @access staff_admin with configuration.localities.write + reason
     */
    async patchDistrict(request, response, next): Promise<void> {
      try {
        const params = districtIdParamsSchema.parse(request.params);
        const body = patchDistrictBodySchema.parse(request.body);
        const result = await dependencies.localityService.patchDistrict(
          metaFrom(request, response),
          params.districtId,
          body,
        );
        sendSuccess(request, response, 200, result.district, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Read the country's configured IANA operating time zone.
     * @route GET /api/v1/staff/configuration/countries/:countryId/time-zone
     * @access staff_admin with configuration.localities.read
     */
    async getCountryTimeZone(request, response, next): Promise<void> {
      try {
        const params = countryIdParamsSchema.parse(request.params);
        const timeZone = await dependencies.localityService.getCountryTimeZone(
          metaFrom(request, response),
          params.countryId,
        );
        sendSuccess(request, response, 200, timeZone);
      } catch (error) {
        next(mapHandlerError(error));
      }
    },

    /**
     * @desc Set the country's configured IANA operating time zone at an exact version.
     * @route PUT /api/v1/staff/configuration/countries/:countryId/time-zone
     * @access staff_admin with configuration.localities.write + reason
     */
    async putCountryTimeZone(request, response, next): Promise<void> {
      try {
        const params = countryIdParamsSchema.parse(request.params);
        const body = putCountryTimeZoneBodySchema.parse(request.body);
        const result = await dependencies.localityService.putCountryTimeZone(
          metaFrom(request, response),
          params.countryId,
          body,
        );
        sendSuccess(request, response, 200, result.timeZone, {
          replayed: result.replayed,
        });
      } catch (error) {
        next(mapHandlerError(error));
      }
    },
  };
}
