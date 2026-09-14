import { createHash } from "node:crypto";

import type { AuthenticationPrincipal } from "#modules/authentication/authentication.public";
import type {
  CatalogDefinitionReader,
  SnapshotReadyCatalogServiceDefinition,
} from "#modules/catalog/catalog.public";
import type {
  DepositPercentReader,
  LocalityReader,
} from "#modules/configuration/configuration.public";
import type { CustomerAddressSnapshotReader } from "#modules/customers/customers.public";
import {
  isEligibilityError,
  type EligibilityApplicationService,
} from "#modules/eligibility/eligibility.public";
import type { BookingAttachmentReader } from "#modules/media/media.public";
import type { ProviderServiceSnapshotReader } from "#modules/providers/providers.public";

import type {
  AttachBookingMediaBody,
  CancelBookingBody,
  CreateBookingBody,
  ListBookingsQuery,
  PatchBookingBody,
} from "./bookings.command.schema.js";
import {
  BookingAnswerValidationError,
  canonicalizeBookingAnswer,
} from "./bookings.answers.js";
import { isVerifiedCustomerPrincipal } from "./bookings.customer.js";
import { bookingError } from "./bookings.errors.js";
import { quoteBooking } from "./bookings.quote.js";
import type {
  BookingAggregate,
  BookingAnswerRecord,
  BookingAddressRecord,
  BookingsCommandRepository,
} from "./bookings.command.types.js";
import {
  BookingIdempotencyCollision,
  BookingTransitionUnavailable,
  hashBookingRequest,
  presentBooking,
} from "./bookings.command.types.js";

export interface BookingsCommandDependencies {
  readonly repository: BookingsCommandRepository;
  readonly eligibility: Pick<
    EligibilityApplicationService,
    "evaluateEligibility"
  >;
  readonly catalog: Pick<
    CatalogDefinitionReader,
    "getSnapshotReadyDefinitionById"
  >;
  readonly locality: Pick<
    LocalityReader,
    "listActiveCitiesForCountry" | "listActiveDistrictsForCity"
  >;
  readonly depositPercent: DepositPercentReader;
  readonly addresses: CustomerAddressSnapshotReader;
  readonly attachments: BookingAttachmentReader;
  readonly serviceSnapshots: ProviderServiceSnapshotReader;
  readonly activeCountries: {
    getActiveCountryById(
      countryId: string,
    ): Promise<{ readonly id: string; readonly code: string } | null>;
  };
  readonly cancelConfirmed?: (input: {
    readonly customerUserId: string;
    readonly bookingId: string;
    readonly version: number;
    readonly reason: string;
    readonly command: {
      readonly customerUserId: string;
      readonly commandType: "CANCEL";
      readonly idempotencyKey: string;
      readonly requestHash: string;
    };
    readonly responseJson: Record<string, unknown>;
  }) => Promise<{ readonly bookingId: string; readonly status: "CANCELLED" }>;
  readonly readDossier?: (bookingId: string) => Promise<unknown>;
}

const CREW_DB = {
  all_male: "ALL_MALE",
  all_female: "ALL_FEMALE",
  any: "ANY",
} as const;

/**
 * @desc Customer booking commands: draft, quote freeze, cancel, media.
 * @access Bookings module
 */
export class BookingsCommandService {
  public constructor(private readonly deps: BookingsCommandDependencies) {}

  public async createDraft(
    principal: AuthenticationPrincipal,
    body: CreateBookingBody,
    idempotencyKey: string,
  ): Promise<unknown> {
    this.assertCustomer(principal);
    return this.withIdempotency({
      customerUserId: principal.userId,
      commandType: "CREATE",
      idempotencyKey,
      request: body,
      run: async () => {
        const prepared = await this.prepareMutableDraft(principal.userId, body);
        await this.requireTransition("NONE", "DRAFT");
        const created = await this.deps.repository.createDraft({
          customerUserId: principal.userId,
          countryId: body.countryId,
          currencyCode: prepared.quote.currencyCode,
          currencyDecimalPlaces: prepared.quote.decimalPlaces,
          serviceId: body.serviceId,
          providerId: body.providerId,
          teamId: body.teamId,
          cityId: body.cityId,
          districtId: prepared.address.districtId,
          startsAt: new Date(body.startsAt),
          endsAt: new Date(body.endsAt),
          crewPreference: CREW_DB[body.crewPreference],
          requiredTeamUnits: body.requiredTeamUnits,
          locale: body.locale,
          notes: body.notes ?? null,
          depositPercent: prepared.quote.depositPercent,
          eligibilityEvaluationId: prepared.evaluationId,
          quote: prepared.quote,
          item: prepared.item,
          address: prepared.address,
          answers: prepared.answers,
          command: {
            customerUserId: principal.userId,
            commandType: "CREATE",
            idempotencyKey,
            requestHash: hashBookingRequest(body),
          },
        });
        return created;
      },
    });
  }

