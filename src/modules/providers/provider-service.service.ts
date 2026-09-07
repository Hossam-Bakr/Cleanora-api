/**
 * Provider Service create, configuration, price-proposal, and lifecycle
 * orchestration (R1-P09 US1–US2). Authority recheck, receipt replay,
 * Catalog/Configuration validation, and audit all commit inside one
 * Providers-owned serializable transaction.
 */

import { randomUUID } from "node:crypto";

import type {
  ProviderIdentityReader,
  TransactionalProviderServiceStaffAuthorizer,
} from "#modules/authentication/authentication.public";

import {
  decideProviderServiceManagementAuthorization,
  type ProviderServiceAuthorizationFacts,
} from "./domain/provider-service-authorization.policy.js";
import { ProviderServiceError } from "./domain/provider-service.errors.js";
import type {
  ProviderServiceTransactionContext,
  ProviderServiceUnitOfWork,
} from "./domain/provider-service.ports.js";
import {
  assertEnableAllowed,
  buildConfigurationScopeKey,
  buildCreateOfferingScopeKey,
  buildLifecycleScopeKey,
  buildPriceProposalScopeKey,
  buildStaffPriceDecisionScopeKey,
  collectEnableBlockerCodes,
  fingerprintProviderServiceCommand,
  formatMinorUnitsToCanonicalDecimal,
  initialPriceStatusFromApprovalRequired,
  isCurrentProviderServicePriceValid,
  normalizeCatalogServiceCode,
  planPriceProposalSupersessions,
  priceHistoryEventForInitialStatus,
  PRICE_PROPOSAL_REASON_CODE,
  REPLACED_BY_NEW_PROPOSAL_REASON_CODE,
  requireActiveCatalogPriceUnit,
  requirePositiveExpectedVersion,
  resolveLifecycleTransition,
  resolvePriceTransition,
  validateDurationMinutes,
  validateNotePair,
  validatePriceAndMinimumAgainstMaximum,
  validateProviderReasonText,
  validateStaffDecisionReason,
} from "./domain/provider-service.policy.js";
import type {
  ProviderServiceNotePair,
  ProviderServicePriceSafeFacts,
  ProviderServicePriceSnapshot,
  ProviderServiceReceiptLookup,
  ProviderServiceSafeResultJson,
} from "./domain/provider-service.types.js";
import {
  managementDtoFromSafeResultJson,
  managementDtoToSafeResultJson,
  staffDecisionDtoFromSafeResultJson,
  staffDecisionDtoToSafeResultJson,
  toProviderServiceManagementDto,
  toStaffPriceDecisionResultDto,
  type ProviderServiceManagementDto,
  type StaffPriceDecisionResultDto,
} from "./provider-service.dto.js";

const STAFF_APPROVE_PERMISSION = "providers.services.prices.approve" as const;
export interface CreateProviderServiceCommand {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: 0;
  readonly catalogServiceCode: string;
  readonly catalogPriceUnitId: string;
  readonly price: string;
  readonly minimumCharge: string;
  readonly estimatedDurationMinutes: number;
  readonly noteAr?: string | null;
  readonly noteEn?: string | null;
}

export interface ReplaceProviderServiceConfigurationCommand {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly estimatedDurationMinutes: number;
  readonly noteAr: string | null;
  readonly noteEn: string | null;
}

export interface ProposeProviderServicePriceCommand {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly catalogPriceUnitId: string;
  readonly price: string;
  readonly minimumCharge: string;
  readonly reason: string;
}

export interface ProviderServiceLifecycleCommand {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly requestId: string;
  readonly idempotencyKey: string;
  readonly expectedVersion: number;
  readonly action: "ENABLE" | "DISABLE";
  readonly reason: string;
}

export interface StaffPriceDecisionCommand {
  readonly actorUserId: string;
  readonly providerId: string;
  readonly providerServiceId: string;
  readonly providerServicePriceId: string;
  readonly decision: "APPROVE" | "REJECT";
  readonly reason: string;
  readonly expectedVersion: number;
  readonly requestId: string;
  readonly idempotencyKey: string;
}

export interface ProviderServiceMutationResult {
  readonly offering: ProviderServiceManagementDto;
  readonly replayed: boolean;
}

export interface StaffPriceDecisionMutationResult {
  readonly result: StaffPriceDecisionResultDto;
  readonly replayed: boolean;
}

function priceSafeFacts(
  price: ProviderServicePriceSnapshot,
): ProviderServicePriceSafeFacts {
  return {
    status: price.status,
    providerPrice: formatMinorUnitsToCanonicalDecimal(
      price.providerPriceMinorUnits,
      price.currencyDecimalPlaces,
    ),
    minimumCharge: formatMinorUnitsToCanonicalDecimal(
      price.minimumChargeMinorUnits,
      price.currencyDecimalPlaces,
    ),
    currencyCode: price.currencyCode,
    currencyDecimalPlaces: price.currencyDecimalPlaces,
    catalogPriceUnitId: price.catalogPriceUnitId,
    priceUnitCode: price.priceUnitCodeAtProposal,
    approvalRequiredAtProposal: price.approvalRequiredAtProposal,
    effectiveAt: price.effectiveAt?.toISOString() ?? null,
    rejectedAt: price.rejectedAt?.toISOString() ?? null,
    supersededAt: price.supersededAt?.toISOString() ?? null,
  };
}

/**
 * @desc Orchestrate Provider Service create, configuration, price, and lifecycle.
 * @access Application service
 */
export class ProviderServiceService {
  public constructor(
    private readonly dependencies: {
      readonly unitOfWork: ProviderServiceUnitOfWork;
      readonly identityReader: ProviderIdentityReader;
      readonly staffAuthorizer: TransactionalProviderServiceStaffAuthorizer;
      readonly createId?: () => string;
      readonly now?: () => Date;
    },
  ) {}

