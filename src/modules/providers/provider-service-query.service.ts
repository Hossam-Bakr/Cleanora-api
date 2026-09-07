/**
 * Exact-Provider management list/detail/history reads and dynamic readiness
 * facts for Provider Services (R1-P09).
 */

import type {
  ProviderIdentityReader,
  TransactionalProviderServiceStaffAuthorizer,
} from "#modules/authentication/authentication.public";
import type { ProviderOfferingCatalogReference } from "#modules/catalog/catalog.public";

import {
  decideProviderServiceManagementAuthorization,
  type ProviderServiceAuthorizationFacts,
} from "./domain/provider-service-authorization.policy.js";
import {
  evaluateOfferingUsability,
  evaluateProviderServicesReadiness,
} from "./domain/provider-service-readiness.policy.js";
import { ProviderServiceError } from "./domain/provider-service.errors.js";
import type {
  ProviderServiceTransactionContext,
  ProviderServiceUnitOfWork,
} from "./domain/provider-service.ports.js";
import type {
  ProviderServiceReadinessProjection,
  ProviderServicesReadyFacts,
} from "./domain/provider-service.types.js";
import {
  PRICE_HISTORY_CURSOR_SCOPE,
  STATUS_HISTORY_CURSOR_SCOPE,
  isCurrentProviderServicePriceValid,
} from "./domain/provider-service.policy.js";
import { decodeR1P06Cursor, encodeR1P06Cursor } from "./domain/r1-p06.cursor.js";
import {
  toProviderServiceManagementDto,
  toProviderServicePriceHistoryItemDto,
  toProviderServiceStatusHistoryItemDto,
  toStaffPendingPriceDossierDto,
  toStaffPendingPriceProposalDto,
  type ProviderServiceManagementDto,
  type ProviderServicePriceHistoryItemDto,
  type ProviderServiceStatusHistoryItemDto,
  type StaffPendingPriceDossierDto,
  type StaffPendingPriceProposalDto,
} from "./provider-service.dto.js";
import type { ProviderServicesReadyFactsReader } from "./providers.public.js";