  public async list(
    principal: AuthenticationPrincipal,
    query: ListBookingsQuery,
  ): Promise<unknown> {
    this.assertCustomer(principal);
    const page = await this.deps.repository.listOwned({
      customerUserId: principal.userId,
      limit: query.limit,
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(query.status === undefined ? {} : { status: query.status }),
    });
    return {
      items: await Promise.all(page.items.map((item) => this.present(item))),
      nextCursor: page.nextCursor,
    };
  }

  public async get(
    principal: AuthenticationPrincipal,
    bookingId: string,
  ): Promise<unknown> {
    this.assertCustomer(principal);
    const booking = await this.requireOwned(principal.userId, bookingId);
    const presented = await this.present(booking);
    if (this.deps.readDossier === undefined) {
      return presented;
    }
    const dossier = await this.deps.readDossier(bookingId);
    if (dossier === null || typeof dossier !== "object") {
      return presented;
    }
    const facts = dossier as {
      readonly response?: unknown;
      readonly cancellation?: unknown;
    };
    return {
      ...presented,
      response: facts.response ?? null,
      cancellation: facts.cancellation ?? null,
    };
  }

  public async patchDraft(
    principal: AuthenticationPrincipal,
    bookingId: string,
    body: PatchBookingBody,
  ): Promise<unknown> {
    this.assertCustomer(principal);
    const current = await this.requireOwned(principal.userId, bookingId);
    if (current.status !== "DRAFT") {
      throw bookingError("TRANSITION_NOT_AVAILABLE");
    }
    if (current.version !== body.version) {
      throw bookingError("CONFLICT");
    }
    const notes = body.notes === undefined ? current.notes : body.notes;
    let address: BookingAddressRecord | null = null;
    if (body.userAddressId !== undefined) {
      address = await this.resolveAddress({
        userId: principal.userId,
        userAddressId: body.userAddressId,
        countryId: current.countryId,
        cityId: current.cityId,
        ...(current.districtId === null
          ? {}
          : { districtId: current.districtId }),
      });
    }
    let answers: readonly BookingAnswerRecord[] | null = null;
    if (body.answers !== undefined) {
      const catalog = await this.loadCatalog(
        current.serviceId,
        current.countryId,
        current.locale,
      );
      answers = this.mapAnswers(catalog, body.answers);
    }
    const updated = await this.deps.repository.replaceDraftContents({
      bookingId,
      customerUserId: principal.userId,
      expectedVersion: body.version,
      notes,
      address,
      answers,
    });
    return this.presentMutation(updated, current.status);
  }

