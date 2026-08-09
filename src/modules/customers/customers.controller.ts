import type { RequestHandler } from "express";

import type { AuthenticationPrincipal } from "../authentication/authentication.public.js";
import { customersError } from "./domain/customers.errors.js";
import { ProfileImageService } from "./profile-image.service.js";
import { ProfileService } from "./profile.service.js";
import { AddressService } from "./address.service.js";
import { PreferencesService } from "./preferences.service.js";
import { PrivacyRequestService } from "./privacy-request.service.js";
import { CustomerOverviewService } from "./customer-overview.service.js";
import { sendSuccess } from "#shared/http/api-response";

export interface CustomersControllerDependencies {
  readonly profiles: ProfileService;
  readonly profileImages: ProfileImageService;
  readonly addresses: AddressService;
  readonly preferences: PreferencesService;
  readonly privacyRequests: PrivacyRequestService;
  readonly overview: CustomerOverviewService;
}

export interface CustomersController {
  readonly getIndividual: RequestHandler;
  readonly putIndividual: RequestHandler;
  readonly getCompany: RequestHandler;
  readonly putCompany: RequestHandler;
  readonly getEngineer: RequestHandler;
  readonly putEngineer: RequestHandler;
  readonly getProfileImage: RequestHandler;
  readonly putProfileImage: RequestHandler;
  readonly deleteProfileImage: RequestHandler;
  readonly listAddresses: RequestHandler;
  readonly createAddress: RequestHandler;
  readonly getAddress: RequestHandler;
  readonly updateAddress: RequestHandler;
  readonly deleteAddress: RequestHandler;
  readonly getContactState: RequestHandler;
  readonly getPreferences: RequestHandler;
  readonly putPreferences: RequestHandler;
  readonly submitPrivacyRequest: RequestHandler;
  readonly listPrivacyRequests: RequestHandler;
  readonly getPrivacyRequest: RequestHandler;
  readonly cancelPrivacyRequest: RequestHandler;
  readonly getOverview: RequestHandler;
}

function principal(response: Parameters<RequestHandler>[1]): AuthenticationPrincipal {
  const value = response.locals["authenticationPrincipal"] as
    | AuthenticationPrincipal
    | undefined;
  if (value === undefined) throw customersError("CUSTOMER_PROFILE_FORBIDDEN");
  return value;
}

function addressId(request: Parameters<RequestHandler>[0]): string {
  const value = request.params["addressId"];
  if (typeof value !== "string") throw customersError("CUSTOMER_ADDRESS_NOT_FOUND");
  return value;
}

function privacyRequestId(request: Parameters<RequestHandler>[0]): string {
  const value = request.params["privacyRequestId"];
  if (typeof value !== "string") throw customersError("PRIVACY_REQUEST_NOT_FOUND");
  return value;
}