const LIST_CURSOR_SCOPE = "provider-services-list";
const STAFF_PENDING_CURSOR_SCOPE = "staff-provider-service-price-proposals";
const STAFF_APPROVE_PERMISSION = "providers.services.prices.approve" as const;
export interface ListProviderServicesQuery {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface GetProviderServiceQuery {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly providerServiceId: string;
}

export interface ListProviderServiceHistoryQuery {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ProviderServiceListResult {
  readonly items: readonly ProviderServiceManagementDto[];
  readonly nextCursor: string | null;
}

export interface ProviderServicePriceHistoryListResult {
  readonly items: readonly ProviderServicePriceHistoryItemDto[];
  readonly nextCursor: string | null;
}

export interface ProviderServiceStatusHistoryListResult {
  readonly items: readonly ProviderServiceStatusHistoryItemDto[];
  readonly nextCursor: string | null;
}

export interface ListStaffPendingPriceProposalsQuery {
  readonly actorUserId: string;
  readonly countryCode?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface GetStaffPendingPriceDossierQuery {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServicePriceId: string;
}

export interface StaffPendingPriceProposalsResult {
  readonly items: readonly StaffPendingPriceProposalDto[];
  readonly nextCursor: string | null;
}

/**
 * @desc Exact-Provider cursor-paginated management reads with Catalog mapping.
 * @access Application service
 */
export class ProviderServiceQueryService
  implements ProviderServicesReadyFactsReader
{
  public constructor(
    private readonly dependencies: {
      readonly unitOfWork: ProviderServiceUnitOfWork;
      readonly identityReader: ProviderIdentityReader;
      readonly staffAuthorizer: TransactionalProviderServiceStaffAuthorizer;
    },
  ) {}

  /**
   * @desc List offerings for one exact Provider ordered by (createdAt, id).
   * @access Application service
   */
  public async list(
    query: ListProviderServicesQuery,
  ): Promise<ProviderServiceListResult> {
    const page = this.parsePage(query);

    const identity = await this.loadIdentityFacts(query.actorUserId);

    return this.dependencies.unitOfWork.runReadSnapshot(async (context) => {
      const provider = await context.providerServices.lockProviderScope(
        query.providerId,
      );
      if (provider === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }

      const membership = await context.providerServices.findActorMembership(
        query.providerId,
        query.actorUserId,
      );
      const facts = this.toFacts({
        identity: await this.recheckIdentity(context, query.actorUserId, identity),
        providerApproved: provider.applicationStatus === "APPROVED",
        membership,
      });
      this.assertAllowed("LIST_OFFERINGS", facts);

      const countryCode = provider.countryCode;
      if (countryCode === null) {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }

      const rows = await context.providerServices.listOfferings(
        query.providerId,
        {
          limit: page.limit + 1,
          ...(page.cursorCreatedAt === undefined || page.cursorId === undefined
            ? {}
            : {
                cursorCreatedAt: page.cursorCreatedAt,
                cursorId: page.cursorId,
              }),
        },
      );
      const slice = rows.slice(0, page.limit);
      const items: ProviderServiceManagementDto[] = [];

      for (const offering of slice) {
        const catalogReference =
          await context.catalog.getProviderOfferingReference({
            serviceId: offering.catalogServiceId,
            countryCode,
          });
        if (catalogReference === null) {
          throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED");
        }
        const [effectivePrice, pendingPrice] = await Promise.all([
          context.providerServices.findCurrentEffectivePrice(
            query.providerId,
            offering.id,
          ),
          context.providerServices.findCurrentPendingPrice(
            query.providerId,
            offering.id,
          ),
        ]);
        items.push(
          toProviderServiceManagementDto({
            offering,
            catalogReference,
            pricingConfigurationValid: isCurrentProviderServicePriceValid({ pricingPolicy: await context.pricingPolicy.readForCountry({ countryCode }), effectivePrice, countryCode }),
            effectivePrice,
            pendingPrice,
          }),
        );
      }

      const last = slice.at(-1);
      const nextCursor =
        rows.length > page.limit && last !== undefined
          ? encodeR1P06Cursor(LIST_CURSOR_SCOPE, last.createdAt, last.id)
          : null;

      return { items, nextCursor };
    });
  }

  /**
   * @desc Read one exact-Provider offering management detail.
   * @access Application service
   */
  public async get(
    query: GetProviderServiceQuery,
  ): Promise<ProviderServiceManagementDto> {
    const identity = await this.loadIdentityFacts(query.actorUserId);

    return this.dependencies.unitOfWork.runReadSnapshot(async (context) => {
      const provider = await context.providerServices.lockProviderScope(
        query.providerId,
      );
      if (provider === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }

      const membership = await context.providerServices.findActorMembership(
        query.providerId,
        query.actorUserId,
      );
      const facts = this.toFacts({
        identity: await this.recheckIdentity(context, query.actorUserId, identity),
        providerApproved: provider.applicationStatus === "APPROVED",
        membership,
      });
      this.assertAllowed("READ_OFFERING", facts);

      const offering = await context.providerServices.findOffering(
        query.providerId,
        query.providerServiceId,
      );
      if (offering === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }

      const countryCode = provider.countryCode;
      if (countryCode === null) {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }

      const catalogReference =
        await context.catalog.getProviderOfferingReference({
          serviceId: offering.catalogServiceId,
          countryCode,
        });
      if (catalogReference === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED");
      }

      const [effectivePrice, pendingPrice] = await Promise.all([
        context.providerServices.findCurrentEffectivePrice(
          query.providerId,
          query.providerServiceId,
        ),
        context.providerServices.findCurrentPendingPrice(
          query.providerId,
          query.providerServiceId,
        ),
      ]);

      return toProviderServiceManagementDto({
        offering,
        catalogReference,
        pricingConfigurationValid: isCurrentProviderServicePriceValid({ pricingPolicy: await context.pricingPolicy.readForCountry({ countryCode }), effectivePrice, countryCode }),
        effectivePrice,
        pendingPrice,
      });
    });
  }

  /**
   * @desc Cursor-paginated price history without receipt fields.
   * @access Application service
   */
  public async listPriceHistory(
    query: ListProviderServiceHistoryQuery,
  ): Promise<ProviderServicePriceHistoryListResult> {
    const page = this.parsePage(query, PRICE_HISTORY_CURSOR_SCOPE);
    const identity = await this.loadIdentityFacts(query.actorUserId);

    return this.dependencies.unitOfWork.runReadSnapshot(async (context) => {
      await this.assertExactOfferingRead(
        context,
        query,
        identity,
        "READ_PRICE_HISTORY",
      );

      const rows = await context.providerServices.listPriceHistory({
        providerId: query.providerId,
        providerServiceId: query.providerServiceId,
        page: {
          limit: page.limit + 1,
          ...(page.cursorCreatedAt === undefined || page.cursorId === undefined
            ? {}
            : {
                cursorCreatedAt: page.cursorCreatedAt,
                cursorId: page.cursorId,
              }),
        },
      });
      const slice = rows.slice(0, page.limit);
      const items = slice.map(toProviderServicePriceHistoryItemDto);
      const last = slice.at(-1);
      const nextCursor =
        rows.length > page.limit && last !== undefined
          ? encodeR1P06Cursor(
              PRICE_HISTORY_CURSOR_SCOPE,
              last.createdAt,
              last.id,
            )
          : null;
      return { items, nextCursor };
    });
  }

  /**
   * @desc Cursor-paginated enable/disable status history only.
   * @access Application service
   */
  public async listStatusHistory(
    query: ListProviderServiceHistoryQuery,
  ): Promise<ProviderServiceStatusHistoryListResult> {
    const page = this.parsePage(query, STATUS_HISTORY_CURSOR_SCOPE);
    const identity = await this.loadIdentityFacts(query.actorUserId);

    return this.dependencies.unitOfWork.runReadSnapshot(async (context) => {
      await this.assertExactOfferingRead(
        context,
        query,
        identity,
        "READ_STATUS_HISTORY",
      );

      const rows = await context.providerServices.listManagementStatusHistory({
        providerId: query.providerId,
        providerServiceId: query.providerServiceId,
        page: {
          limit: page.limit + 1,
          ...(page.cursorCreatedAt === undefined || page.cursorId === undefined
            ? {}
            : {
                cursorCreatedAt: page.cursorCreatedAt,
                cursorId: page.cursorId,
              }),
        },
      });
      const slice = rows.slice(0, page.limit);
      const items = slice.map(toProviderServiceStatusHistoryItemDto);
      const last = slice.at(-1);
      const nextCursor =
        rows.length > page.limit && last !== undefined
          ? encodeR1P06Cursor(
              STATUS_HISTORY_CURSOR_SCOPE,
              last.createdAt,
              last.id,
            )
          : null;
      return { items, nextCursor };
    });
  }

  /**
   * @desc List PENDING price proposals for Staff approval.
   * @access Application service
   * @explanation Older pending rows remain readable even when current country
   * policy no longer requires approval; only fresh decisions recheck policy.
   */
  public async listStaffPendingPriceProposals(
    query: ListStaffPendingPriceProposalsQuery,
  ): Promise<StaffPendingPriceProposalsResult> {
    await this.assertStaffApprovePermission(query.actorUserId);

    const page = this.parsePage(query, STAFF_PENDING_CURSOR_SCOPE);

    return this.dependencies.unitOfWork.runReadSnapshot(async (context) => {
      const permitted = await context.staffAuthorizer.authorize(
        query.actorUserId,
        STAFF_APPROVE_PERMISSION,
      );
      if (!permitted) {
        throw new ProviderServiceError("PROVIDER_SERVICE_FORBIDDEN");
      }

      const rows = await context.providerServices.listPendingPricesForStaff({
        limit: page.limit + 1,
        ...(query.countryCode === undefined
          ? {}
          : { countryCode: query.countryCode }),
        ...(page.cursorCreatedAt === undefined || page.cursorId === undefined
          ? {}
          : {
              cursorCreatedAt: page.cursorCreatedAt,
              cursorId: page.cursorId,
            }),
      });
      const slice = rows.slice(0, page.limit);
      const items: StaffPendingPriceProposalDto[] = [];

      for (const row of slice) {
        const catalogReference =
          await context.catalog.getProviderOfferingReference({
            serviceId: row.price.catalogServiceId,
            countryCode: row.price.countryCodeAtProposal,
          });
        items.push(
          toStaffPendingPriceProposalDto({
            price: row.price,
            offeringVersion: row.offeringVersion,
            catalogServiceCode:
              catalogReference?.serviceCode ?? row.price.catalogServiceId,
            providerDisplayNameAr: row.providerDisplayNameAr,
            providerDisplayNameEn: row.providerDisplayNameEn,
          }),
        );
      }

      const last = slice.at(-1);
      const nextCursor =
        rows.length > page.limit && last !== undefined
          ? encodeR1P06Cursor(
              STAFF_PENDING_CURSOR_SCOPE,
              last.price.createdAt,
              last.price.id,
            )
          : null;

      return { items, nextCursor };
    });
  }

  /**
   * @desc Read one Staff-safe pending price dossier.
   * @access Application service
   */
  public async getStaffPendingPriceDossier(
    query: GetStaffPendingPriceDossierQuery,
  ): Promise<StaffPendingPriceDossierDto> {
    await this.assertStaffApprovePermission(query.actorUserId);

    return this.dependencies.unitOfWork.runReadSnapshot(async (context) => {
      const permitted = await context.staffAuthorizer.authorize(
        query.actorUserId,
        STAFF_APPROVE_PERMISSION,
      );
      if (!permitted) {
        throw new ProviderServiceError("PROVIDER_SERVICE_FORBIDDEN");
      }

      const price = await context.providerServices.findPrice(
        query.providerId,
        query.providerServiceId,
        query.providerServicePriceId,
      );
      if (price === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }
      if (price.status !== "PENDING") {
        throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_NOT_PENDING");
      }

      const offering = await context.providerServices.findOffering(
        query.providerId,
        query.providerServiceId,
      );
      if (offering === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }

      const [effectivePrice, display, catalogReference] = await Promise.all([
        context.providerServices.findCurrentEffectivePrice(
          query.providerId,
          query.providerServiceId,
        ),
        context.providerServices.findProviderDisplayIdentity(query.providerId),
        context.catalog.getProviderOfferingReference({
          serviceId: offering.catalogServiceId,
          countryCode: price.countryCodeAtProposal,
        }),
      ]);

      return toStaffPendingPriceDossierDto({
        offering,
        pendingPrice: price,
        effectivePrice,
        catalogServiceCode:
          catalogReference?.serviceCode ?? offering.catalogServiceId,
        catalogServiceVersion: catalogReference?.serviceVersion ?? 0,
        providerDisplayNameAr: display?.displayNameAr ?? null,
        providerDisplayNameEn: display?.displayNameEn ?? null,
      });
    });
  }

  /**
   * @desc Dynamic servicesReady facts from one Catalog/Configuration snapshot.
   * @access Application service
   * @explanation Null when the Provider identity is unknown. Never persists a
   * readiness flag or fabricates status history.
   */
  public async getServicesReady(
    providerId: string,
  ): Promise<ProviderServicesReadyFacts | null> {
    return this.dependencies.unitOfWork.runReadSnapshot(async (context) => {
      const provider = await context.providerServices.lockProviderScope(
        providerId,
      );
      if (provider === null) {
        return null;
      }

      const projections =
        await context.providerServices.listReadinessProjections(providerId);
      return deriveServicesReadyFacts({
        context,
        providerId,
        providerApproved: provider.applicationStatus === "APPROVED",
        countryCode: provider.countryCode,
        projections,
      });
    });
  }

  private parsePage(
    query: { readonly cursor?: string; readonly limit?: number },
    cursorScope: string = LIST_CURSOR_SCOPE,
  ): {
    readonly limit: number;
    readonly cursorCreatedAt?: Date;
    readonly cursorId?: string;
  } {
    const limit = query.limit ?? 25;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
        details: { field: "limit", reason: "OUT_OF_RANGE" },
      });
    }