  public async submitForDeposit(
    principal: AuthenticationPrincipal,
    bookingId: string,
    version: number,
    idempotencyKey: string,
  ): Promise<unknown> {
    this.assertCustomer(principal);
    return this.withIdempotency({
      customerUserId: principal.userId,
      commandType: "SUBMIT_FOR_DEPOSIT",
      idempotencyKey,
      request: { bookingId, version },
      run: async () => {
        const current = await this.requireOwned(principal.userId, bookingId);
        if (current.status !== "DRAFT") {
          throw bookingError("TRANSITION_NOT_AVAILABLE");
        }
        if (current.version !== version) {
          throw bookingError("CONFLICT");
        }
        await this.requireTransition("DRAFT", "AWAITING_DEPOSIT");
        if (current.address === null || current.item === null) {
          throw bookingError("VALIDATION_FAILED", {
            reason: "INCOMPLETE_DRAFT",
          });
        }
        const catalog = await this.loadCatalog(
          current.serviceId,
          current.countryId,
          current.locale,
        );
        this.assertRequiredAnswers(catalog, current.answers);
        const prepared = await this.prepareMutableDraft(principal.userId, {
          serviceId: current.serviceId,
          providerId: current.providerId,
          teamId: current.teamId,
          countryId: current.countryId,
          cityId: current.cityId,
          ...(current.districtId === null
            ? {}
            : { districtId: current.districtId }),
          startsAt: current.startsAt,
          endsAt: current.endsAt,
          crewPreference: current.crewPreference,
          requiredTeamUnits: current.requiredTeamUnits,
          locale: current.locale,
          userAddressId: current.address.sourceUserAddressId,
          ...(current.notes === null ? {} : { notes: current.notes }),
          answers: current.answers.map((answer) => ({
            fieldId: answer.fieldId,
            value: answer.value as string | number | boolean | string[],
          })),
        });
        const catalogHash = sha256(prepared.catalog);
        const providerHash = sha256(prepared.providerSnapshot);
        const priceInputHash = sha256({
          price: prepared.providerSnapshot.price,
          minimumCharge: prepared.providerSnapshot.minimumCharge,
          depositPercent: prepared.quote.depositPercent,
          currencyCode: prepared.quote.currencyCode,
        });
        const updated = await this.deps.repository.submitForDeposit({
          bookingId,
          customerUserId: principal.userId,
          expectedVersion: version,
          eligibilityEvaluationId: prepared.evaluationId,
          quote: prepared.quote,
          catalogSnapshot: prepared.catalog,
          providerSnapshot: prepared.providerSnapshot,
          catalogHash,
          providerHash,
          priceInputHash,
          command: {
            customerUserId: principal.userId,
            commandType: "SUBMIT_FOR_DEPOSIT",
            idempotencyKey,
            requestHash: hashBookingRequest({ bookingId, version }),
          },
        });
        return this.requireMutation(updated, "DRAFT");
      },
    });
  }

  public async cancel(
    principal: AuthenticationPrincipal,
    bookingId: string,
    body: CancelBookingBody,
    idempotencyKey: string,
    requestId?: string,
  ): Promise<unknown> {
    this.assertCustomer(principal);
    return this.withIdempotency({
      customerUserId: principal.userId,
      commandType: "CANCEL",
      idempotencyKey,
      request: { bookingId, ...body },
      run: async () => {
        const current = await this.requireOwned(principal.userId, bookingId);
        if (
          (current.status === "CONFIRMED" ||
            current.status === "ACCEPTED" ||
            current.status === "ASSIGNED") &&
          this.deps.cancelConfirmed !== undefined
        ) {
          if (current.version !== body.version) {
            throw bookingError("CONFLICT");
          }
          const updated = {
            ...current,
            status: "CANCELLED" as const,
            version: current.version + 1,
            cancelledAt: new Date().toISOString(),
          };
          await this.deps.cancelConfirmed({
            customerUserId: principal.userId,
            bookingId,
            version: body.version,
            reason: body.reason,
            command: {
              customerUserId: principal.userId,
              commandType: "CANCEL",
              idempotencyKey,
              requestHash: hashBookingRequest({ bookingId, ...body }),
            },
            responseJson: presentBooking(updated),
          });
          return updated;
        }
        await this.requireTransition(current.status, "CANCELLED");
        if (current.version !== body.version) {
          throw bookingError("CONFLICT");
        }
        const updated = await this.deps.repository.cancel({
          bookingId,
          customerUserId: principal.userId,
          expectedVersion: body.version,
          reason: body.reason,
          ...(requestId === undefined ? {} : { requestId }),
          command: {
            customerUserId: principal.userId,
            commandType: "CANCEL",
            idempotencyKey,
            requestHash: hashBookingRequest({ bookingId, ...body }),
          },
        });
        return this.requireMutation(updated, current.status);
      },
    });
  }

