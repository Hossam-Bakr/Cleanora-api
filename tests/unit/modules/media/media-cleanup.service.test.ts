import {
  MediaCleanupService,
  startMediaCleanupSweep,
} from "../../../../src/modules/media/infrastructure/media-cleanup.service.js";
import type { MediaStoragePort } from "../../../../src/modules/media/domain/media.ports.js";

describe("MediaCleanupService", () => {
  it("removes PENDING_DELETE and stale PENDING_UPLOAD rows outside READY", async () => {
    const removed: string[] = [];
    const markedDeleted: string[] = [];
    const repository = {
      listCleanupCandidates: async () => [
        {
          id: "ready",
          status: "READY",
          storageProvider: "CLOUDINARY",
          storageKey: "ready-key",
        },
        {
          id: "pending-delete",
          status: "PENDING_DELETE",
          storageProvider: "CLOUDINARY",
          storageKey: "old-key",
        },
        {
          id: "stale-upload",
          status: "PENDING_UPLOAD",
          storageProvider: "CLOUDINARY",
          storageKey: "stale-key",
        },
      ],
      markDeleted: async (id: string) => {
        markedDeleted.push(id);
      },
    };
    const storage: MediaStoragePort = {
      storeProfileImage: async () => {
        throw new Error("unused");
      },
      createAuthorizedDeliveryUrl: async () => {
        throw new Error("unused");
      },
      remove: async (reference) => {
        removed.push(reference.storageKey);
        return { destroyResult: "ok" as const };
      },
    };

    const cleanup = new MediaCleanupService(repository as never, storage);
    const result = await cleanup.sweepOnce();
    expect(result.processed).toBe(2);
    expect(removed).toEqual(["old-key", "stale-key"]);
    expect(markedDeleted).toEqual(["pending-delete", "stale-upload"]);
  });

  it("leaves rows retryable when provider remove fails", async () => {
    const repository = {
      listCleanupCandidates: async () => [
        {
          id: "pending-delete",
          status: "PENDING_DELETE",
          storageProvider: "CLOUDINARY",
          storageKey: "old-key",
        },
      ],
      markDeleted: async () => {
        throw new Error("should not mark deleted");
      },
    };
    const storage: MediaStoragePort = {
      storeProfileImage: async () => {
        throw new Error("unused");
      },
      createAuthorizedDeliveryUrl: async () => {
        throw new Error("unused");
      },
      remove: async () => {
        throw new Error("provider down");
      },
    };

    const cleanup = new MediaCleanupService(repository as never, storage);
    await expect(cleanup.sweepOnce()).resolves.toEqual({ processed: 0 });
  });

  it("logs only an error classification when a sweep failure contains protected storage material", async () => {
    const warn = vi.fn();
    const stop = startMediaCleanupSweep({
      sweepOnce: vi.fn(async () => {
        throw new Error("cloudinary/private-worker-storage-key");
      }),
    } as never, { warn } as never);
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    stop();
    expect(warn).toHaveBeenCalledWith("media cleanup sweep failed", {
      errorName: "Error",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("private-worker-storage-key");
  });
});