  /**
   * @desc Create one disabled offering and its initial retained price.
   * @access Application service
   */
  public async createOffering(
    command: CreateProviderServiceCommand,
  ): Promise<ProviderServiceMutationResult> {
    if (command.expectedVersion !== 0) {
      throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
        details: { field: "expectedVersion", reason: "CREATE_REQUIRES_ZERO" },
      });
    }

    const catalogServiceCode = normalizeCatalogServiceCode(
      command.catalogServiceCode,
    );
    const notes = validateNotePair({
      noteAr: command.noteAr,
      noteEn: command.noteEn,
    });
    const estimatedDurationMinutes = validateDurationMinutes(
      command.estimatedDurationMinutes,
    );
    const requestFingerprint = fingerprintProviderServiceCommand({
      operation: "CREATE_OFFERING",
      providerId: command.providerId,
      expectedVersion: 0,
      catalogServiceCode,
      catalogPriceUnitId: command.catalogPriceUnitId,
      price: command.price,
      minimumCharge: command.minimumCharge,
      estimatedDurationMinutes,
      notes,
    });
    const scopeKey = buildCreateOfferingScopeKey(
      command.providerId,
      catalogServiceCode,
    );

    const outerIdentity = await this.loadIdentityFacts(command.actorUserId);

    return this.dependencies.unitOfWork.runMutation(async (context) => {
      const authority = await this.resolveAuthority(context, {
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        outerIdentity,
        lockMembership: true,
      });
      this.assertAllowed("CREATE_OFFERING", authority.facts);

      const receipt = await context.providerServices.findReceipt({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
      });
      if (receipt !== null) {
        return this.replayOrConflict(receipt, requestFingerprint);
      }

      const countryCode = authority.provider.countryCode;
      if (countryCode === null || authority.provider.countryId === null) {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }

      const catalogRef = await context.catalog.resolveSelectableProviderOffering({
        serviceCode: catalogServiceCode,
        countryCode,
      });
      if (catalogRef === null || !catalogRef.selectableForCountry) {
        throw new ProviderServiceError("PROVIDER_SERVICE_CATALOG_UNAVAILABLE");
      }

      const existing = await context.providerServices.findOfferingByCatalogService(
        command.providerId,
        catalogRef.serviceId,
      );
      if (existing !== null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_ALREADY_EXISTS");
      }

      const unit = requireActiveCatalogPriceUnit({
        catalogPriceUnitId: command.catalogPriceUnitId,
        activePriceUnits: catalogRef.activePriceUnits,
      });

      const policyResult = await context.pricingPolicy.readForCountry({
        countryCode,
      });
      if (policyResult.status !== "AVAILABLE") {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }
      const policy = policyResult.value;
      const amounts = validatePriceAndMinimumAgainstMaximum({
        priceDecimal: command.price,
        minimumChargeDecimal: command.minimumCharge,
        maximumPriceDecimal: policy.maximumPrice,
        decimalPlaces: policy.currency.decimalPlaces,
      });

      const now = this.dependencies.now?.() ?? new Date();
      const providerServiceId = this.dependencies.createId?.() ?? randomUUID();
      const priceId = this.dependencies.createId?.() ?? randomUUID();
      const priceStatus = initialPriceStatusFromApprovalRequired(
        policy.approvalRequired,
      );
      const priceEvent = priceHistoryEventForInitialStatus(priceStatus);

      const offering = await context.providerServices.createOffering({
        providerId: command.providerId,
        providerServiceId,
        catalogServiceId: catalogRef.serviceId,
        estimatedDurationMinutes,
        notes,
        expectedCreateVersion: 0,
      });

      const price = await context.providerServices.createPrice({
        id: priceId,
        providerId: command.providerId,
        providerServiceId,
        catalogServiceId: catalogRef.serviceId,
        catalogPriceUnitId: unit.id,
        priceUnitCodeAtProposal: unit.code,
        countryIdAtProposal: policy.countryId,
        countryCodeAtProposal: policy.countryCode,
        currencyId: policy.currency.id,
        currencyCode: policy.currency.code,
        currencyDecimalPlaces: policy.currency.decimalPlaces,
        providerPriceMinorUnits: amounts.providerPriceMinorUnits,
        minimumChargeMinorUnits: amounts.minimumChargeMinorUnits,
        maximumPriceMinorUnitsAtProposal: amounts.maximumPriceMinorUnits,
        approvalRequiredAtProposal: policy.approvalRequired,
        status: priceStatus,
        proposedByUserId: command.actorUserId,
        effectiveAt: priceStatus === "EFFECTIVE" ? now : null,
        createdAt: now,
      });

      const managementDto = toProviderServiceManagementDto({
        offering,
        catalogReference: catalogRef,
        effectivePrice: priceStatus === "EFFECTIVE" ? price : null,
        pendingPrice: priceStatus === "PENDING" ? price : null,
      });
      const safeResultJson = managementDtoToSafeResultJson(managementDto);

      await context.providerServices.appendStatusHistory({
        providerId: command.providerId,
        providerServiceId,
        event: "OFFERING_CREATED",
        fromEnabled: null,
        toEnabled: false,
        actorUserId: command.actorUserId,
        reasonCode: "INITIAL_OFFERING",
        reasonText: null,
        safeBefore: null,
        safeAfter: {
          enabled: false,
          estimatedDurationMinutes,
          noteArPresent: notes.noteAr !== null,
          noteEnPresent: notes.noteEn !== null,
          catalogServiceId: catalogRef.serviceId,
          version: offering.version,
        },
        requestId: command.requestId,
        aggregateVersion: offering.version,
        operationKey: `offering-created:${providerServiceId}`,
        receipt: {
          scopeKey,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint,
          safeResultCode: "PROVIDER_SERVICE_CREATED",
          safeResultJson,
        },
      });

      await context.providerServices.appendPriceHistory({
        providerId: command.providerId,
        providerServiceId,
        providerServicePriceId: priceId,
        event: priceEvent,
        fromStatus: null,
        toStatus: priceStatus,
        actorUserId: command.actorUserId,
        reasonCode: "INITIAL_OFFERING",
        reasonText: null,
        safeBefore: null,
        safeAfter: priceSafeFacts(price),
        requestId: command.requestId,
        aggregateVersion: offering.version,
        operationKey: `price-initial:${priceId}`,
        receipt: {
          scopeKey: null,
          idempotencyKey: null,
          requestFingerprint: null,
          safeResultCode: null,
          safeResultJson: null,
        },
      });

      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.services.create",
        targetType: "PROVIDER_SERVICE",
        targetId: providerServiceId,
        reason: "INITIAL_OFFERING",
        requestId: command.requestId,
        context: {
          providerId: command.providerId,
          version: offering.version,
          catalogServiceId: catalogRef.serviceId,
          priceStatus,
        },
      });

      return { offering: managementDto, replayed: false };
    });
  }

  /**
   * @desc Replace duration and optional localized notes without mutating price.
   * @access Application service
   */
  public async replaceConfiguration(
    command: ReplaceProviderServiceConfigurationCommand,
  ): Promise<ProviderServiceMutationResult> {
    requirePositiveExpectedVersion(command.expectedVersion);

    const notes = validateNotePair({
      noteAr: command.noteAr,
      noteEn: command.noteEn,
    });
    const estimatedDurationMinutes = validateDurationMinutes(
      command.estimatedDurationMinutes,
    );
    const requestFingerprint = fingerprintProviderServiceCommand({
      operation: "REPLACE_CONFIGURATION",
      providerId: command.providerId,
      providerServiceId: command.providerServiceId,
      expectedVersion: command.expectedVersion,
      estimatedDurationMinutes,
      notes,
    });
    const scopeKey = buildConfigurationScopeKey(
      command.providerId,
      command.providerServiceId,
    );

    const outerIdentity = await this.loadIdentityFacts(command.actorUserId);

    return this.dependencies.unitOfWork.runMutation(async (context) => {
      const authority = await this.resolveAuthority(context, {
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        outerIdentity,
        lockMembership: true,
      });
      this.assertAllowed("UPDATE_CONFIGURATION", authority.facts);

      const receipt = await context.providerServices.findReceipt({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
      });
      if (receipt !== null) {
        return this.replayOrConflict(receipt, requestFingerprint);
      }

      const locked = await context.providerServices.lockOffering(
        command.providerId,
        command.providerServiceId,
      );
      if (locked === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }

      const countryCode = authority.provider.countryCode;
      if (countryCode === null) {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }

      const catalogRef = await context.catalog.getProviderOfferingReference({
        serviceId: locked.catalogServiceId,
        countryCode,
      });
      if (catalogRef === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED");
      }

      const updated = await context.providerServices.updateConfiguration({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        expectedVersion: command.expectedVersion,
        providerServiceId: command.providerServiceId,
        estimatedDurationMinutes,
        notes,
      });

      const [effectivePrice, pendingPrice] = await Promise.all([
        context.providerServices.findCurrentEffectivePrice(
          command.providerId,
          command.providerServiceId,
        ),
        context.providerServices.findCurrentPendingPrice(
          command.providerId,
          command.providerServiceId,
        ),
      ]);

      const managementDto = toProviderServiceManagementDto({
        offering: updated,
        catalogReference: catalogRef,
        pricingConfigurationValid: isCurrentProviderServicePriceValid({ pricingPolicy: await context.pricingPolicy.readForCountry({ countryCode }), effectivePrice, countryCode }),
        effectivePrice,
        pendingPrice,
      });
      const safeResultJson = managementDtoToSafeResultJson(managementDto);

      await context.providerServices.appendStatusHistory({
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        event: "CONFIGURATION_UPDATED",
        fromEnabled: locked.enabled,
        toEnabled: locked.enabled,
        actorUserId: command.actorUserId,
        reasonCode: "OFFERING_CONFIGURATION_UPDATED",
        reasonText: null,
        safeBefore: {
          enabled: locked.enabled,
          estimatedDurationMinutes: locked.estimatedDurationMinutes,
          noteArPresent: locked.noteAr !== null,
          noteEnPresent: locked.noteEn !== null,
          catalogServiceId: locked.catalogServiceId,
          version: locked.version,
        },
        safeAfter: {
          enabled: updated.enabled,
          estimatedDurationMinutes: updated.estimatedDurationMinutes,
          noteArPresent: updated.noteAr !== null,
          noteEnPresent: updated.noteEn !== null,
          catalogServiceId: updated.catalogServiceId,
          version: updated.version,
        },
        requestId: command.requestId,
        aggregateVersion: updated.version,
        operationKey: `configuration-updated:${command.providerServiceId}:${updated.version}`,
        receipt: {
          scopeKey,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint,
          safeResultCode: "PROVIDER_SERVICE_CONFIGURATION_UPDATED",
          safeResultJson,
        },
      });

      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.services.configuration.replace",
        targetType: "PROVIDER_SERVICE",
        targetId: command.providerServiceId,
        reason: "OFFERING_CONFIGURATION_UPDATED",
        requestId: command.requestId,
        context: {
          providerId: command.providerId,
          fromVersion: locked.version,
          toVersion: updated.version,
        },
      });

      return { offering: managementDto, replayed: false };
    });
  }

  /**
   * @desc Submit a retained replacement price proposal (never edits older rows).
   * @access Application service
   */
  public async proposePrice(
    command: ProposeProviderServicePriceCommand,
  ): Promise<ProviderServiceMutationResult> {
    requirePositiveExpectedVersion(command.expectedVersion);
    const reason = validateProviderReasonText(command.reason);
    const requestFingerprint = fingerprintProviderServiceCommand({
      operation: "PROPOSE_PRICE",
      providerId: command.providerId,
      providerServiceId: command.providerServiceId,
      expectedVersion: command.expectedVersion,
      catalogPriceUnitId: command.catalogPriceUnitId,
      price: command.price,
      minimumCharge: command.minimumCharge,
      reason,
    });
    const scopeKey = buildPriceProposalScopeKey(
      command.providerId,
      command.providerServiceId,
    );

    const outerIdentity = await this.loadIdentityFacts(command.actorUserId);

    return this.dependencies.unitOfWork.runMutation(async (context) => {
      const authority = await this.resolveAuthority(context, {
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        outerIdentity,
        lockMembership: true,
      });
      this.assertAllowed("PROPOSE_PRICE", authority.facts);

      const receipt = await context.providerServices.findReceipt({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
      });
      if (receipt !== null) {
        return this.replayOrConflict(receipt, requestFingerprint);
      }

      const locked = await context.providerServices.lockOffering(
        command.providerId,
        command.providerServiceId,
      );
      if (locked === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }

      const countryCode = authority.provider.countryCode;
      if (countryCode === null || authority.provider.countryId === null) {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }

      const catalogRef = await context.catalog.getProviderOfferingReference({
        serviceId: locked.catalogServiceId,
        countryCode,
      });
      if (catalogRef === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED");
      }
      if (!catalogRef.selectableForCountry) {
        throw new ProviderServiceError("PROVIDER_SERVICE_CATALOG_UNAVAILABLE");
      }

      const unit = requireActiveCatalogPriceUnit({
        catalogPriceUnitId: command.catalogPriceUnitId,
        activePriceUnits: catalogRef.activePriceUnits,
      });

      const policyResult = await context.pricingPolicy.readForCountry({
        countryCode,
      });
      if (policyResult.status !== "AVAILABLE") {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }
      const policy = policyResult.value;
      const amounts = validatePriceAndMinimumAgainstMaximum({
        priceDecimal: command.price,
        minimumChargeDecimal: command.minimumCharge,
        maximumPriceDecimal: policy.maximumPrice,
        decimalPlaces: policy.currency.decimalPlaces,
      });

      const [priorEffective, priorPending] = await Promise.all([
        context.providerServices.findCurrentEffectivePrice(
          command.providerId,
          command.providerServiceId,
        ),
        context.providerServices.findCurrentPendingPrice(
          command.providerId,
          command.providerServiceId,
        ),
      ]);

      const plan = planPriceProposalSupersessions({
        approvalRequired: policy.approvalRequired,
        priorPendingId: priorPending?.id ?? null,
        priorEffectiveId: priorEffective?.id ?? null,
      });

      const bumped = await context.providerServices.bumpAggregateVersion({
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        expectedVersion: command.expectedVersion,
      });
      if (bumped === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_VERSION_CONFLICT");
      }

      const now = this.dependencies.now?.() ?? new Date();
      const priceId = this.dependencies.createId?.() ?? randomUUID();

      if (plan.supersedePendingId !== null && priorPending !== null) {
        const transition = resolvePriceTransition({
          fromStatus: "PENDING",
          trigger: "SUPERSEDE_PENDING",
        });
        const superseded = await context.providerServices.transitionPriceStatus({
          providerId: command.providerId,
          providerServiceId: command.providerServiceId,
          providerServicePriceId: priorPending.id,
          fromStatus: "PENDING",
          toStatus: "SUPERSEDED",
          transitionedAt: now,
        });
        await context.providerServices.appendPriceHistory({
          providerId: command.providerId,
          providerServiceId: command.providerServiceId,
          providerServicePriceId: priorPending.id,
          event: transition.event,
          fromStatus: "PENDING",
          toStatus: "SUPERSEDED",
          actorUserId: command.actorUserId,
          reasonCode: REPLACED_BY_NEW_PROPOSAL_REASON_CODE,
          reasonText: null,
          safeBefore: priceSafeFacts(priorPending),
          safeAfter: priceSafeFacts(superseded),
          requestId: command.requestId,
          aggregateVersion: bumped.version,
          operationKey: `price-supersede-pending:${priorPending.id}:${bumped.version}`,
          receipt: {
            scopeKey: null,
            idempotencyKey: null,
            requestFingerprint: null,
            safeResultCode: null,
            safeResultJson: null,
          },
        });
      }

      if (plan.supersedeEffectiveId !== null && priorEffective !== null) {
        const transition = resolvePriceTransition({
          fromStatus: "EFFECTIVE",
          trigger: "SUPERSEDE_EFFECTIVE",
        });
        const superseded = await context.providerServices.transitionPriceStatus({
          providerId: command.providerId,
          providerServiceId: command.providerServiceId,
          providerServicePriceId: priorEffective.id,
          fromStatus: "EFFECTIVE",
          toStatus: "SUPERSEDED",
          transitionedAt: now,
        });
        await context.providerServices.appendPriceHistory({
          providerId: command.providerId,
          providerServiceId: command.providerServiceId,
          providerServicePriceId: priorEffective.id,
          event: transition.event,
          fromStatus: "EFFECTIVE",
          toStatus: "SUPERSEDED",
          actorUserId: command.actorUserId,
          reasonCode: REPLACED_BY_NEW_PROPOSAL_REASON_CODE,
          reasonText: null,
          safeBefore: priceSafeFacts(priorEffective),
          safeAfter: priceSafeFacts(superseded),
          requestId: command.requestId,
          aggregateVersion: bumped.version,
          operationKey: `price-supersede-effective:${priorEffective.id}:${bumped.version}`,
          receipt: {
            scopeKey: null,
            idempotencyKey: null,
            requestFingerprint: null,
            safeResultCode: null,
            safeResultJson: null,
          },
        });
      }

      const proposeTrigger =
        plan.newStatus === "PENDING" ? "PROPOSE_PENDING" : "PROPOSE_IMMEDIATE";
      const proposeTransition = resolvePriceTransition({
        fromStatus: null,
        trigger: proposeTrigger,
      });

      const price = await context.providerServices.createPrice({
        id: priceId,
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        catalogServiceId: locked.catalogServiceId,
        catalogPriceUnitId: unit.id,
        priceUnitCodeAtProposal: unit.code,
        countryIdAtProposal: policy.countryId,
        countryCodeAtProposal: policy.countryCode,
        currencyId: policy.currency.id,
        currencyCode: policy.currency.code,
        currencyDecimalPlaces: policy.currency.decimalPlaces,
        providerPriceMinorUnits: amounts.providerPriceMinorUnits,
        minimumChargeMinorUnits: amounts.minimumChargeMinorUnits,
        maximumPriceMinorUnitsAtProposal: amounts.maximumPriceMinorUnits,
        approvalRequiredAtProposal: policy.approvalRequired,
        status: plan.newStatus,
        proposedByUserId: command.actorUserId,
        effectiveAt: plan.newStatus === "EFFECTIVE" ? now : null,
        createdAt: now,
      });

      const [effectivePrice, pendingPrice] = await Promise.all([
        context.providerServices.findCurrentEffectivePrice(
          command.providerId,
          command.providerServiceId,
        ),
        context.providerServices.findCurrentPendingPrice(
          command.providerId,
          command.providerServiceId,
        ),
      ]);

      const managementDto = toProviderServiceManagementDto({
        offering: bumped,
        catalogReference: catalogRef,
        pricingConfigurationValid: isCurrentProviderServicePriceValid({ pricingPolicy: await context.pricingPolicy.readForCountry({ countryCode }), effectivePrice, countryCode }),
        effectivePrice,
        pendingPrice,
      });
      const safeResultJson = managementDtoToSafeResultJson(managementDto);

      await context.providerServices.appendPriceHistory({
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        providerServicePriceId: priceId,
        event: proposeTransition.event,
        fromStatus: null,
        toStatus: plan.newStatus,
        actorUserId: command.actorUserId,
        reasonCode: PRICE_PROPOSAL_REASON_CODE,
        reasonText: reason,
        safeBefore: null,
        safeAfter: priceSafeFacts(price),
        requestId: command.requestId,
        aggregateVersion: bumped.version,
        operationKey: `price-proposal:${priceId}`,
        receipt: {
          scopeKey,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint,
          safeResultCode: "PROVIDER_SERVICE_PRICE_PROPOSED",
          safeResultJson,
        },
      });

      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.services.price.propose",
        targetType: "PROVIDER_SERVICE",
        targetId: command.providerServiceId,
        reason: PRICE_PROPOSAL_REASON_CODE,
        requestId: command.requestId,
        context: {
          providerId: command.providerId,
          priceId,
          priceStatus: plan.newStatus,
          fromVersion: command.expectedVersion,
          toVersion: bumped.version,
        },
      });

      return { offering: managementDto, replayed: false };
    });
  }

  /**
   * @desc Enable or disable an offering with reason, version, and idempotency.
   * @access Application service
   */
  public async applyLifecycle(
    command: ProviderServiceLifecycleCommand,
  ): Promise<ProviderServiceMutationResult> {
    requirePositiveExpectedVersion(command.expectedVersion);
    const reason = validateProviderReasonText(command.reason);
    const requestFingerprint = fingerprintProviderServiceCommand({
      operation: "LIFECYCLE",
      providerId: command.providerId,
      providerServiceId: command.providerServiceId,
      expectedVersion: command.expectedVersion,
      action: command.action,
      reason,
    });
    const scopeKey = buildLifecycleScopeKey(
      command.providerId,
      command.providerServiceId,
    );

    const outerIdentity = await this.loadIdentityFacts(command.actorUserId);

    return this.dependencies.unitOfWork.runMutation(async (context) => {
      const authority = await this.resolveAuthority(context, {
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        outerIdentity,
        lockMembership: true,
      });
      this.assertAllowed(
        command.action === "ENABLE" ? "ENABLE_OFFERING" : "DISABLE_OFFERING",
        authority.facts,
      );

      const receipt = await context.providerServices.findReceipt({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
      });
      if (receipt !== null) {
        return this.replayOrConflict(receipt, requestFingerprint);
      }

      const locked = await context.providerServices.lockOffering(
        command.providerId,
        command.providerServiceId,
      );
      if (locked === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }

      if (locked.version !== command.expectedVersion) {
        throw new ProviderServiceError("PROVIDER_SERVICE_VERSION_CONFLICT");
      }

      const countryCode = authority.provider.countryCode;
      if (countryCode === null) {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }

      const catalogRef = await context.catalog.getProviderOfferingReference({
        serviceId: locked.catalogServiceId,
        countryCode,
      });
      if (catalogRef === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_DEPENDENCY_FAILED");
      }

      const [effectivePrice, pendingPrice] = await Promise.all([
        context.providerServices.findCurrentEffectivePrice(
          command.providerId,
          command.providerServiceId,
        ),
        context.providerServices.findCurrentPendingPrice(
          command.providerId,
          command.providerServiceId,
        ),
      ]);

      const transition = resolveLifecycleTransition({
        currentlyEnabled: locked.enabled,
        action: command.action,
      });

      if (transition.kind === "NO_OP") {
        const managementDto = toProviderServiceManagementDto({
          offering: locked,
          catalogReference: catalogRef,
          pricingConfigurationValid: isCurrentProviderServicePriceValid({ pricingPolicy: await context.pricingPolicy.readForCountry({ countryCode }), effectivePrice, countryCode }),
          effectivePrice,
          pendingPrice,
        });
        return { offering: managementDto, replayed: false };
      }

      if (command.action === "ENABLE") {
        const pricingPolicy = await context.pricingPolicy.readForCountry({ countryCode });
        if (!isCurrentProviderServicePriceValid({ pricingPolicy, effectivePrice, countryCode })) {
          throw new ProviderServiceError("PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE");
        }
        const priceUnitId =
          effectivePrice?.catalogPriceUnitId ??
          pendingPrice?.catalogPriceUnitId ??
          null;
        const priceUnitActive =
          priceUnitId !== null &&
          catalogRef.activePriceUnits.some((unit) => unit.id === priceUnitId);
        assertEnableAllowed(
          collectEnableBlockerCodes({
            estimatedDurationMinutes: locked.estimatedDurationMinutes,
            noteAr: locked.noteAr,
            noteEn: locked.noteEn,
            catalogSelectable: catalogRef.selectableForCountry,
            priceUnitActive,
            hasEffectivePrice: effectivePrice !== null,
            hasPendingPrice: pendingPrice !== null,
          }),
        );
      }

      const updated = await context.providerServices.setEnabled({
        actorUserId: command.actorUserId,
        providerId: command.providerId,
        requestId: command.requestId,
        idempotencyKey: command.idempotencyKey,
        expectedVersion: command.expectedVersion,
        providerServiceId: command.providerServiceId,
        enabled: transition.toEnabled,
      });

      const managementDto = toProviderServiceManagementDto({
        offering: updated,
        catalogReference: catalogRef,
        pricingConfigurationValid: isCurrentProviderServicePriceValid({ pricingPolicy: await context.pricingPolicy.readForCountry({ countryCode }), effectivePrice, countryCode }),
        effectivePrice,
        pendingPrice,
      });
      const safeResultJson = managementDtoToSafeResultJson(managementDto);

      await context.providerServices.appendStatusHistory({
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        event: transition.event,
        fromEnabled: transition.fromEnabled,
        toEnabled: transition.toEnabled,
        actorUserId: command.actorUserId,
        reasonCode: transition.reasonCode,
        reasonText: reason,
        safeBefore: {
          enabled: locked.enabled,
          estimatedDurationMinutes: locked.estimatedDurationMinutes,
          noteArPresent: locked.noteAr !== null,
          noteEnPresent: locked.noteEn !== null,
          catalogServiceId: locked.catalogServiceId,
          version: locked.version,
        },
        safeAfter: {
          enabled: updated.enabled,
          estimatedDurationMinutes: updated.estimatedDurationMinutes,
          noteArPresent: updated.noteAr !== null,
          noteEnPresent: updated.noteEn !== null,
          catalogServiceId: updated.catalogServiceId,
          version: updated.version,
        },
        requestId: command.requestId,
        aggregateVersion: updated.version,
        operationKey: `lifecycle:${transition.event}:${command.providerServiceId}:${updated.version}`,
        receipt: {
          scopeKey,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint,
          safeResultCode:
            transition.event === "OFFERING_ENABLED"
              ? "PROVIDER_SERVICE_ENABLED"
              : "PROVIDER_SERVICE_DISABLED",
          safeResultJson,
        },
      });

      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action:
          transition.event === "OFFERING_ENABLED"
            ? "providers.services.lifecycle.enable"
            : "providers.services.lifecycle.disable",
        targetType: "PROVIDER_SERVICE",
        targetId: command.providerServiceId,
        reason: transition.reasonCode,
        requestId: command.requestId,
        context: {
          providerId: command.providerId,
          fromVersion: locked.version,
          toVersion: updated.version,
        },
      });

      return { offering: managementDto, replayed: false };
    });
  }

  /**
   * @desc Approve or reject one PENDING price under current country policy.
   * @access Application service
   * @explanation Identical completed replays return after Staff authz and
   * exact-target checks, before fresh policy/version validation (DEC-050).
   * A later approvalRequired=false change never auto-transitions retained
   * prices; only fresh Staff decisions require current approvalRequired=true.
   */
  public async decidePriceProposal(
    command: StaffPriceDecisionCommand,
  ): Promise<StaffPriceDecisionMutationResult> {
    if (
      !Number.isSafeInteger(command.expectedVersion) ||
      command.expectedVersion < 1
    ) {
      throw new ProviderServiceError("REQUEST_VALIDATION_FAILED", undefined, {
        details: { field: "expectedVersion", reason: "POSITIVE_REQUIRED" },
      });
    }

    const reason = validateStaffDecisionReason(command.reason);
    const requestFingerprint = fingerprintProviderServiceCommand({
      operation: "STAFF_PRICE_DECISION",
      providerId: command.providerId,
      providerServiceId: command.providerServiceId,
      providerServicePriceId: command.providerServicePriceId,
      decision: command.decision,
      expectedVersion: command.expectedVersion,
      reason,
    });
    const scopeKey = buildStaffPriceDecisionScopeKey(
      command.providerId,
      command.providerServiceId,
      command.providerServicePriceId,
    );

    await this.assertOuterStaffApprovePermission(command.actorUserId);

    return this.dependencies.unitOfWork.runMutation(async (context) => {
      const permitted = await context.staffAuthorizer.authorize(
        command.actorUserId,
        STAFF_APPROVE_PERMISSION,
      );
      if (!permitted) {
        throw new ProviderServiceError("PROVIDER_SERVICE_FORBIDDEN");
      }

      const targetPrice = await context.providerServices.findPrice(
        command.providerId,
        command.providerServiceId,
        command.providerServicePriceId,
      );
      if (targetPrice === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }

      const receipt = await context.providerServices.findReceipt({
        scopeKey,
        idempotencyKey: command.idempotencyKey,
      });
      if (receipt !== null) {
        return this.replayStaffDecisionOrConflict(receipt, requestFingerprint);
      }

      if (targetPrice.status !== "PENDING") {
        throw new ProviderServiceError("PROVIDER_SERVICE_PRICE_NOT_PENDING");
      }

      const provider = await context.providerServices.lockProviderScope(
        command.providerId,
      );
      if (provider === null || provider.countryCode === null) {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }

      const policyResult = await context.pricingPolicy.readForCountry({
        countryCode: provider.countryCode,
      });
      if (policyResult.status !== "AVAILABLE") {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE",
        );
      }
      if (!policyResult.value.approvalRequired) {
        throw new ProviderServiceError(
          "PROVIDER_SERVICE_PRICE_APPROVAL_NOT_REQUIRED",
        );
      }

      if (command.decision === "APPROVE" && !isCurrentProviderServicePriceValid({
        pricingPolicy: policyResult, effectivePrice: targetPrice, countryCode: provider.countryCode,
      })) {
        throw new ProviderServiceError("PROVIDER_SERVICE_PRICING_CONFIGURATION_UNAVAILABLE");
      }

      const locked = await context.providerServices.lockOffering(
        command.providerId,
        command.providerServiceId,
      );
      if (locked === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
      }
      if (locked.version !== command.expectedVersion) {
        throw new ProviderServiceError("PROVIDER_SERVICE_VERSION_CONFLICT");
      }

      const now = this.dependencies.now?.() ?? new Date();
      const bumped = await context.providerServices.bumpAggregateVersion({
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        expectedVersion: command.expectedVersion,
      });
      if (bumped === null) {
        throw new ProviderServiceError("PROVIDER_SERVICE_VERSION_CONFLICT");
      }

      const effectiveAfter: ProviderServicePriceSnapshot | null =
        await context.providerServices.findCurrentEffectivePrice(
          command.providerId,
          command.providerServiceId,
        );

      if (command.decision === "APPROVE") {
        const approveTransition = resolvePriceTransition({
          fromStatus: "PENDING",
          trigger: "STAFF_APPROVE",
        });

        if (effectiveAfter !== null) {
          const supersedeTransition = resolvePriceTransition({
            fromStatus: "EFFECTIVE",
            trigger: "SUPERSEDE_EFFECTIVE",
          });
          const superseded =
            await context.providerServices.transitionPriceStatus({
              providerId: command.providerId,
              providerServiceId: command.providerServiceId,
              providerServicePriceId: effectiveAfter.id,
              fromStatus: "EFFECTIVE",
              toStatus: "SUPERSEDED",
              transitionedAt: now,
            });
          await context.providerServices.appendPriceHistory({
            providerId: command.providerId,
            providerServiceId: command.providerServiceId,
            providerServicePriceId: superseded.id,
            event: supersedeTransition.event,
            fromStatus: "EFFECTIVE",
            toStatus: "SUPERSEDED",
            actorUserId: command.actorUserId,
            reasonCode: "PRICE_SUPERSEDED_BY_STAFF_APPROVAL",
            reasonText: reason,
            safeBefore: priceSafeFacts(effectiveAfter),
            safeAfter: priceSafeFacts(superseded),
            requestId: command.requestId,
            aggregateVersion: bumped.version,
            operationKey: `price-superseded-effective:${superseded.id}:${bumped.version}`,
            receipt: {
              scopeKey: null,
              idempotencyKey: null,
              requestFingerprint: null,
              safeResultCode: null,
              safeResultJson: null,
            },
          });
        }

        const approved = await context.providerServices.transitionPriceStatus({
          providerId: command.providerId,
          providerServiceId: command.providerServiceId,
          providerServicePriceId: command.providerServicePriceId,
          fromStatus: "PENDING",
          toStatus: "EFFECTIVE",
          transitionedAt: now,
        });

        const result = toStaffPriceDecisionResultDto({
          decision: "APPROVE",
          providerId: command.providerId,
          providerServiceId: command.providerServiceId,
          providerServicePriceId: approved.id,
          priceStatus: "EFFECTIVE",
          version: bumped.version,
          effectivePriceId: approved.id,
        });
        const safeResultJson = staffDecisionDtoToSafeResultJson(result);

        await context.providerServices.appendPriceHistory({
          providerId: command.providerId,
          providerServiceId: command.providerServiceId,
          providerServicePriceId: approved.id,
          event: approveTransition.event,
          fromStatus: "PENDING",
          toStatus: "EFFECTIVE",
          actorUserId: command.actorUserId,
          reasonCode: "PRICE_APPROVED",
          reasonText: reason,
          safeBefore: priceSafeFacts(targetPrice),
          safeAfter: priceSafeFacts(approved),
          requestId: command.requestId,
          aggregateVersion: bumped.version,
          operationKey: `price-approved:${approved.id}:${bumped.version}`,
          receipt: {
            scopeKey,
            idempotencyKey: command.idempotencyKey,
            requestFingerprint,
            safeResultCode: "PROVIDER_SERVICE_PRICE_APPROVED",
            safeResultJson,
          },
        });

        await context.audit.append({
          actorType: "USER",
          actorId: command.actorUserId,
          action: "providers.services.prices.approve",
          targetType: "PROVIDER_SERVICE_PRICE",
          targetId: approved.id,
          reason: "PRICE_APPROVED",
          requestId: command.requestId,
          context: {
            providerId: command.providerId,
            providerServiceId: command.providerServiceId,
            decision: "APPROVE",
            version: bumped.version,
            reasonText: reason,
          },
        });

        return { result, replayed: false };
      }

      const rejectTransition = resolvePriceTransition({
        fromStatus: "PENDING",
        trigger: "STAFF_REJECT",
      });
      const rejected = await context.providerServices.transitionPriceStatus({
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        providerServicePriceId: command.providerServicePriceId,
        fromStatus: "PENDING",
        toStatus: "REJECTED",
        transitionedAt: now,
      });

      const result = toStaffPriceDecisionResultDto({
        decision: "REJECT",
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        providerServicePriceId: rejected.id,
        priceStatus: "REJECTED",
        version: bumped.version,
        effectivePriceId: effectiveAfter?.id ?? null,
      });
      const safeResultJson = staffDecisionDtoToSafeResultJson(result);

      await context.providerServices.appendPriceHistory({
        providerId: command.providerId,
        providerServiceId: command.providerServiceId,
        providerServicePriceId: rejected.id,
        event: rejectTransition.event,
        fromStatus: "PENDING",
        toStatus: "REJECTED",
        actorUserId: command.actorUserId,
        reasonCode: "PRICE_REJECTED",
        reasonText: reason,
        safeBefore: priceSafeFacts(targetPrice),
        safeAfter: priceSafeFacts(rejected),
        requestId: command.requestId,
        aggregateVersion: bumped.version,
        operationKey: `price-rejected:${rejected.id}:${bumped.version}`,
        receipt: {
          scopeKey,
          idempotencyKey: command.idempotencyKey,
          requestFingerprint,
          safeResultCode: "PROVIDER_SERVICE_PRICE_REJECTED",
          safeResultJson,
        },
      });

      await context.audit.append({
        actorType: "USER",
        actorId: command.actorUserId,
        action: "providers.services.prices.reject",
        targetType: "PROVIDER_SERVICE_PRICE",
        targetId: rejected.id,
        reason: "PRICE_REJECTED",
        requestId: command.requestId,
        context: {
          providerId: command.providerId,
          providerServiceId: command.providerServiceId,
          decision: "REJECT",
          version: bumped.version,
          reasonText: reason,
          ...(effectiveAfter
            ? { effectivePriceId: effectiveAfter.id }
            : {}),
        },
      });

      return { result, replayed: false };
    });
  }

  private replayOrConflict(
    receipt: ProviderServiceReceiptLookup,
    requestFingerprint: string,
  ): ProviderServiceMutationResult {
    if (receipt.requestFingerprint !== requestFingerprint) {
      throw new ProviderServiceError("PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT");
    }
    return {
      offering: managementDtoFromSafeResultJson(receipt.safeResultJson),
      replayed: true,
    };
  }

  private replayStaffDecisionOrConflict(
    receipt: ProviderServiceReceiptLookup,
    requestFingerprint: string,
  ): StaffPriceDecisionMutationResult {
    if (receipt.requestFingerprint !== requestFingerprint) {
      throw new ProviderServiceError("PROVIDER_SERVICE_IDEMPOTENCY_CONFLICT");
    }
    return {
      result: staffDecisionDtoFromSafeResultJson(receipt.safeResultJson),
      replayed: true,
    };
  }

  private async assertOuterStaffApprovePermission(
    actorUserId: string,
  ): Promise<void> {
    const permitted = await this.dependencies.staffAuthorizer.authorize(
      actorUserId,
      STAFF_APPROVE_PERMISSION,
    );
    if (!permitted) {
      throw new ProviderServiceError("PROVIDER_SERVICE_FORBIDDEN");
    }
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

  private async resolveAuthority(
    context: ProviderServiceTransactionContext,
    input: {
      readonly actorUserId: string;
      readonly providerId: string;
      readonly outerIdentity: {
        readonly actorActive: boolean;
        readonly providerAdminEnabled: boolean;
      };
      readonly lockMembership: boolean;
    },
  ): Promise<{
    readonly facts: ProviderServiceAuthorizationFacts;
    readonly provider: {
      readonly id: string;
      readonly applicationStatus: string;
      readonly operationalStatus: string;
      readonly countryId: string | null;
      readonly countryCode: string | null;
    };
  }> {
    const provider = await context.providerServices.lockProviderScope(
      input.providerId,
    );
    if (provider === null) {
      throw new ProviderServiceError("PROVIDER_SERVICE_NOT_FOUND");
    }

    const membership = input.lockMembership
      ? await context.providerServices.lockActorMembership(
          input.providerId,
          input.actorUserId,
        )
      : await context.providerServices.findActorMembership(
          input.providerId,
          input.actorUserId,
        );

    const identity = await context.identityReader.getIdentity(input.actorUserId);
    const facts: ProviderServiceAuthorizationFacts = {
      actorActive: input.outerIdentity.actorActive && identity?.isActiveNonVerificationOnly === true,
      providerAdminEnabled: input.outerIdentity.providerAdminEnabled && identity?.providerAdminEnabled === true,
      providerApproved: provider.applicationStatus === "APPROVED",
      sameProvider: true,
      membershipActive: membership?.active === true,
      managementLevel:
        membership?.active === true ? membership.level : null,
    };

    return { facts, provider };
  }

  private assertAllowed(
    operation:
      | "CREATE_OFFERING"
      | "UPDATE_CONFIGURATION"
      | "PROPOSE_PRICE"
      | "ENABLE_OFFERING"
      | "DISABLE_OFFERING"
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

export type { ProviderServiceNotePair, ProviderServiceSafeResultJson };