    if (query.cursor === undefined) {
      return { limit };
    }

    try {
      const decoded = decodeR1P06Cursor(query.cursor, cursorScope);
      if (decoded === undefined) {
        throw new Error("invalid");
      }
      return {
        limit,
        cursorCreatedAt: decoded.at,
        cursorId: decoded.id,
      };
    } catch {
      throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
        details: { field: "cursor", reason: "INVALID" },
      });
    }
  }

  private async assertExactOfferingRead(
    context: {
      readonly identityReader: ProviderIdentityReader;
      readonly providerServices: {
        lockProviderScope(
          providerId: string,
        ): Promise<{
          readonly applicationStatus: string;
          readonly countryCode: string | null;
        } | null>;
        findActorMembership(
          providerId: string,
          actorUserId: string,
        ): Promise<{
          readonly level: "OWNER" | "ADMIN";
          readonly active: boolean;
        } | null>;
        findOffering(
          providerId: string,
          providerServiceId: string,
        ): Promise<unknown | null>;
      };
    },
    query: ListProviderServiceHistoryQuery,
    identity: {
      readonly actorActive: boolean;
      readonly providerAdminEnabled: boolean;
    },
    operation: "READ_PRICE_HISTORY" | "READ_STATUS_HISTORY",
  ): Promise<void> {
    const provider = await context.providerServices.lockProviderScope(
      query.providerId,
    );
    if (provider === null) {
      throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
    }

    const membership = await context.providerServices.findActorMembership(
      query.providerId,
      query.actorUserId,
    );
    const facts = this.toFacts({
      identity: await this.recheckIdentity(context, query.actorUserId, identity),
      providerApproved: provider.applicationStatus === "APPROVED",
      membership,
    });
    this.assertAllowed(operation, facts);

    const offering = await context.providerServices.findOffering(
      query.providerId,
      query.providerServiceId,
    );
    if (offering === null) {
      throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
    }
  }

  private async assertStaffApprovePermission(actorUserId: string): Promise<void> {
    const permitted = await this.dependencies.staffAuthorizer.authorize(
      actorUserId,
      STAFF_APPROVE_PERMISSION,
    );
    if (!permitted) {
      throw new ProviderServiceError("PROVIDER_SERVICE_FORBIDDEN");
    }
  }

  private async recheckIdentity(
    context: { readonly identityReader: ProviderIdentityReader },
    actorUserId: string,
    earlier: { readonly actorActive: boolean; readonly providerAdminEnabled: boolean },
  ) {
    const current = await context.identityReader.getIdentity(actorUserId);
    return {
      actorActive: earlier.actorActive && current?.isActiveNonVerificationOnly === true,
      providerAdminEnabled: earlier.providerAdminEnabled && current?.providerAdminEnabled === true,
    };
  }

  private async loadIdentityFacts(actorUserId: string): Promise<{
    readonly actorActive: boolean;
    readonly providerAdminEnabled: boolean;
  }> {
    const identity = await this.dependencies.identityReader.getIdentity(
      actorUserId,
    );
    return {
      actorActive: identity?.isActiveNonVerificationOnly === true,
      providerAdminEnabled: identity?.providerAdminEnabled === true,
    };
  }

  private toFacts(input: {
    readonly identity: {
      readonly actorActive: boolean;
      readonly providerAdminEnabled: boolean;
    };
    readonly providerApproved: boolean;
    readonly membership: {
      readonly level: "OWNER" | "ADMIN";
      readonly active: boolean;
    } | null;
  }): ProviderServiceAuthorizationFacts {
    return {
      actorActive: input.identity.actorActive,
      providerAdminEnabled: input.identity.providerAdminEnabled,
      providerApproved: input.providerApproved,
      sameProvider: true,
      membershipActive: input.membership?.active === true,
      managementLevel:
        input.membership?.active === true ? input.membership.level : null,
    };
  }

  private assertAllowed(
    operation:
      | "LIST_OFFERINGS"
      | "READ_OFFERING"
      | "READ_PRICE_HISTORY"
      | "READ_STATUS_HISTORY",
    facts: ProviderServiceAuthorizationFacts,
  ): void {
    const decision = decideProviderServiceManagementAuthorization(
      operation,
      facts,
    );
    if (!decision.allowed) {
      throw new ProviderServiceError(decision.denialCode);
    }
  }
}

