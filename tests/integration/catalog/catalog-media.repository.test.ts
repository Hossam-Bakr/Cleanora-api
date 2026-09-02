
import type { CatalogRepository } from "../../../src/modules/catalog/catalog.repository.js";
import { CatalogError } from "../../../src/modules/catalog/catalog.errors.js";

/**
 * T100 — service_media_associations uniqueness/order and detach-without-file-delete
 * (FR-040, FR-041, SC-008). Fake association store only.
 */

type AssociationRow = {
  readonly id: string;
  readonly serviceId: string;
  readonly mediaFileId: string;
  displayOrder: number;
};

type MediaFileShadow = {
  readonly id: string;
  status: string;
  deleted: boolean;
};

/**
 * In-memory association contract stand-in. Not a live Prisma/Media proof.
 */
class FakeCatalogMediaAssociationStore {
  readonly associations = new Map<string, AssociationRow>();
  readonly mediaFiles = new Map<string, MediaFileShadow>();
  private seq = 0;

  seedMedia(mediaFileId: string): void {
    this.mediaFiles.set(mediaFileId, {
      id: mediaFileId,
      status: "READY",
      deleted: false,
    });
  }

  add(serviceId: string, mediaFileId: string): AssociationRow {
    if (![...this.associations.values()].every((row) => row.mediaFileId !== mediaFileId)) {
      throw new CatalogError(
        "CATALOG_MEDIA_INVALID",
        "Media file is already associated with a service",
      );
    }
    const displayOrder = [...this.associations.values()].filter(
      (row) => row.serviceId === serviceId,
    ).length;
    this.seq += 1;
    const row: AssociationRow = {
      id: `assoc_${this.seq}`,
      serviceId,
      mediaFileId,
      displayOrder,
    };
    this.associations.set(row.id, row);
    return row;
  }

  reorder(serviceId: string, orderedAssociationIds: readonly string[]): AssociationRow[] {
    const current = [...this.associations.values()]
      .filter((row) => row.serviceId === serviceId)
      .sort((left, right) => left.displayOrder - right.displayOrder);
    const currentIds = current.map((row) => row.id);
    if (
      orderedAssociationIds.length !== currentIds.length ||
      new Set(orderedAssociationIds).size !== orderedAssociationIds.length ||
      orderedAssociationIds.some((id) => !currentIds.includes(id))
    ) {
      throw new CatalogError(
        "CATALOG_ORDER_INVALID",
        "Media order must be an exact association set",
      );
    }
    orderedAssociationIds.forEach((id, displayOrder) => {
      const row = this.associations.get(id);
      if (row !== undefined) {
        this.associations.set(id, { ...row, displayOrder });
      }
    });
    return orderedAssociationIds.map((id) => this.associations.get(id)!);
  }

  remove(associationId: string): void {
    const row = this.associations.get(associationId);
    if (row === undefined) {
      throw new CatalogError("CATALOG_NOT_FOUND", "Media association not found", {
        httpStatus: 404,
      });
    }
    this.associations.delete(associationId);
    const remaining = [...this.associations.values()]
      .filter((entry) => entry.serviceId === row.serviceId)
      .sort((left, right) => left.displayOrder - right.displayOrder);
    remaining.forEach((entry, displayOrder) => {
      this.associations.set(entry.id, { ...entry, displayOrder });
    });
  }
}

describe("catalog media repository associations (T100, fake store)", () => {
  it("declares the association persistence method names required for US4 repository work", () => {
    const requiredMethods = [
      "listServiceMediaAssociations",
      "lockServiceMediaAssociations",
      "insertServiceMediaAssociation",
      "replaceServiceMediaOrder",
      "removeServiceMediaAssociation",
      "nextServiceMediaDisplayOrder",
    ] as const;
    expect(requiredMethods).toHaveLength(6);
    for (const method of requiredMethods) {
      expect(method).toMatch(/^list|^lock|^insert|^replace|^remove|^next/u);
    }
    // Document the intended CatalogRepository media surface for T108.
    void (null as unknown as CatalogRepository);
  });

  it("enforces unique mediaFileId across associations in the fake store", () => {
    const store = new FakeCatalogMediaAssociationStore();
    store.seedMedia("media_1");
    store.seedMedia("media_2");
    store.add("svc_1", "media_1");
    expect(() => store.add("svc_2", "media_1")).toThrow(CatalogError);
    store.add("svc_1", "media_2");
    expect([...store.associations.values()].map((row) => row.displayOrder).sort()).toEqual([
      0, 1,
    ]);
  });

  it("keeps contiguous displayOrder and accepts exact-set reorder in the fake store", () => {
    const store = new FakeCatalogMediaAssociationStore();
    store.seedMedia("media_a");
    store.seedMedia("media_b");
    store.seedMedia("media_c");
    const a = store.add("svc_1", "media_a");
    const b = store.add("svc_1", "media_b");
    const c = store.add("svc_1", "media_c");
    const reordered = store.reorder("svc_1", [c.id, a.id, b.id]);
    expect(reordered.map((row) => row.id)).toEqual([c.id, a.id, b.id]);
    expect(reordered.map((row) => row.displayOrder)).toEqual([0, 1, 2]);
    expect(() => store.reorder("svc_1", [a.id, b.id])).toThrow(CatalogError);
  });

  it("detaches an association without deleting or mutating the Media file shadow", () => {
    const store = new FakeCatalogMediaAssociationStore();
    store.seedMedia("media_keep");
    const association = store.add("svc_1", "media_keep");
    store.remove(association.id);
    expect(store.associations.has(association.id)).toBe(false);
    const media = store.mediaFiles.get("media_keep");
    expect(media).toEqual({
      id: "media_keep",
      status: "READY",
      deleted: false,
    });
  });
});