  public async attachMedia(
    principal: AuthenticationPrincipal,
    bookingId: string,
    body: AttachBookingMediaBody,
    idempotencyKey: string,
  ): Promise<unknown> {
    this.assertCustomer(principal);
    return this.withIdempotency({
      customerUserId: principal.userId,
      commandType: "ATTACH_MEDIA",
      idempotencyKey,
      request: { bookingId, ...body },
      run: async () => {
        const current = await this.requireOwned(principal.userId, bookingId);
        if (current.status !== "DRAFT") {
          throw bookingError("TRANSITION_NOT_AVAILABLE");
        }
        if (current.version !== body.version) {
          throw bookingError("CONFLICT");
        }
        const attachment = await this.deps.attachments.readOwnedReadyImage({
          userId: principal.userId,
          mediaId: body.mediaId,
        });
        if (attachment === null) {
          throw bookingError("VALIDATION_FAILED", { field: "mediaId" });
        }
        const updated = await this.deps.repository.attachMedia({
          bookingId,
          customerUserId: principal.userId,
          expectedVersion: body.version,
          mediaId: body.mediaId,
          command: {
            customerUserId: principal.userId,
            commandType: "ATTACH_MEDIA",
            idempotencyKey,
            requestHash: hashBookingRequest({ bookingId, ...body }),
          },
        });
        return this.requireMutation(updated, current.status);
      },
    });
  }

  private assertCustomer(principal: AuthenticationPrincipal): void {
    if (!isVerifiedCustomerPrincipal(principal)) {
      throw bookingError("FORBIDDEN");
    }
  }

  private async requireOwned(
    customerUserId: string,
    bookingId: string,
  ): Promise<BookingAggregate> {
    const booking = await this.deps.repository.findOwned({
      bookingId,
      customerUserId,
    });
    if (booking === null) {
      throw bookingError("NOT_FOUND");
    }
    return booking;
  }

  private async presentMutation(
    updated:
      | BookingAggregate
      | "NOT_FOUND"
      | "CONFLICT"
      | "NOT_DRAFT"
      | "NOT_CANCELLABLE"
      | "LIMIT",
    fromStatus: BookingAggregate["status"],
  ): Promise<unknown> {
    return this.present(this.requireMutation(updated, fromStatus));
  }

  private requireMutation(
    updated:
      | BookingAggregate
      | "NOT_FOUND"
      | "CONFLICT"
      | "NOT_DRAFT"
      | "NOT_CANCELLABLE"
      | "LIMIT",
    fromStatus: BookingAggregate["status"],
  ): BookingAggregate {
    if (updated === "NOT_FOUND") {
      throw bookingError("NOT_FOUND");
    }
    if (updated === "CONFLICT") {
      throw bookingError("CONFLICT");
    }
    if (updated === "LIMIT") {
      throw bookingError("VALIDATION_FAILED", { reason: "MEDIA_LIMIT" });
    }
    if (updated === "NOT_DRAFT" || updated === "NOT_CANCELLABLE") {
      throw bookingError("TRANSITION_NOT_AVAILABLE", { fromStatus });
    }
    return updated;
  }

  private async present(
    booking: BookingAggregate,
  ): Promise<Record<string, unknown>> {
    return this.presentStoredBooking(
      presentBooking(booking),
      booking.customerUserId,
    );
  }

  private async presentStoredBooking(
    responseJson: Readonly<Record<string, unknown>>,
    customerUserId: string,
  ): Promise<Record<string, unknown>> {
    const storedMedia = Array.isArray(responseJson["media"])
      ? responseJson["media"]
      : [];
    const media = await Promise.all(
      storedMedia.map(async (storedAttachment) => {
        if (!isBookingMediaResponse(storedAttachment)) {
          return storedAttachment;
        }
        const item = {
          mediaId: storedAttachment.mediaId,
          displayOrder: storedAttachment.displayOrder,
        };
        try {
          const signed = await this.deps.attachments.signOwnedReadyImage({
            userId: customerUserId,
            mediaId: item.mediaId,
          });
          if (signed === null) {
            return item;
          }
          return {
            ...item,
            deliveryUrl: signed.url,
            urlExpiresAt: signed.urlExpiresAt,
          };
        } catch {
          return item;
        }
      }),
    );
    return { ...responseJson, media };
  }