export function createCustomersController(
  dependencies: CustomersControllerDependencies,
): CustomersController {
  const readProfile = (category: "INDIVIDUAL" | "COMPANY" | "ENGINEER"): RequestHandler =>
    async (request, response, next) => {
      try {
        sendSuccess(
          request,
          response,
          200,
          await dependencies.profiles.get({
            principal: principal(response),
            category,
            requestId: request.requestId,
          }),
        );
      } catch (error) {
        next(error);
      }
    };
  const putProfile = (category: "INDIVIDUAL" | "COMPANY" | "ENGINEER"): RequestHandler =>
    async (request, response, next) => {
      try {
        sendSuccess(
          request,
          response,
          200,
          await dependencies.profiles.upsert({
            principal: principal(response),
            input: { category, ...request.body },
            requestId: request.requestId,
          } as never),
        );
      } catch (error) {
        next(error);
      }
    };
  return {
    getOverview: async (request, response, next) => {
      try {
        sendSuccess(
          request,
          response,
          200,
          await dependencies.overview.get(principal(response), request.requestId),
        );
      } catch (error) {
        next(error);
      }
    },
    getIndividual: readProfile("INDIVIDUAL"),
    putIndividual: putProfile("INDIVIDUAL"),
    getCompany: readProfile("COMPANY"),
    putCompany: putProfile("COMPANY"),
    getEngineer: readProfile("ENGINEER"),
    putEngineer: putProfile("ENGINEER"),
    getProfileImage: async (request, response, next) => {
      try {
        const image = await dependencies.profileImages.get(
          principal(response),
          request.requestId,
        );
        if (image === null) {
          response.status(204).end();
          return;
        }
        sendSuccess(request, response, 200, { profileImage: image });
      } catch (error) {
        next(error);
      }
    },
    putProfileImage: async (request, response, next) => {
      try {
        if (request.file === undefined || !Buffer.isBuffer(request.file.buffer)) {
          throw customersError("CUSTOMER_PROFILE_IMAGE_INVALID");
        }
        const expectedAssociationVersion = (
          request.body as { expectedAssociationVersion: number }
        ).expectedAssociationVersion;
        sendSuccess(
          request,
          response,
          200,
          await dependencies.profileImages.put({
            principal: principal(response),
            bytes: request.file.buffer,
            expectedAssociationVersion,
            requestId: request.requestId,
          }),
        );
      } catch (error) {
        next(error);
      }
    },
    deleteProfileImage: async (request, response, next) => {
      try {
        const expectedAssociationVersion = (
          request.body as { expectedAssociationVersion: number }
        ).expectedAssociationVersion;
        sendSuccess(
          request,
          response,
          200,
          await dependencies.profileImages.remove(
            principal(response),
            expectedAssociationVersion,
            request.requestId,
          ),
        );
      } catch (error) {
        next(error);
      }
    },
    listAddresses: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.addresses.list(
          principal(response), request.requestId,
        ));
      } catch (error) { next(error); }
    },
    createAddress: async (request, response, next) => {
      try {
        sendSuccess(request, response, 201, await dependencies.addresses.create({
          principal: principal(response), input: request.body, requestId: request.requestId,
        }));
      } catch (error) { next(error); }
    },
    getAddress: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.addresses.get(
          principal(response), addressId(request), request.requestId,
        ));
      } catch (error) { next(error); }
    },
    updateAddress: async (request, response, next) => {
      try {
        const { version, ...input } = request.body as { version: number };
        sendSuccess(request, response, 200, await dependencies.addresses.update({
          principal: principal(response), addressId: addressId(request),
          version, input: input as never, requestId: request.requestId,
        }));
      } catch (error) { next(error); }
    },
    deleteAddress: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.addresses.remove(
          principal(response), addressId(request),
          (request.body as { version: number }).version, request.requestId,
        ));
      } catch (error) { next(error); }
    },
    getContactState: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.preferences.contactState(
          principal(response), request.requestId,
        ));
      } catch (error) { next(error); }
    },
    getPreferences: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.preferences.get(
          principal(response), request.requestId,
        ));
      } catch (error) { next(error); }
    },
    putPreferences: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.preferences.replace(
          principal(response), request.body, request.requestId,
        ));
      } catch (error) { next(error); }
    },
    submitPrivacyRequest: async (request, response, next) => {
      try {
        sendSuccess(request, response, 201, await dependencies.privacyRequests.submit(
          principal(response), request.body.purpose, request.requestId,
        ));
      } catch (error) { next(error); }
    },
    listPrivacyRequests: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.privacyRequests.list(
          principal(response), request.requestId,
        ));
      } catch (error) { next(error); }
    },
    getPrivacyRequest: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.privacyRequests.get(
          principal(response), privacyRequestId(request), request.requestId,
        ));
      } catch (error) { next(error); }
    },
    cancelPrivacyRequest: async (request, response, next) => {
      try {
        sendSuccess(request, response, 200, await dependencies.privacyRequests.cancel(
          principal(response), privacyRequestId(request), request.requestId,
        ));
      } catch (error) { next(error); }
    },
  };
}
