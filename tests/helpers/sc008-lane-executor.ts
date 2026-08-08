/**
 * SC-008 concurrent-lane executor (test harness only).
 * Exactly 25 lane workers; 40 ordered slots per lane; shared start barrier.
 */

export interface Sc008LaneRowLike {
  readonly lane: number;
  readonly slot: number;
  readonly operation: string;
}

export interface Sc008LaneLatency {
  readonly lane: number;
  readonly slot: number;
  readonly operation: string;
  readonly latencyMs: number;
}

export interface Sc008LaneExecutorOptions<TRow extends Sc008LaneRowLike> {
  readonly rows: readonly TRow[];
  readonly expectedLaneCount: number;
  readonly expectedSlotsPerLane: number;
  readonly measurementWindowMs: number;
  readonly executeRow: (row: TRow) => Promise<void>;
  /** Invoked once per lane before the start barrier (setup must already be done). */
  readonly onLaneWorkerCreated?: (lane: number, rowCount: number) => void;
  /** Optional overlap probe for unit tests. */
  readonly onLaneActiveChange?: (activeCount: number) => void;
}

export interface Sc008LaneExecutorResult {
  readonly latencies: readonly Sc008LaneLatency[];
  readonly elapsedMs: number;
  readonly laneCount: number;
  readonly maxActiveLanes: number;
  readonly perLaneElapsedMs: Readonly<Record<number, number>>;
}

export class Sc008LaneExecutorError extends Error {
  public constructor(
    message: string,
    readonly diagnostics: readonly string[],
  ) {
    super(message);
    this.name = "Sc008LaneExecutorError";
  }
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof AggregateError) {
    const parts = error.errors.map((inner) => safeErrorMessage(inner));
    return `AggregateError(${parts.join("; ")})`;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String((error as { code: unknown }).code);
    const message =
      error instanceof Error
        ? (error.message.split("\n")[0] ?? error.message)
        : "error";
    return `${code}:${message}`;
  }
  if (error instanceof Error) {
    return error.message.split("\n")[0] ?? error.message;
  }
  return "unknown_error";
}

/** Group manifest rows by lane and preserve ascending slot order within each lane. */
export function groupManifestByLane<TRow extends Sc008LaneRowLike>(
  rows: readonly TRow[],
): ReadonlyMap<number, readonly TRow[]> {
  const buckets = new Map<number, TRow[]>();
  for (const row of rows) {
    const existing = buckets.get(row.lane);
    if (existing === undefined) {
      buckets.set(row.lane, [row]);
    } else {
      existing.push(row);
    }
  }
  for (const [lane, laneRows] of buckets) {
    laneRows.sort((a, b) => a.slot - b.slot);
    buckets.set(lane, laneRows);
  }
  return buckets;
}

/** Assert exactly N lanes with exactly M ordered slots each. */
export function assertLaneGroups<TRow extends Sc008LaneRowLike>(
  lanes: ReadonlyMap<number, readonly TRow[]>,
  expectedLaneCount: number,
  expectedSlotsPerLane: number,
): readonly number[] {
  if (lanes.size !== expectedLaneCount) {
    throw new Error(
      `SC-008 expected exactly ${expectedLaneCount} lanes, got ${lanes.size}`,
    );
  }
  const laneIds = [...lanes.keys()].sort((a, b) => a - b);
  if (laneIds.length !== expectedLaneCount) {
    throw new Error(
      `SC-008 expected exactly ${expectedLaneCount} lanes, got ${laneIds.length}`,
    );
  }
  for (let expected = 1; expected <= expectedLaneCount; expected += 1) {
    if (!lanes.has(expected)) {
      throw new Error(`SC-008 missing lane ${expected}`);
    }
  }
  for (const laneId of laneIds) {
    const laneRows = lanes.get(laneId)!;
    if (laneRows.length !== expectedSlotsPerLane) {
      throw new Error(
        `SC-008 lane ${laneId} expected ${expectedSlotsPerLane} rows, got ${laneRows.length}`,
      );
    }
    for (let index = 0; index < laneRows.length; index += 1) {
      const row = laneRows[index]!;
      if (row.slot !== index + 1) {
        throw new Error(
          `SC-008 lane ${laneId} slot order broken at index ${index}: expected slot ${index + 1}, got ${row.slot}`,
        );
      }
    }
  }
  return laneIds;
}

