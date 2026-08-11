/**
 * Barrier/latch helpers for Provider concurrency suites.
 * Prefer these over sleeps so races stay deterministic.
 */

export class ConcurrencyBarrier {
  private readonly arrivals: Array<() => void> = [];
  private released = false;

  constructor(private readonly partySize: number) {
    if (partySize < 2) {
      throw new Error("ConcurrencyBarrier requires at least two participants");
    }
  }

  /** Wait until every participant has arrived, then release all together. */
  async arriveAndWait(): Promise<void> {
    if (this.released) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.arrivals.push(resolve);
      if (this.arrivals.length >= this.partySize) {
        this.released = true;
        for (const release of this.arrivals.splice(0)) {
          release();
        }
      }
    });
  }
}

/** Create a mutual latch that opens only after both sides signal. */
export function createMutualLatch(): {
  readonly waitForPeer: () => Promise<void>;
  readonly signal: () => void;
} {
  let peerReady = false;
  let resolveWait: (() => void) | undefined;
  return {
    waitForPeer: async () => {
      if (peerReady) {
        return;
      }
      await new Promise<void>((resolve) => {
        resolveWait = resolve;
      });
    },
    signal: () => {
      peerReady = true;
      resolveWait?.();
    },
  };
}
