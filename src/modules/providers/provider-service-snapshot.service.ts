/**
 * Internal snapshot-ready current facts for a later Booking consumer (R1-P09).
 * One repeatable-read Catalog+Configuration+Provider snapshot; no Booking
 * persistence and no HTTP adapter.
 */

import type { SnapshotReadyCatalogServiceDefinition } from "#modules/catalog/catalog.public";

import {
  evaluateOfferingUsability,
  selectExactLocaleServiceNote,
} from "./domain/provider-service-readiness.policy.js";
import { formatMinorUnitsToCanonicalDecimal, isCurrentProviderServicePriceValid } from "./domain/provider-service.policy.js";
import type {
  ProviderServiceTransactionContext,
  ProviderServiceUnitOfWork,
} from "./domain/provider-service.ports.js";
import type {
  ProviderServiceExactLocale,
  ProviderServicePriceSnapshot,
  ProviderServiceSnapshot,
  ProviderServiceSnapshotReadyResult,
} from "./domain/provider-service.types.js";
import { isProviderServiceSerializationFailure } from "./infrastructure/provider-service-prisma-errors.js";
import type { ProviderServiceSnapshotReader } from "./providers.public.js";

const MAX_SNAPSHOT_ATTEMPTS = 3;

export interface ProviderServiceSnapshotServiceDependencies {
  readonly unitOfWork: ProviderServiceUnitOfWork;
}

/**
 * @desc Resolve code-to-ID and return one consistent snapshot-ready DTO.
 * @access Application service
 * @explanation Retries the whole repeatable-read transaction at most three
 * times on retryable serialization failure, then returns CONFLICT. Stable
 * non-qualifying states collapse to UNAVAILABLE without Booking writes.
 */
export class ProviderServiceSnapshotService
  implements ProviderServiceSnapshotReader
{
  public constructor(
    private readonly dependencies: ProviderServiceSnapshotServiceDependencies,
  ) {}

  /**
   * @desc Internal current-facts read for Provider ID + Catalog code + country + locale.
   * @access Application service
   */
  public async getSnapshotReadyFacts(input: {
    readonly providerId: string;
    readonly catalogServiceCode: string;
    readonly countryCode: string;
    readonly locale: ProviderServiceExactLocale;
  }): Promise<ProviderServiceSnapshotReadyResult> {
    if (input.locale !== "AR" && input.locale !== "EN") return { status: "UNAVAILABLE" };
    for (let attempt = 1; attempt <= MAX_SNAPSHOT_ATTEMPTS; attempt += 1) {
      try {
        return await this.dependencies.unitOfWork.runReadSnapshot((context) =>
          this.readOnce(context, input),
        );
      } catch (error: unknown) {
        if (
          !isProviderServiceSerializationFailure(error) ||
          attempt === MAX_SNAPSHOT_ATTEMPTS
        ) {
          if (isProviderServiceSerializationFailure(error)) {
            return {
              status: "CONFLICT",
              code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
            };
          }
          throw error;
        }
      }
    }

    return {
      status: "CONFLICT",
      code: "PROVIDER_SERVICE_SNAPSHOT_CONFLICT",
    };
  }

  private async readOnce(
    context: ProviderServiceTransactionContext,
    input: {
      readonly providerId: string;
      readonly catalogServiceCode: string;
      readonly countryCode: string;
      readonly locale: ProviderServiceExactLocale;
    },
  ): Promise<ProviderServiceSnapshotReadyResult> {
    const provider = await context.providerServices.lockProviderScope(
      input.providerId,
    );
    if (provider === null || provider.applicationStatus !== "APPROVED") {
      return { status: "UNAVAILABLE" };
    }

    const catalogReference =
      await context.catalog.resolveSelectableProviderOffering({
        serviceCode: input.catalogServiceCode,
        countryCode: input.countryCode,
      });
    if (catalogReference === null || !catalogReference.selectableForCountry) {
      return { status: "UNAVAILABLE" };
    }

    const matched =
      await context.providerServices.findEnabledOfferingWithEffectivePrice({
        providerId: input.providerId,
        catalogServiceId: catalogReference.serviceId,
      });
    if (matched === null) {
      return { status: "UNAVAILABLE" };
    }

    const { offering, effectivePrice } = matched;
    if (
      provider.countryCode === null ||
      provider.countryCode !== input.countryCode ||
      effectivePrice.countryCodeAtProposal !== input.countryCode
    ) {
      return { status: "UNAVAILABLE" };
    }

    const pricingPolicy = await context.pricingPolicy.readForCountry({
      countryCode: input.countryCode,
    });
    const pricingConfigurationValid = isCurrentProviderServicePriceValid({
      pricingPolicy, effectivePrice, countryCode: input.countryCode,
    });

    const priceUnitActive = catalogReference.activePriceUnits.some(
      (unit) => unit.id === effectivePrice.catalogPriceUnitId,
    );

    const usability = evaluateOfferingUsability({
      enabled: offering.enabled,
      estimatedDurationMinutes: offering.estimatedDurationMinutes,
      noteAr: offering.noteAr,
      noteEn: offering.noteEn,
      catalogSelectable: catalogReference.selectableForCountry,
      priceUnitActive,
      hasEffectivePrice: true,
      hasPendingPrice: false,
      pricingConfigurationValid,
    });
    if (!usability.usable) {
      return { status: "UNAVAILABLE" };
    }

    const catalogDefinition = await context.catalog.getSnapshotReadyDefinition({
      serviceCode: input.catalogServiceCode,
      countryCode: input.countryCode,
      locale: input.locale,
    });
    if (catalogDefinition === null) {
      return { status: "UNAVAILABLE" };
    }

    if (
      catalogDefinition.serviceId !== catalogReference.serviceId ||
      catalogDefinition.serviceCode !== catalogReference.serviceCode
    ) {
      return { status: "UNAVAILABLE" };
    }

    const priceUnit = catalogDefinition.priceUnits.find(
      (unit) => unit.id === effectivePrice.catalogPriceUnitId,
    );
    if (priceUnit === undefined) {
      return { status: "UNAVAILABLE" };
    }

    if (effectivePrice.effectiveAt === null) {
      return { status: "UNAVAILABLE" };
    }

    const effectiveAtIso = effectivePrice.effectiveAt.toISOString();

    return {
      status: "AVAILABLE",
      value: mapAvailableValue({
        offering,
        effectivePrice,
        effectiveAtIso,
        catalogDefinition,
        priceUnit: {
          id: priceUnit.id,
          code: priceUnit.code,
          label: priceUnit.label,
        },
        locale: input.locale,
      }),
    };
  }
}