  private async requireTransition(
    from: "NONE" | BookingAggregate["status"],
    to: BookingAggregate["status"],
  ): Promise<void> {
    const allowed = await this.deps.repository.isExecutableTransition({
      actor: "CUSTOMER",
      from,
      to,
    });
    if (!allowed) {
      throw bookingError("TRANSITION_NOT_AVAILABLE");
    }
  }

  private async withIdempotency(input: {
    readonly customerUserId: string;
    readonly commandType:
      "CREATE" | "SUBMIT_FOR_DEPOSIT" | "CANCEL" | "ATTACH_MEDIA";
    readonly idempotencyKey: string;
    readonly request: unknown;
    readonly run: () => Promise<BookingAggregate>;
  }): Promise<unknown> {
    const requestHash = hashBookingRequest(input.request);
    const existing = await this.deps.repository.findCommand({
      customerUserId: input.customerUserId,
      commandType: input.commandType,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing !== null) {
      if (existing.requestHash !== requestHash) {
        throw bookingError("CONFLICT", { reason: "IDEMPOTENCY_BODY_MISMATCH" });
      }
      return this.replayCompletedCommand(existing, input.customerUserId);
    }
    try {
      return this.present(await input.run());
    } catch (error) {
      if (error instanceof BookingTransitionUnavailable) {
        throw bookingError("TRANSITION_NOT_AVAILABLE");
      }
      if (error instanceof BookingIdempotencyCollision) {
        const raced = await this.deps.repository.findCommand({
          customerUserId: input.customerUserId,
          commandType: input.commandType,
          idempotencyKey: input.idempotencyKey,
        });
        if (raced === null || raced.requestHash !== requestHash) {
          throw bookingError("CONFLICT", {
            reason: "IDEMPOTENCY_BODY_MISMATCH",
          });
        }
        return this.replayCompletedCommand(raced, input.customerUserId);
      }
      throw error;
    }
  }

  private async replayCompletedCommand(
    command: {
      readonly bookingId: string | null;
      readonly responseJson: unknown;
    },
    customerUserId: string,
  ): Promise<Record<string, unknown>> {
    if (
      command.bookingId === null ||
      !isJsonObject(command.responseJson) ||
      command.responseJson["id"] !== command.bookingId
    ) {
      throw bookingError("DEPENDENCY_FAILURE", {
        reason: "IDEMPOTENCY_RESULT_UNAVAILABLE",
      });
    }
    return this.presentStoredBooking(command.responseJson, customerUserId);
  }

  private async prepareMutableDraft(userId: string, body: CreateBookingBody) {
    const deposit = await this.deps.depositPercent.readForCountryId(
      body.countryId,
    );
    if (deposit === null) {
      throw bookingError("DEPOSIT_PERCENT_UNAVAILABLE");
    }
    const country = await this.deps.activeCountries.getActiveCountryById(
      body.countryId,
    );
    if (country === null || country.code !== deposit.countryCode) {
      throw bookingError("VALIDATION_FAILED", { field: "countryId" });
    }
    const address = await this.resolveAddress({
      userId,
      userAddressId: body.userAddressId,
      countryId: body.countryId,
      cityId: body.cityId,
      ...(body.districtId === undefined ? {} : { districtId: body.districtId }),
    });
    const catalog = await this.loadCatalog(
      body.serviceId,
      body.countryId,
      body.locale,
    );
    const snapshot = await this.deps.serviceSnapshots.getSnapshotReadyFacts({
      providerId: body.providerId,
      catalogServiceCode: catalog.serviceCode,
      countryCode: country.code,
      locale: body.locale,
    });
    if (snapshot.status === "CONFLICT") {
      throw bookingError("DEPENDENCY_FAILURE", { reason: snapshot.code });
    }
    if (snapshot.status !== "AVAILABLE") {
      throw bookingError("NOT_ELIGIBLE", {
        reason: "PROVIDER_SERVICE_UNAVAILABLE",
      });
    }
    if (snapshot.value.currencyCode !== deposit.currencyCode) {
      throw bookingError("DEPENDENCY_FAILURE", { reason: "CURRENCY_MISMATCH" });
    }
    const evaluation = await this.evaluateTeam({
      serviceId: body.serviceId,
      providerId: body.providerId,
      teamId: body.teamId,
      countryId: body.countryId,
      cityId: body.cityId,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      crewPreference: body.crewPreference,
      requiredTeamUnits: body.requiredTeamUnits,
      ...(address.districtId === null
        ? {}
        : { districtId: address.districtId }),
    });
    const quote = quoteBooking({
      currencyCode: deposit.currencyCode,
      decimalPlaces: deposit.decimalPlaces,
      priceAmount: snapshot.value.price,
      minimumChargeAmount: snapshot.value.minimumCharge,
      depositPercent: deposit.percentCanonical,
    });
    return {
      address,
      catalog,
      providerSnapshot: snapshot.value,
      quote,
      evaluationId: evaluation.evaluationId,
      item: {
        catalogServiceId: catalog.serviceId,
        catalogServiceCode: catalog.serviceCode,
        catalogServiceVersion: catalog.serviceVersion,
        providerServiceId: snapshot.value.providerServiceId,
        providerServiceVersion: snapshot.value.providerServiceVersion,
        providerServicePriceId: snapshot.value.providerServicePriceId,
        estimatedDurationMinutes: snapshot.value.estimatedDurationMinutes,
      },
      answers: this.mapAnswers(catalog, body.answers ?? []),
    };
  }

  private async evaluateTeam(body: {
    readonly serviceId: string;
    readonly providerId: string;
    readonly teamId: string;
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
    readonly startsAt: string;
    readonly endsAt: string;
    readonly crewPreference: "all_male" | "all_female" | "any";
    readonly requiredTeamUnits: number;
  }) {
    try {
      const diagnostic = await this.deps.eligibility.evaluateEligibility({
        mode: "explicit",
        providerIds: [body.providerId],
        serviceId: body.serviceId,
        countryId: body.countryId,
        cityId: body.cityId,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        crewPreference: body.crewPreference,
        requiredTeamUnits: body.requiredTeamUnits,
        ...(body.districtId === undefined
          ? {}
          : { districtId: body.districtId }),
      });
      const team = diagnostic.eligibleTeams.find(
        (row) =>
          row.eligible &&
          row.providerId === body.providerId &&
          row.teamId === body.teamId,
      );
      if (team === undefined) {
        throw bookingError("NOT_ELIGIBLE");
      }
      return diagnostic;
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "NOT_ELIGIBLE"
      ) {
        throw error;
      }
      if (isEligibilityError(error) && error.code === "VALIDATION_FAILED") {
        throw bookingError("VALIDATION_FAILED", error.details);
      }
      throw bookingError("DEPENDENCY_FAILURE", {
        reason: isEligibilityError(error) ? error.code : "ELIGIBILITY_FAILED",
      });
    }
  }

