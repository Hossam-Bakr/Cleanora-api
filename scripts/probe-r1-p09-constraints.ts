import { randomUUID } from "node:crypto";
import type { PrismaClient, Prisma } from "../src/generated/prisma/client.js";

/** Probe real PostgreSQL enforcement, then roll back every synthetic row. */
export async function probeR1P09Constraints(
  prisma: PrismaClient,
  sqlState: (error: unknown) => string | null,
): Promise<void> {
  const rollback = new Error("Roll back successful R1-P09 constraint probes");
  let rejected = 0;
  try {
    await prisma.$transaction(async (tx) => {
      const rejects = async (label: string, expected: string, operation: () => Promise<unknown>) => {
        await tx.$executeRawUnsafe("SAVEPOINT r1_p09_probe");
        let failure: unknown;
        try { await operation(); } catch (error) { failure = error; }
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT r1_p09_probe");
        await tx.$executeRawUnsafe("RELEASE SAVEPOINT r1_p09_probe");
        if (failure === undefined || sqlState(failure) !== expected) {
          throw new Error(`R1-P09 ${label}: expected SQLSTATE ${expected}, got ${sqlState(failure)}`, { cause: failure });
        }
        rejected += 1;
      };
      const country = await tx.country.findUniqueOrThrow({ where: { code: "EG" }, include: { defaultCurrency: true } });
      const unit = await tx.servicePriceUnit.findFirstOrThrow();
      const owner = await tx.user.create({ data: { emailNormalized: `p09-probe-${randomUUID()}@example.invalid`, status: "ACTIVE" } });
      const provider = await tx.provider.create({ data: {
        applicationOwnerUserId: owner.id, ownerUserId: owner.id, kind: "INDIVIDUAL_TEAM",
        applicationStatus: "APPROVED", approvedAt: new Date(),
      } });
      const offeringData = { providerId: provider.id, catalogServiceId: unit.serviceId, estimatedDurationMinutes: 90 };
      const offering = await tx.providerService.create({ data: offeringData });
      await rejects("duplicate offering", "23505", () => tx.providerService.create({ data: offeringData }));
      for (const data of [{ estimatedDurationMinutes: 0 }, { estimatedDurationMinutes: 1441 }, { version: 0 }, { noteAr: "only one language" }]) {
        await rejects("offering shape", "23514", () => tx.providerService.update({ where: { id: offering.id }, data }));
      }
      await rejects("offering Catalog foreign key", "23503", () => tx.providerService.update({ where: { id: offering.id }, data: { catalogServiceId: randomUUID() } }));
      const priceData: Prisma.ProviderServicePriceUncheckedCreateInput = {
        providerId: provider.id, providerServiceId: offering.id, catalogServiceId: unit.serviceId,
        catalogPriceUnitId: unit.id, priceUnitCodeAtProposal: unit.code,
        countryIdAtProposal: country.id, countryCodeAtProposal: country.code,
        currencyId: country.defaultCurrencyId, currencyCode: country.defaultCurrency.code,
        currencyDecimalPlaces: country.defaultCurrency.decimalPlaces,
        providerPriceMinorUnits: "12000", minimumChargeMinorUnits: "15000", maximumPriceMinorUnitsAtProposal: "999999",
        approvalRequiredAtProposal: true, status: "PENDING", proposedByUserId: owner.id,
      };
      for (const data of [
        { providerPriceMinorUnits: "0" }, { minimumChargeMinorUnits: "11999" },
        { maximumPriceMinorUnitsAtProposal: "14999" }, { currencyDecimalPlaces: 31 },
        { effectiveAt: new Date() }, { countryCodeAtProposal: "eg" },
      ]) {
        await rejects("price shape", "23514", () => tx.providerServicePrice.create({ data: { ...priceData, ...data } }));
      }
      await rejects("price Provider scope foreign key", "23503", () => tx.providerServicePrice.create({ data: { ...priceData, providerId: randomUUID() } }));
      await rejects("price unit foreign key", "23503", () => tx.providerServicePrice.create({ data: { ...priceData, catalogPriceUnitId: randomUUID() } }));
      const pending = await tx.providerServicePrice.create({ data: priceData });
      await rejects("one pending price", "23505", () => tx.providerServicePrice.create({ data: priceData }));
      const effectiveData = { ...priceData, status: "EFFECTIVE" as const, effectiveAt: new Date() };
      const effective = await tx.providerServicePrice.create({ data: effectiveData });
      await rejects("one effective price", "23505", () => tx.providerServicePrice.create({ data: effectiveData }));
      await rejects("immutable price amount", "55000", () => tx.providerServicePrice.update({ where: { id: pending.id }, data: { providerPriceMinorUnits: "12100" } }));
      await rejects("immutable price delete", "55000", () => tx.providerServicePrice.delete({ where: { id: pending.id } }));
      await tx.providerServicePrice.update({ where: { id: effective.id }, data: { status: "SUPERSEDED", supersededAt: new Date() } });
      await tx.providerServicePrice.update({ where: { id: pending.id }, data: { status: "EFFECTIVE", effectiveAt: new Date() } });
      await rejects("terminal price transition", "55000", () => tx.providerServicePrice.update({ where: { id: effective.id }, data: { status: "EFFECTIVE", supersededAt: null } }));
      const receipt = {
        providerId: provider.id, providerServiceId: offering.id, actorUserId: owner.id,
        reasonCode: "PROBE", safeAfter: {}, requestId: randomUUID(), aggregateVersion: 1,
        scopeKey: "probe", idempotencyKey: randomUUID(), requestFingerprint: "a".repeat(64),
        safeResultCode: "PROBE", safeResultJson: {}, operationKey: randomUUID(),
      };
      const statusData = { ...receipt, event: "OFFERING_CREATED" as const, toEnabled: false };
      const status = await tx.providerServiceStatusHistory.create({ data: statusData });
      await rejects("status receipt uniqueness", "23505", () => tx.providerServiceStatusHistory.create({ data: { ...statusData, operationKey: randomUUID() } }));
      await rejects("status receipt fingerprint", "23514", () => tx.providerServiceStatusHistory.create({ data: { ...statusData, idempotencyKey: randomUUID(), operationKey: randomUUID(), requestFingerprint: "invalid" } }));
      await rejects("immutable status history update", "55000", () => tx.providerServiceStatusHistory.update({ where: { id: status.id }, data: { reasonCode: "CHANGED" } }));
      await rejects("immutable status history delete", "55000", () => tx.providerServiceStatusHistory.delete({ where: { id: status.id } }));
      const historyData = { ...receipt, providerServicePriceId: pending.id, event: "PRICE_APPROVED" as const, toStatus: "EFFECTIVE" as const };
      const history = await tx.providerServicePriceHistory.create({ data: historyData });
      await rejects("price receipt uniqueness", "23505", () => tx.providerServicePriceHistory.create({ data: { ...historyData, operationKey: randomUUID() } }));
      await rejects("price receipt partial shape", "23514", () => tx.providerServicePriceHistory.create({ data: { ...historyData, operationKey: randomUUID(), idempotencyKey: null } }));
      await rejects("history price scope foreign key", "23503", () => tx.providerServicePriceHistory.create({ data: { ...historyData, operationKey: randomUUID(), idempotencyKey: randomUUID(), providerServicePriceId: randomUUID() } }));
      await rejects("immutable price history update", "55000", () => tx.providerServicePriceHistory.update({ where: { id: history.id }, data: { reasonCode: "CHANGED" } }));
      await rejects("immutable price history delete", "55000", () => tx.providerServicePriceHistory.delete({ where: { id: history.id } }));
      const exact = "9".repeat(65);
      const large = await tx.providerServicePrice.create({ data: { ...priceData, status: "REJECTED", rejectedAt: new Date(), currencyDecimalPlaces: 30, providerPriceMinorUnits: exact, minimumChargeMinorUnits: exact, maximumPriceMinorUnitsAtProposal: exact } });
      if (large.providerPriceMinorUnits.toFixed(0) !== exact) throw new Error("R1-P09 exact 65-digit money roundtrip failed");
      throw rollback;
    }, { maxWait: 120_000, timeout: 120_000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(`R1-P09 live constraint probes: ${rejected} expected rejections; valid transitions and exact money verified; fixtures rolled back`);
}
