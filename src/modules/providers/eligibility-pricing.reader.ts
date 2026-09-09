/**
 * Locale-independent Eligibility pricing projection (R1-P11 / DEC-084).
 *
 * Reuses Providers-owned offering + effective-price selection without inventing
 * a locale for the localized snapshot API.
 */

import type { CatalogDefinitionReader } from "#modules/catalog/catalog.public";
import {
  createTransactionalActiveCountryReader,
  createTransactionalProviderServicePricingPolicyReader,
} from "#modules/configuration/configuration.public";
import type {
  ActiveCountryReader,
  ProviderServicePricingPolicyReader,
} from "#modules/configuration/configuration.public";

import { evaluateOfferingUsability } from "./domain/provider-service-readiness.policy.js";
import {
  formatMinorUnitsToCanonicalDecimal,
  isCurrentProviderServicePriceValid,
} from "./domain/provider-service.policy.js";
import type { ProviderServiceRepository } from "./domain/provider-service.ports.js";
import { PrismaProviderServiceRepository } from "./infrastructure/prisma-provider-service.repository.js";
import { isProviderServiceSerializationFailure } from "./infrastructure/provider-service-prisma-errors.js";
import type {
  EligibilityPricingFacts,
  EligibilityPricingReader,
} from "./providers.public.js";

export interface EligibilityPricingReaderDependencies {
  readonly providerServices: ProviderServiceRepository;
  readonly catalog: CatalogDefinitionReader;
  readonly countries: ActiveCountryReader;
  readonly pricingPolicy: ProviderServicePricingPolicyReader;
}

/**
 * @desc Bound Eligibility pricing reader over Providers-owned selection.
 * @access Application / public projection
 * @explanation Technical CONFLICT rejects the Promise; business unavailability
 * returns UNAVAILABLE with OFFERING_OR_PRICE_UNAVAILABLE only. Does not receive
 * a request interval and never emits REQUESTED_INTERVAL_TOO_SHORT.
 */
export class EligibilityPricingReaderService implements EligibilityPricingReader {
  public constructor(
    private readonly deps: EligibilityPricingReaderDependencies,
  ) {}

  public async getEligibilityPricingFacts(input: {
    readonly providerId: string;
    readonly serviceId: string;
    readonly countryId: string;
  }): Promise<EligibilityPricingFacts> {
    try {
      return await this.readOnce(input);
    } catch (error: unknown) {
      if (isProviderServiceSerializationFailure(error)) {
        throw Object.assign(new Error("PROVIDER_SERVICE_SNAPSHOT_CONFLICT"), {
          code: "CONFLICT",
          cause: error,
        });
      }
      throw error;
    }
  }

  private async readOnce(input: {
    readonly providerId: string;
    readonly serviceId: string;
    readonly countryId: string;
  }): Promise<EligibilityPricingFacts> {
    const unavailable = (): EligibilityPricingFacts => ({
      status: "UNAVAILABLE",
      providerId: input.providerId,
      serviceId: input.serviceId,
      reason: "OFFERING_OR_PRICE_UNAVAILABLE",
      sourceVersion: null,
    });

    const country = await this.deps.countries.getActiveCountryById(
      input.countryId,
    );
    if (country === null) {
      return unavailable();
    }

    const provider = await this.deps.providerServices.lockProviderScope(
      input.providerId,
    );
    if (provider === null || provider.applicationStatus !== "APPROVED") {
      return unavailable();
    }

    const catalogReference = await this.deps.catalog.getProviderOfferingReference(
      {
        serviceId: input.serviceId,
        countryCode: country.code,
      },
    );
    if (catalogReference === null || !catalogReference.selectableForCountry) {
      return unavailable();
    }

    const matched =
      await this.deps.providerServices.findEnabledOfferingWithEffectivePrice({
        providerId: input.providerId,
        catalogServiceId: catalogReference.serviceId,
      });
    if (matched === null) {
      return unavailable();
    }

    const { offering, effectivePrice } = matched;
    if (
      provider.countryCode === null ||
      provider.countryCode !== country.code ||
      effectivePrice.countryCodeAtProposal !== country.code ||
      effectivePrice.effectiveAt === null
    ) {
      return unavailable();
    }

    const pricingPolicy = await this.deps.pricingPolicy.readForCountry({
      countryCode: country.code,
    });
    const pricingConfigurationValid = isCurrentProviderServicePriceValid({
      pricingPolicy,
      effectivePrice,
      countryCode: country.code,
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
      return unavailable();
    }

    return {
      status: "AVAILABLE",
      providerId: input.providerId,
      serviceId: input.serviceId,
      priceAmount: formatMinorUnitsToCanonicalDecimal(
        effectivePrice.providerPriceMinorUnits,
        effectivePrice.currencyDecimalPlaces,
      ),
      minimumChargeAmount: formatMinorUnitsToCanonicalDecimal(
        effectivePrice.minimumChargeMinorUnits,
        effectivePrice.currencyDecimalPlaces,
      ),
      currencyCode: effectivePrice.currencyCode,
      priceUnitId: effectivePrice.catalogPriceUnitId,
      estimatedDurationMinutes: offering.estimatedDurationMinutes,
      sourceVersion: `${offering.version}:${effectivePrice.id}`,
    };
  }
}

/**
 * @desc Bind Eligibility pricing reads to an opaque shared transaction.
 * @access Composition
 * @explanation Does not open a nested transaction; Catalog reader must already
 * be bound to the same transaction context by the caller.
 */
export function createBoundEligibilityPricingReader(
  transactionContext: unknown,
  catalog: CatalogDefinitionReader,
): EligibilityPricingReader {
  return new EligibilityPricingReaderService({
    providerServices: new PrismaProviderServiceRepository(
      transactionContext as ConstructorParameters<
        typeof PrismaProviderServiceRepository
      >[0],
    ),
    catalog,
    countries: createTransactionalActiveCountryReader(transactionContext),
    pricingPolicy:
      createTransactionalProviderServicePricingPolicyReader(transactionContext),
  });
}