  private async loadCatalog(
    serviceId: string,
    countryId: string,
    locale: "AR" | "EN",
  ): Promise<SnapshotReadyCatalogServiceDefinition> {
    const country =
      await this.deps.activeCountries.getActiveCountryById(countryId);
    if (country === null) {
      throw bookingError("VALIDATION_FAILED", { field: "countryId" });
    }
    const definition = await this.deps.catalog.getSnapshotReadyDefinitionById({
      serviceId,
      countryCode: country.code,
      locale,
    });
    if (definition === null) {
      throw bookingError("VALIDATION_FAILED", { field: "serviceId" });
    }
    return definition;
  }

  private mapAnswers(
    catalog: SnapshotReadyCatalogServiceDefinition,
    answers: readonly { readonly fieldId: string; readonly value: unknown }[],
  ): BookingAnswerRecord[] {
    const fields = new Map(catalog.fields.map((field) => [field.id, field]));
    const mapped: BookingAnswerRecord[] = [];
    const seen = new Set<string>();
    for (const answer of answers) {
      if (seen.has(answer.fieldId)) {
        throw bookingError("VALIDATION_FAILED", {
          field: "answers",
          fieldId: answer.fieldId,
          reason: "DUPLICATE_FIELD",
        });
      }
      seen.add(answer.fieldId);
      const field = fields.get(answer.fieldId);
      if (field === undefined || field.kind === "INFORMATION") {
        throw bookingError("VALIDATION_FAILED", {
          field: "answers",
          fieldId: answer.fieldId,
        });
      }
      try {
        mapped.push({
          fieldId: field.id,
          fieldCode: field.code,
          kind: field.kind,
          value: canonicalizeBookingAnswer(field, answer.value),
        });
      } catch (error) {
        if (error instanceof BookingAnswerValidationError) {
          throw bookingError("VALIDATION_FAILED", {
            field: "answers",
            fieldId: error.fieldId,
          });
        }
        throw error;
      }
    }
    return mapped;
  }

