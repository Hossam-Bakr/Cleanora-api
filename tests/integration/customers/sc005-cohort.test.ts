import { randomUUID } from "node:crypto";

import { getPrismaClient } from "../../../src/database/prisma.js";
import type { PrismaLifecycle } from "../../../src/database/prisma-lifecycle.js";
import { createPrismaDenialAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-denial-audit.writer.js";
import { createPrismaGeneralTransactionalAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-general-transactional-audit.writer.js";
import { createPrismaPrivilegedAuditWriter } from "../../../src/modules/admin/infrastructure/prisma-privileged-audit.writer.js";
import { AddressService } from "../../../src/modules/customers/address.service.js";
import type { AuthenticationPrincipal } from "../../../src/modules/authentication/authentication.public.js";
import { PrismaAddressRepository } from "../../../src/modules/customers/infrastructure/prisma-address.repository.js";
import { PrismaCustomersUnitOfWork } from "../../../src/modules/customers/infrastructure/prisma-customers.unit-of-work.js";
import { PrismaPreferencesRepository } from "../../../src/modules/customers/infrastructure/prisma-preferences.repository.js";
import { PrismaProfileRepository } from "../../../src/modules/customers/infrastructure/prisma-profile.repository.js";
import { IdentityContactRead } from "../../../src/modules/customers/infrastructure/identity-contact.read.js";
import { PreferencesService } from "../../../src/modules/customers/preferences.service.js";
import { ProfileService } from "../../../src/modules/customers/profile.service.js";
import { assertR1P04CustomerSchemaReady } from "../../helpers/assert-r1-p04-schema.js";
import { requireR1P04TestDatabase } from "../../helpers/r1-p04-test-database.js";
import {
  startTestDatabaseLifecycle,
  stopTestDatabaseLifecycle,
} from "../../helpers/test-database-lifecycle.js";

/**
 * SC-005 fixed P01–P20 cohort (T069).
 * Exact category holdings and single applicable-profile assignments from spec.md.
 */
export const SC005_COHORT = [
  { id: "P01", categories: ["INDIVIDUAL"], profile: "INDIVIDUAL" },
  { id: "P02", categories: ["INDIVIDUAL"], profile: "INDIVIDUAL" },
  { id: "P03", categories: ["INDIVIDUAL"], profile: "INDIVIDUAL" },
  { id: "P04", categories: ["INDIVIDUAL"], profile: "INDIVIDUAL" },
  { id: "P05", categories: ["INDIVIDUAL"], profile: "INDIVIDUAL" },
  { id: "P06", categories: ["COMPANY"], profile: "COMPANY" },
  { id: "P07", categories: ["COMPANY"], profile: "COMPANY" },
  { id: "P08", categories: ["COMPANY"], profile: "COMPANY" },
  { id: "P09", categories: ["COMPANY"], profile: "COMPANY" },
  { id: "P10", categories: ["COMPANY"], profile: "COMPANY" },
  { id: "P11", categories: ["ENGINEER"], profile: "ENGINEER" },
  { id: "P12", categories: ["ENGINEER"], profile: "ENGINEER" },
  { id: "P13", categories: ["ENGINEER"], profile: "ENGINEER" },
  { id: "P14", categories: ["ENGINEER"], profile: "ENGINEER" },
  { id: "P15", categories: ["ENGINEER"], profile: "ENGINEER" },
  { id: "P16", categories: ["INDIVIDUAL", "COMPANY"], profile: "INDIVIDUAL" },
  { id: "P17", categories: ["INDIVIDUAL", "COMPANY"], profile: "COMPANY" },
  { id: "P18", categories: ["INDIVIDUAL", "ENGINEER"], profile: "ENGINEER" },
  { id: "P19", categories: ["COMPANY", "ENGINEER"], profile: "COMPANY" },
  { id: "P20", categories: ["INDIVIDUAL", "COMPANY", "ENGINEER"], profile: "ENGINEER" },
] as const;

describe("SC-005 cohort assignment lock (T069)", () => {
  it("locks exactly 20 participants with 6 Individual + 7 Company + 7 Engineer journeys", () => {
    expect(SC005_COHORT).toHaveLength(20);
    const journeys = SC005_COHORT.map((row) => row.profile);
    expect(journeys.filter((value) => value === "INDIVIDUAL")).toHaveLength(6);
    expect(journeys.filter((value) => value === "COMPANY")).toHaveLength(7);
    expect(journeys.filter((value) => value === "ENGINEER")).toHaveLength(7);
  });
});

function principalFor(
  userId: string,
  categories: readonly string[],
): AuthenticationPrincipal {
  return {
    userId,
    sessionId: `session-${userId}`,
    accountCategories: [...categories] as AuthenticationPrincipal["accountCategories"],
    verifiedCategories: [...categories] as AuthenticationPrincipal["verifiedCategories"],
    pendingCategories: [],
    status: "ACTIVE",
    verificationOnly: false,
  };
}

async function createParticipantUser(
  categories: readonly AuthenticationPrincipal["accountCategories"][number][],
): Promise<string> {
  const phoneDigits = randomUUID().replace(/\D/gu, "").slice(0, 10).padEnd(10, "0");
  return getPrismaClient()
    .user.create({
      data: {
        phoneE164: `+201${phoneDigits}`,
        emailNormalized: `sc005-${randomUUID()}@example.test`,
        emailVerifiedAt: new Date(),
        accountCategories: [...categories],
        verifiedCategories: [...categories],
      },
    })
    .then((user) => user.id);
}

describe("SC-005 cohort acceptance journey", () => {
  let database: PrismaLifecycle;
  const createdUserIds: string[] = [];

  beforeAll(() => {
    requireR1P04TestDatabase();
  });

  beforeAll(async () => {
    database = await startTestDatabaseLifecycle();
    await assertR1P04CustomerSchemaReady();
  });

  afterAll(async () => {
    const prisma = getPrismaClient();
    for (const userId of createdUserIds) {
      await prisma.userAddress.deleteMany({ where: { userId } });
      await prisma.userPreferences.deleteMany({ where: { userId } });
      await prisma.individualProfile.deleteMany({ where: { userId } });
      await prisma.companyProfile.deleteMany({ where: { userId } });
      await prisma.engineerProfile.deleteMany({ where: { userId } });
      await prisma.customerProfile.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await stopTestDatabaseLifecycle(database);
  }, 120_000);

  it("finishes at least 19 of 20 participants correctly within five minutes", { timeout: 360000 }, async () => {
    const deadline = Date.now() + 5 * 60 * 1000;
    const unitOfWork = new PrismaCustomersUnitOfWork(
      createPrismaGeneralTransactionalAuditWriter,
      createPrismaPrivilegedAuditWriter,
    );
    const denialAudit = createPrismaDenialAuditWriter();
    const profiles = new ProfileService(
      unitOfWork,
      new PrismaProfileRepository(),
      denialAudit,
    );
    const preferences = new PreferencesService(
      unitOfWork,
      new PrismaPreferencesRepository(),
      new IdentityContactRead({
        readContactFacts: async (userId) => {
          const user = await getPrismaClient().user.findUniqueOrThrow({
            where: { id: userId },
            select: {
              phoneE164: true,
              emailNormalized: true,
              phoneVerifiedAt: true,
              emailVerifiedAt: true,
            },
          });
          return user;
        },
      }),
      denialAudit,
    );
    const country = await getPrismaClient().country.findFirstOrThrow({
      where: { isActive: true },
      select: { id: true, code: true },
    });
    const addresses = new AddressService(
      unitOfWork,
      new PrismaAddressRepository(),
      {
        resolveActiveCountry: async (countryCode) => {
          if (countryCode !== country.code) {
            throw new Error(`Unexpected country ${countryCode}`);
          }
          return { id: country.id };
        },
      },
      denialAudit,
    );

    let successCount = 0;

    for (const participant of SC005_COHORT) {
      if (Date.now() > deadline) {
        break;
      }
      const userId = await createParticipantUser(participant.categories);
      createdUserIds.push(userId);
      const principal = principalFor(userId, participant.categories);

      const profileInput =
        participant.profile === "INDIVIDUAL"
          ? { category: "INDIVIDUAL" as const, fullName: `${participant.id} Person` }
          : participant.profile === "COMPANY"
            ? {
                category: "COMPANY" as const,
                companyName: `${participant.id} Co`,
                representativeFullName: `${participant.id} Rep`,
                commercialRegistrationNumber: null,
                taxRegistrationNumber: null,
              }
            : {
                category: "ENGINEER" as const,
                fullName: `${participant.id} Engineer`,
                professionalTitle: "Lead",
              };

      const saved = await profiles.upsert({ principal, input: profileInput });
      expect(saved.created).toBe(true);

      const prefs = await preferences.replace(principal, {
        version: 1,
        language: "EN",
        reminders: { sms: false, push: false },
        promotional: { sms: false, push: false },
        mandatory: {
          security: { sms: true, push: true },
          activeService: { sms: true, push: true },
        },
      });
      expect(prefs.language).toBe("EN");

      const address = await addresses.create({
        principal,
        input: {
          countryCode: country.code,
          city: "Cairo",
          district: "Maadi",
          addressText: `${participant.id} Street 1`,
          building: null,
          floor: null,
          notes: null,
        },
      });
      expect(address.version).toBe(1);
      successCount += 1;
    }

    expect(successCount).toBeGreaterThanOrEqual(19);
    expect(Date.now()).toBeLessThanOrEqual(deadline);
  });
});