async function deriveServicesReadyFacts(input: {
  readonly context: ProviderServiceTransactionContext;
  readonly providerId: string;
  readonly providerApproved: boolean;
  readonly countryCode: string | null;
  readonly projections: readonly ProviderServiceReadinessProjection[];
}): Promise<ProviderServicesReadyFacts> {
  const { context, providerId, providerApproved, countryCode, projections } =
    input;

  if (projections.length === 0) {
    return evaluateProviderServicesReadiness({
      providerId,
      providerApproved,
      offerings: [],
    });
  }

  if (countryCode === null) {
    return evaluateProviderServicesReadiness({
      providerId,
      providerApproved,
      offerings: projections.map((projection) => ({
        enabled: projection.enabled,
        usable: false,
        blockerCodes: ["OFFERING_CONFIGURATION_INVALID"],
      })),
    });
  }

  const pricingPolicy = await context.pricingPolicy.readForCountry({
    countryCode,
  });

  const offerings = [];
  for (const projection of projections) {
    const catalogReference = await context.catalog.getProviderOfferingReference(
      {
        serviceId: projection.catalogServiceId,
        countryCode,
      },
    );
    const evaluation = evaluateProjectionUsability({
      projection,
      catalogReference,
      pricingPolicy,
      countryCode,
    });
    offerings.push({
      enabled: projection.enabled,
      usable: evaluation.usable,
      blockerCodes: evaluation.blockerCodes,
    });
  }

  return evaluateProviderServicesReadiness({
    providerId,
    providerApproved,
    offerings,
  });
}

