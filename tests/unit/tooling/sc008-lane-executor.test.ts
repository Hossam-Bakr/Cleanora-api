import {
  assertLaneGroups,
  groupManifestByLane,
  runConcurrentSc008Lanes,
  Sc008LaneExecutorError,
} from "../../helpers/sc008-lane-executor.js";

describe("SC-008 lane executor (T118)", () => {
  it("groups into exactly 25 lanes of 40 ordered slots", () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      lane: (index % 25) + 1,
      slot: Math.floor(index / 25) + 1,
      operation: `op-${index}`,
    }));
    const lanes = groupManifestByLane(rows);
    const laneIds = assertLaneGroups(lanes, 25, 40);
    expect(laneIds).toHaveLength(25);
    for (const laneId of laneIds) {
      const laneRows = lanes.get(laneId)!;
      expect(laneRows).toHaveLength(40);
      expect(laneRows.map((row) => row.slot)).toEqual(
        Array.from({ length: 40 }, (_, i) => i + 1),
      );
    }
  });

  it("rejects fewer or more than the expected lane count", () => {
    const rows = [
      { lane: 1, slot: 1, operation: "a" },
      { lane: 1, slot: 2, operation: "b" },
    ];
    expect(() =>
      assertLaneGroups(groupManifestByLane(rows), 25, 40),
    ).toThrow(/expected exactly 25 lanes/u);
  });

  it("runs exactly 25 concurrent workers with overlapping activity and 1000 latencies", async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      lane: (index % 25) + 1,
      slot: Math.floor(index / 25) + 1,
      operation: `op-${index}`,
    }));
    const workerLanes: number[] = [];
    let maxActive = 0;
    const activeSamples: number[] = [];
    const mutableByLane = new Map<number, { value: number }>();

    const result = await runConcurrentSc008Lanes({
      rows,
      expectedLaneCount: 25,
      expectedSlotsPerLane: 40,
      measurementWindowMs: 60_000,
      onLaneWorkerCreated: (lane) => {
        workerLanes.push(lane);
        mutableByLane.set(lane, { value: 0 });
      },
      onLaneActiveChange: (active) => {
        activeSamples.push(active);
        if (active > maxActive) maxActive = active;
      },
      executeRow: async (row) => {
        const state = mutableByLane.get(row.lane);
        if (state === undefined) {
          throw new Error(`missing lane state for ${row.lane}`);
        }
        // Prove lanes do not share mutable objects.
        state.value += 1;
        await new Promise((resolve) => setTimeout(resolve, 2));
      },
    });

    expect(workerLanes).toHaveLength(25);
    expect(new Set(workerLanes).size).toBe(25);
    expect(result.laneCount).toBe(25);
    expect(result.latencies).toHaveLength(1000);
    expect(result.maxActiveLanes).toBeGreaterThan(1);
    expect(result.maxActiveLanes).toBeLessThanOrEqual(25);
    expect(maxActive).toBe(result.maxActiveLanes);
    expect(Math.max(...activeSamples)).toBeGreaterThan(1);
    expect(result.elapsedMs).toBeLessThanOrEqual(60_000);
    for (const lane of workerLanes) {
      expect(mutableByLane.get(lane)?.value).toBe(40);
    }
  }, 30_000);

  it("reports lane failures with lane/slot/operation diagnostics", async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      lane: (index % 25) + 1,
      slot: Math.floor(index / 25) + 1,
      operation: `op-${index}`,
    }));
    await expect(
      runConcurrentSc008Lanes({
        rows,
        expectedLaneCount: 25,
        expectedSlotsPerLane: 40,
        measurementWindowMs: 60_000,
        executeRow: async (row) => {
          if (row.lane === 7 && row.slot === 3) {
            throw new Error("forced_lane_failure");
          }
        },
      }),
    ).rejects.toSatisfy((error: unknown) => {
      expect(error).toBeInstanceOf(Sc008LaneExecutorError);
      const typed = error as Sc008LaneExecutorError;
      expect(typed.diagnostics.some((line) => /lane=7 slot=3 operation=op-/u.test(line))).toBe(
        true,
      );
      return true;
    });
  }, 30_000);

  it("fails when total elapsed exceeds the measurement window", async () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({
      lane: (index % 25) + 1,
      slot: Math.floor(index / 25) + 1,
      operation: `op-${index}`,
    }));
    await expect(
      runConcurrentSc008Lanes({
        rows,
        expectedLaneCount: 25,
        expectedSlotsPerLane: 40,
        measurementWindowMs: 5,
        executeRow: async () => {
          await new Promise((resolve) => setTimeout(resolve, 20));
        },
      }),
    ).rejects.toThrow(/exceeded the 5-ms steady-state measurement window/u);
  }, 30_000);
});
