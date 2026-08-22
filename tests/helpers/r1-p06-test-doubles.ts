import { createHash } from "node:crypto";

export class R1P06TestClock {
  public constructor(private current = new Date("2026-08-13T09:00:00.000Z")) {}
  public now(): Date {
    return new Date(this.current);
  }
  public advance(milliseconds: number): void {
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

export class R1P06NonceSource {
  private counter = 0;
  public next(): Buffer {
    this.counter += 1;
    const nonce = Buffer.alloc(12);
    nonce.writeUInt32BE(this.counter, 8);
    return nonce;
  }
}

export function r1P06TestKeyRing() {
  return {
    encryption: {
      activeKeyId: "enc-test-v1",
      keys: new Map([["enc-test-v1", Buffer.alloc(32, 0x11)]]),
    },
    lookup: {
      activeKeyId: "lookup-test-v1",
      keys: new Map([["lookup-test-v1", Buffer.alloc(32, 0x22)]]),
    },
  } as const;
}

export class R1P06AuthenticationDouble {
  public active = true;
  public authenticatedAt = new Date("2026-08-13T08:55:00.000Z");
  public async verify(input: { readonly principalUserId: string; readonly sessionId: string }) {
    if (!this.active) throw new Error("AUTHENTICATION_INACTIVE");
    return {
      actorUserId: input.principalUserId,
      sessionId: input.sessionId,
      authenticatedAt: this.authenticatedAt,
      expiresAt: new Date(this.authenticatedAt.getTime() + 600_000),
      proofId: "synthetic-proof-id",
    };
  }
}

export class R1P06CustomersDouble {
  public legalEntityName: string | null = "R1P06 Synthetic Company";
  public ownerLegalName: string | null = "R1P06 Synthetic Owner";
  public async readLegalNameFacts() {
    return { legalEntityName: this.legalEntityName, ownerLegalName: this.ownerLegalName };
  }
}

export class R1P06ConfigurationDouble {
  public async readCountry(input: { readonly countryCode: string }) {
    return input.countryCode === "EG"
      ? { countryId: "country-eg", countryCode: "EG", active: true, callingCodes: ["20"] }
      : null;
  }
  public async readCurrency(input: { readonly currencyCode: string }) {
    return input.currencyCode === "EGP"
      ? { currencyId: "currency-egp", currencyCode: "EGP", active: true }
      : null;
  }
}

export class R1P06MediaDouble {
  public state: "PROCESSING" | "READY" | "FAILED" = "READY";
  public async readValidationReceipt() {
    return {
      state: this.state,
      canonicalContentType: "image/jpeg" as const,
      byteSize: 256,
      pageCount: null,
      safeReceiptId: "media-receipt-synthetic",
    };
  }
}

export class R1P06ScannerDouble {
  public clean = true;
  public async scan(): Promise<{ readonly clean: boolean; readonly safeCode: string }> {
    return { clean: this.clean, safeCode: this.clean ? "CLEAN" : "MALWARE_DETECTED" };
  }
}

export class R1P06AuditDouble {
  public readonly entries: Array<Readonly<Record<string, unknown>>> = [];
  public async append(input: Readonly<Record<string, unknown>>) {
    this.entries.push(input);
    return { id: `audit-${this.entries.length}`, createdAt: "2026-08-13T09:00:00.000Z" };
  }
}

export class R1P06EmailDouble {
  public readonly intents: Array<Readonly<Record<string, string>>> = [];
  public async sendTemplate(input: Readonly<Record<string, string>>): Promise<void> {
    this.intents.push(input);
  }
}

export function stableSyntheticId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}
