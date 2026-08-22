import { getPrismaClient } from "#database/prisma";

export class PrismaPayoutRegistryRepository {
  public constructor(private readonly db = getPrismaClient()) {}
  public async readOptions(countryCode: string) {
    const country = await this.db.country.findFirst({ where: { code: countryCode, isActive: true }, include: { defaultCurrency: true } });
    if (country === null) throw new Error("PAYOUT_REGISTRY_INACTIVE");
    const [policy, types, operators, banks] = await Promise.all([
      this.db.payoutCountryPolicy.findFirst({ where: { countryId: country.id, isActive: true } }),
      this.db.payoutDestinationType.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      this.db.payoutOperator.findMany({ where: { countryId: country.id, isActive: true }, orderBy: { code: "asc" } }),
      this.db.payoutBank.findMany({ where: { countryId: country.id, isActive: true }, orderBy: { code: "asc" } }),
    ]);
    if (policy === null) throw new Error("PAYOUT_REGISTRY_INACTIVE");
    return { country, policy, types, operators, banks };
  }
  public async resolveWallet(input: { readonly countryCode: string; readonly operatorCode: string }) {
    const options = await this.readOptions(input.countryCode);
    const type = options.types.find((item) => item.code === "MOBILE_WALLET");
    const operator = options.operators.find((item) => item.code === input.operatorCode);
    if (type === undefined || operator === undefined || !options.policy.allowedDestinationTypes.includes("MOBILE_WALLET")) throw new Error("PAYOUT_REGISTRY_INACTIVE");
    return { ...options, type, operator };
  }
  public async resolveBank(input: { readonly countryCode: string; readonly currencyCode: string; readonly bankCode: string }) {
    const options = await this.readOptions(input.countryCode);
    const currency = await this.db.currency.findFirst({ where: { code: input.currencyCode, isActive: true } });
    const type = options.types.find((item) => item.code === "BANK_ACCOUNT");
    const bank = options.banks.find((item) => item.code === input.bankCode);
    if (currency === null || type === undefined || bank === undefined || !options.policy.allowedDestinationTypes.includes("BANK_ACCOUNT") || !options.policy.allowedCurrencyCodes.includes(input.currencyCode)) throw new Error("PAYOUT_REGISTRY_INACTIVE");
    return { ...options, type, bank, currency };
  }
}