function mapAvailableValue(input: {
  readonly offering: ProviderServiceSnapshot;
  readonly effectivePrice: ProviderServicePriceSnapshot;
  readonly effectiveAtIso: string;
  readonly catalogDefinition: SnapshotReadyCatalogServiceDefinition;
  readonly priceUnit: {
    readonly id: string;
    readonly code: string;
    readonly label: string;
  };
  readonly locale: ProviderServiceExactLocale;
}): Extract<
  ProviderServiceSnapshotReadyResult,
  { status: "AVAILABLE" }
>["value"] {
  const {
    offering,
    effectivePrice,
    effectiveAtIso,
    catalogDefinition,
    priceUnit,
    locale,
  } = input;
  return {
    providerId: offering.providerId,
    providerServiceId: offering.id,
    providerServiceVersion: offering.version,
    catalogServiceId: catalogDefinition.serviceId,
    catalogServiceCode: catalogDefinition.serviceCode,
    catalogServiceVersion: catalogDefinition.serviceVersion,
    estimatedDurationMinutes: offering.estimatedDurationMinutes,
    serviceNote: selectExactLocaleServiceNote({
      locale,
      noteAr: offering.noteAr,
      noteEn: offering.noteEn,
    }),
    providerServicePriceId: effectivePrice.id,
    price: formatMinorUnitsToCanonicalDecimal(
      effectivePrice.providerPriceMinorUnits,
      effectivePrice.currencyDecimalPlaces,
    ),
    minimumCharge: formatMinorUnitsToCanonicalDecimal(
      effectivePrice.minimumChargeMinorUnits,
      effectivePrice.currencyDecimalPlaces,
    ),
    currencyCode: effectivePrice.currencyCode,
    effectiveAt: effectiveAtIso,
    priceUnit,
    catalogDefinition,
  };
}