  private assertRequiredAnswers(
    catalog: SnapshotReadyCatalogServiceDefinition,
    answers: readonly BookingAnswerRecord[],
  ): void {
    const provided = new Set(answers.map((answer) => answer.fieldId));
    for (const field of catalog.fields) {
      if (
        field.required &&
        field.kind !== "INFORMATION" &&
        !provided.has(field.id)
      ) {
        throw bookingError("VALIDATION_FAILED", {
          reason: "REQUIRED_ANSWER_MISSING",
          fieldId: field.id,
        });
      }
    }
  }

  private async resolveAddress(input: {
    readonly userId: string;
    readonly userAddressId: string;
    readonly countryId: string;
    readonly cityId: string;
    readonly districtId?: string;
  }): Promise<BookingAddressRecord> {
    const owned = await this.deps.addresses.readOwnedAddress({
      userId: input.userId,
      addressId: input.userAddressId,
    });
    if (owned === null) {
      throw bookingError("VALIDATION_FAILED", { field: "userAddressId" });
    }
    const country = await this.deps.activeCountries.getActiveCountryById(
      input.countryId,
    );
    if (country === null || country.code !== owned.countryCode) {
      throw bookingError("VALIDATION_FAILED", { field: "userAddressId" });
    }
    const cities = await this.deps.locality.listActiveCitiesForCountry(
      owned.countryCode,
    );
    const city = cities.find(
      (row) =>
        row.cityId === input.cityId &&
        matchesLabel(owned.city, row.code, row.nameAr, row.nameEn),
    );
    if (city === undefined) {
      throw bookingError("VALIDATION_FAILED", { field: "userAddressId" });
    }
    const districts = await this.deps.locality.listActiveDistrictsForCity({
      countryCode: owned.countryCode,
      cityId: city.cityId,
    });
    let districtId: string | null = input.districtId ?? null;
    let districtLabel = owned.district;
    if (districts.length > 0) {
      const district = districts.find((row) => {
        const labelOk = matchesLabel(
          owned.district,
          row.code,
          row.nameAr,
          row.nameEn,
        );
        if (!labelOk) {
          return false;
        }
        if (input.districtId !== undefined) {
          return row.districtId === input.districtId;
        }
        return true;
      });
      if (district === undefined) {
        throw bookingError("VALIDATION_FAILED", { field: "userAddressId" });
      }
      districtId = district.districtId;
      districtLabel = district.nameEn;
    } else if (input.districtId !== undefined) {
      throw bookingError("VALIDATION_FAILED", { field: "districtId" });
    }
    return {
      sourceUserAddressId: owned.id,
      countryCode: owned.countryCode,
      cityId: city.cityId,
      districtId,
      cityLabel: city.nameEn,
      districtLabel,
      addressText: owned.addressText,
      building: owned.building,
      floor: owned.floor,
      notes: owned.notes,
    };
  }
}

function matchesLabel(
  stored: string,
  ...candidates: readonly string[]
): boolean {
  const normalized = stored.trim().toLowerCase();
  return candidates.some(
    (candidate) => candidate.trim().toLowerCase() === normalized,
  );
}

function sha256(snapshotFacts: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(snapshotFacts))
    .digest("hex");
}

function isJsonObject(
  candidate: unknown,
): candidate is Readonly<Record<string, unknown>> {
  return (
    candidate !== null &&
    typeof candidate === "object" &&
    !Array.isArray(candidate)
  );
}

function isBookingMediaResponse(
  candidate: unknown,
): candidate is { readonly mediaId: string; readonly displayOrder: number } {
  return (
    isJsonObject(candidate) &&
    typeof candidate["mediaId"] === "string" &&
    typeof candidate["displayOrder"] === "number"
  );
}