function evaluateProjectionUsability(input: {
  readonly projection: ProviderServiceReadinessProjection;
  readonly catalogReference: ProviderOfferingCatalogReference | null;
  readonly pricingPolicy: Awaited<
    ReturnType<
      ProviderServiceTransactionContext["pricingPolicy"]["readForCountry"]
    >
  >;
  readonly countryCode: string;
}) {
  const { projection, catalogReference, pricingPolicy, countryCode } = input;
  const activePrice = projection.effectivePrice;
  const priceUnitId =
    activePrice?.catalogPriceUnitId ??
    projection.pendingPrice?.catalogPriceUnitId ??
    null;
  const priceUnitActive =
    catalogReference !== null &&
    priceUnitId !== null &&
    catalogReference.activePriceUnits.some((unit) => unit.id === priceUnitId);

  const pricingConfigurationValid = isCurrentProviderServicePriceValid({
    pricingPolicy,
    effectivePrice: activePrice,
    countryCode,
  });

  return evaluateOfferingUsability({
    enabled: projection.enabled,
    estimatedDurationMinutes: projection.estimatedDurationMinutes,
    noteAr: projection.noteAr,
    noteEn: projection.noteEn,
    catalogSelectable: catalogReference?.selectableForCountry === true,
    priceUnitActive,
    hasEffectivePrice: activePrice !== null,
    hasPendingPrice: projection.pendingPrice !== null,
    pricingConfigurationValid,
  });
}
