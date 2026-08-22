import { PrismaPayoutRevealAuditGate } from "../../../src/modules/admin/infrastructure/prisma-payout-reveal-audit.gate.js";

describe("R1-P06 accepted reveal rolling-window serialization", () => {
  it("allows exactly five of six concurrent attempts for one Staff actor", async () => {
    const acceptedRows: Array<{
      action: string;
      id: string;
      data?: { readonly context?: unknown; readonly requestId?: string };
    }> = [];
    const advisoryLockQueries: string[] = [];
    let sequence = Promise.resolve();
    const transaction = {
      async $queryRaw(strings: TemplateStringsArray) {
        advisoryLockQueries.push(strings.join("?"));
        return [{ locked: 1 }];
      },
      auditLog: {
        async count() { return acceptedRows.filter((row) => row.action === "PROVIDER_PAYOUT_REVEAL_ACCEPTED").length; },
        async create(input: { readonly data: { readonly action: string; readonly context?: unknown; readonly requestId?: string } }) {
          const row = { action: input.data.action, id: `audit-${acceptedRows.length + 1}`, createdAt: new Date("2026-08-13T09:00:00.000Z"), data: input.data };
          acceptedRows.push(row);
          return row;
        },
      },
    };
    const database = {
      async $transaction<T>(work: (tx: typeof transaction) => Promise<T>) {
        let release: () => void = () => undefined;
        const turn = new Promise<void>((resolve) => { release = resolve; });
        const previous = sequence;
        sequence = sequence.then(() => turn);
        await previous;
        try { return await work(transaction); } finally { release(); }
      },
    };
    const gate = new PrismaPayoutRevealAuditGate(database as never);
    const results = await Promise.all(Array.from({ length: 6 }, (_, index) => gate.commitAcceptedReveal({
      actorUserId: "staff-1",
      providerId: "provider-1",
      destinationVersionId: `destination-${index}`,
      expectedVersion: 1,
      purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION",
      reasonCode: "MANUAL_VERIFICATION_PREPARATION",
      requestId: `request-${index}`,
      encryptionKeyIds: ["enc-v1"],
      lookupKeyIds: ["lookup-v1"],
      now: new Date("2026-08-13T09:00:00.000Z"),
    })));
    expect(results.filter((result) => result.accepted)).toHaveLength(5);
    expect(advisoryLockQueries).toHaveLength(6);
    expect(advisoryLockQueries.every((query) => query.includes("SELECT 1 AS locked"))).toBe(true);
    expect(advisoryLockQueries.every((query) => query.includes("pg_advisory_xact_lock"))).toBe(true);
    expect(results.filter((result) => !result.accepted)).toEqual([{ accepted: false, safeCode: "PAYOUT_REVEAL_RATE_LIMITED" }]);
    expect(acceptedRows.find((row) => row.action === "PROVIDER_PAYOUT_REVEAL_DENIED")?.data).toMatchObject({
      requestId: "request-5",
      context: {
        providerId: "provider-1",
        expectedVersion: 1,
        purpose: "MANUAL_PAYOUT_DESTINATION_VERIFICATION",
        revealReason: "MANUAL_VERIFICATION_PREPARATION",
        encryptionKeyIds: ["enc-v1"],
        lookupKeyIds: ["lookup-v1"],
        outcome: "DENIED",
      },
    });
  });
});