function createStartBarrier(partyCount: number): {
  arrive: () => Promise<void>;
} {
  let arrived = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    async arrive(): Promise<void> {
      arrived += 1;
      if (arrived >= partyCount) {
        release();
      }
      await gate;
    },
  };
}

/**
 * Run exactly `expectedLaneCount` concurrent lane workers.
 * Each worker executes its slots sequentially after a shared start barrier.
 */
export async function runConcurrentSc008Lanes<TRow extends Sc008LaneRowLike>(
  options: Sc008LaneExecutorOptions<TRow>,
): Promise<Sc008LaneExecutorResult> {
  const lanes = groupManifestByLane(options.rows);
  const laneIds = assertLaneGroups(
    lanes,
    options.expectedLaneCount,
    options.expectedSlotsPerLane,
  );

  for (const laneId of laneIds) {
    options.onLaneWorkerCreated?.(laneId, lanes.get(laneId)!.length);
  }

  const barrier = createStartBarrier(laneIds.length);
  let activeLanes = 0;
  let maxActiveLanes = 0;
  const perLaneElapsedMs: Record<number, number> = {};
  const failureDiagnostics: string[] = [];

  const startedAt = Date.now();

  const settled = await Promise.allSettled(
    laneIds.map(async (laneId) => {
      const laneRows = lanes.get(laneId)!;
      await barrier.arrive();

      activeLanes += 1;
      if (activeLanes > maxActiveLanes) {
        maxActiveLanes = activeLanes;
      }
      options.onLaneActiveChange?.(activeLanes);

      const laneStartedAt = Date.now();
      const laneLatencies: Sc008LaneLatency[] = [];
      try {
        for (const row of laneRows) {
          const t0 = Date.now();
          try {
            await options.executeRow(row);
          } catch (error) {
            const diagnostic = `lane=${row.lane} slot=${row.slot} operation=${row.operation} error=${safeErrorMessage(error)}`;
            failureDiagnostics.push(diagnostic);
            throw new Error(diagnostic);
          }
          laneLatencies.push({
            lane: row.lane,
            slot: row.slot,
            operation: row.operation,
            latencyMs: Date.now() - t0,
          });
        }
        return laneLatencies;
      } finally {
        perLaneElapsedMs[laneId] = Date.now() - laneStartedAt;
        activeLanes -= 1;
        options.onLaneActiveChange?.(activeLanes);
      }
    }),
  );

  const elapsedMs = Date.now() - startedAt;
  const latencies: Sc008LaneLatency[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      latencies.push(...result.value);
    } else {
      const reason =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      if (!failureDiagnostics.includes(reason)) {
        failureDiagnostics.push(reason);
      }
    }
  }

  if (failureDiagnostics.length > 0) {
    throw new Sc008LaneExecutorError(
      `SC-008 lane execution failed (${failureDiagnostics.length} failure(s)): ${failureDiagnostics.slice(0, 8).join(" | ")}`,
      failureDiagnostics,
    );
  }

  if (elapsedMs > options.measurementWindowMs) {
    throw new Error(
      `SC-008 exceeded the ${options.measurementWindowMs}-ms steady-state measurement window (elapsedMs=${elapsedMs})`,
    );
  }

  if (maxActiveLanes < 2 || maxActiveLanes > options.expectedLaneCount) {
    throw new Error(
      `SC-008 concurrency probe failed: maxActiveLanes=${maxActiveLanes} (expected 2..${options.expectedLaneCount})`,
    );
  }

  const expectedTotal =
    options.expectedLaneCount * options.expectedSlotsPerLane;
  if (latencies.length !== expectedTotal) {
    throw new Error(
      `SC-008 expected ${expectedTotal} latencies, got ${latencies.length}`,
    );
  }

  return {
    latencies,
    elapsedMs,
    laneCount: laneIds.length,
    maxActiveLanes,
    perLaneElapsedMs,
  };
}
