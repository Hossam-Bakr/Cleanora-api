import type { GoogleTransaction, GoogleTransactionStorePort } from '#modules/authentication';

export class MemoryGoogleTransactionStoreAdapter implements GoogleTransactionStorePort {
  private readonly values = new Map<string, GoogleTransaction>();
  save(transaction: GoogleTransaction): void { this.values.set(transaction.state, transaction); }
  consume(state: string): GoogleTransaction | undefined {
    const transaction = this.values.get(state);
    this.values.delete(state);
    if (transaction === undefined || transaction.expiresAt <= new Date()) return undefined;
    return transaction;
  }
}
