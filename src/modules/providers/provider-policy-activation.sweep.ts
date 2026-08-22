/**
 * Bounded activation orchestration. Projection truth is derived on read, so a
 * sweep records resumable safe history without storing a verified flag.
 */
export class ProviderPolicyActivationSweep {
  public constructor(private readonly activateBatch: (input: { readonly cursor: string | null; readonly limit: number }) => Promise<{ readonly processed: number; readonly nextCursor: string | null }>) {}
  public runBatch(cursor: string | null, limit = 100) {
    return this.activateBatch({ cursor, limit: Math.min(100, Math.max(1, limit)) });
  }
}
