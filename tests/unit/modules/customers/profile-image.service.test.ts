
import type { AuthenticationPrincipal } from "../../../../src/modules/authentication/authentication.public.js";
import { ProfileImageService } from "../../../../src/modules/customers/profile-image.service.js";
import {
  MediaError,
  type MediaPendingUploadPort,
  type MediaStoragePort,
  type ProfileImageProcessor,
} from "../../../../src/modules/media/media.public.js";

const owner: AuthenticationPrincipal = {
  userId: "owner",
  sessionId: "session",
  accountCategories: ["INDIVIDUAL"],
  verifiedCategories: ["INDIVIDUAL"],
  pendingCategories: [],
  status: "ACTIVE",
  verificationOnly: false,
};

function pendingOnly(): AuthenticationPrincipal {
  return {
    ...owner,
    verifiedCategories: [],
    pendingCategories: ["INDIVIDUAL"],
  };
}

function pendingUploadPort(
  overrides: Partial<MediaPendingUploadPort> = {},
): MediaPendingUploadPort {
  return {
    createOpaqueStorageKey: (folder) => `${folder}/opaque-key`,
    reservePendingUpload: vi.fn(async () => undefined),
    markPendingDelete: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("ProfileImageService (unit)", () => {
  it("rejects pending-only callers before media write or association mutation", async () => {
    const denialAppend = vi.fn(async () => ({
      id: "denial",
      createdAt: new Date().toISOString(),
    }));
    const storeProfileImage = vi.fn();
    const normalize = vi.fn();
    const reservePendingUpload = vi.fn(async () => undefined);
    const unitOfWorkRun = vi.fn();

    const service = new ProfileImageService(
      { run: unitOfWorkRun } as never,
      { storeProfileImage } as unknown as MediaStoragePort,
      { normalize } as unknown as ProfileImageProcessor,
      pendingUploadPort({ reservePendingUpload }),
      { get: vi.fn() } as never,
      { append: denialAppend },
      "cleanora/customer-profile-images",
      900,
    );

    await expect(
      service.put({
        principal: pendingOnly(),
        bytes: Buffer.from("image"),
        expectedAssociationVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_FORBIDDEN" });

    expect(denialAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customers.profile_image.put",
        outcome: "CATEGORY_NOT_VERIFIED",
        targetId: "owner",
      }),
    );
    expect(normalize).not.toHaveBeenCalled();
    expect(reservePendingUpload).not.toHaveBeenCalled();
    expect(storeProfileImage).not.toHaveBeenCalled();
    expect(unitOfWorkRun).not.toHaveBeenCalled();
  });

  it("maps invalid processor output to CUSTOMER_PROFILE_IMAGE_INVALID", async () => {
    const service = new ProfileImageService(
      { run: vi.fn() } as never,
      { storeProfileImage: vi.fn() } as unknown as MediaStoragePort,
      {
        normalize: async () => {
          throw new MediaError("MEDIA_IMAGE_INVALID", "bad");
        },
      },
      pendingUploadPort(),
      { get: vi.fn() } as never,
      { append: vi.fn() },
      "folder",
      900,
    );

    await expect(
      service.put({
        principal: owner,
        bytes: Buffer.from("nope"),
        expectedAssociationVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_IMAGE_INVALID" });
  });

  it("enforces always-replace CAS and marks the previous media PENDING_DELETE", async () => {
    const previousMediaId = "media-old";
    const created: Array<Record<string, unknown>> = [];
    let associationVersion = 1;
    let profileImageMediaFileId: string | null = previousMediaId;
    const mediaRows = new Map<string, Record<string, unknown>>([
      [
        previousMediaId,
        {
          id: previousMediaId,
          status: "READY",
          storageKey: "folder/old",
          storageProvider: "CLOUDINARY",
          contentType: "image/webp",
          byteSize: 10,
          width: 10,
          height: 10,
        },
      ],
    ]);

    const prisma = {
      mediaFile: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          mediaRows.get(where.id) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = mediaRows.get(where.id);
          if (row === undefined) {
            throw new Error("missing media");
          }
          Object.assign(row, data);
          return row;
        },
      },
      customerProfile: {
        findUnique: async () => ({
          id: "profile",
          profileImageMediaFileId,
          imageAssociationVersion: associationVersion,
          profileImageMediaFile:
            profileImageMediaFileId === null
              ? null
              : mediaRows.get(profileImageMediaFileId),
        }),
        updateMany: async ({
          where,
          data,
        }: {
          where: { userId: string; imageAssociationVersion: number };
          data: {
            profileImageMediaFileId: string | null;
            imageAssociationVersion: { increment: number };
          };
        }) => {
          if (where.imageAssociationVersion !== associationVersion) {
            return { count: 0 };
          }
          profileImageMediaFileId = data.profileImageMediaFileId;
          associationVersion += data.imageAssociationVersion.increment;
          return { count: 1 };
        },
        create: async () => {
          throw new Error("profile already exists in this scenario");
        },
      },
    };

    const generalAudit = { append: vi.fn(async () => undefined) };
    const reservePendingUpload = vi.fn(
      async (input: {
        id: string;
        storageKey: string;
        contentType: string;
        byteSize: number;
        width: number;
        height: number;
      }) => {
        const row = {
          id: input.id,
          status: "PENDING_UPLOAD",
          storageKey: input.storageKey,
          storageProvider: "CLOUDINARY",
          contentType: input.contentType,
          byteSize: input.byteSize,
          width: input.width,
          height: input.height,
        };
        mediaRows.set(input.id, row);
        created.push(row);
      },
    );

    const service = new ProfileImageService(
      {
        run: async (work: (context: unknown) => Promise<unknown>) =>
          work({ prisma, generalAudit, privilegedAudit: {} }),
      } as never,
      {
        storeProfileImage: async ({ storageKey }) => ({
          provider: "CLOUDINARY",
          storageKey,
          contentType: "image/webp",
          byteSize: 48,
          width: 64,
          height: 64,
          uploadResourceType: "image" as const,
          uploadType: "authenticated" as const,
        }),
        createAuthorizedDeliveryUrl: async () => ({
          url: "https://signed.example/profile.webp",
          urlExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
        remove: async () => ({ destroyResult: "ok" as const }),
      },
      {
        normalize: async () => ({
          bytes: Buffer.from("webp"),
          contentType: "image/webp" as const,
          byteSize: 48,
          width: 64,
          height: 64,
        }),
      },
      pendingUploadPort({
        reservePendingUpload,
        markPendingDelete: vi.fn(async () => undefined),
      }),
      {
        get: async (_prisma: unknown, _userId: string, category: string) => ({
          category,
          created: false,
        }),
      } as never,
      { append: vi.fn() },
      "folder",
      900,
    );

    await expect(
      service.put({
        principal: owner,
        bytes: Buffer.from("jpeg"),
        expectedAssociationVersion: 99,
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_IMAGE_CONFLICT" });

    const aggregate = await service.put({
      principal: owner,
      bytes: Buffer.from("jpeg"),
      expectedAssociationVersion: 1,
    });

    expect(associationVersion).toBe(2);
    expect(profileImageMediaFileId).not.toBe(previousMediaId);
    expect(mediaRows.get(previousMediaId)?.["status"]).toBe("PENDING_DELETE");
    expect(generalAudit.append).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "customers.profile_image.associate",
        context: { outcome: "SUCCEEDED" },
      }),
    );
    expect(aggregate.profileImage?.url).toContain("https://");
    expect(aggregate.profileImage?.associationVersion).toBe(2);
  });

  it("maps first-create unique conflicts to CUSTOMER_PROFILE_IMAGE_CONFLICT and marks pending delete", async () => {
    const mediaRows = new Map<string, Record<string, unknown>>();
    const markPendingDelete = vi.fn(async () => undefined);
    const prisma = {
      mediaFile: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          mediaRows.get(where.id) ?? null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = mediaRows.get(where.id);
          if (row === undefined) {
            throw new Error("missing media");
          }
          Object.assign(row, data);
          return row;
        },
      },
      customerProfile: {
        findUnique: async () => null,
        create: async () => {
          throw Object.assign(new Error("Unique constraint failed"), {
            code: "P2002",
          });
        },
      },
    };

    const service = new ProfileImageService(
      {
        run: async (work: (context: unknown) => Promise<unknown>) =>
          work({
            prisma,
            generalAudit: { append: vi.fn(async () => undefined) },
            privilegedAudit: {},
          }),
      } as never,
      {
        storeProfileImage: async ({ storageKey }) => ({
          provider: "CLOUDINARY",
          storageKey,
          contentType: "image/webp",
          byteSize: 48,
          width: 64,
          height: 64,
          uploadResourceType: "image" as const,
          uploadType: "authenticated" as const,
        }),
        createAuthorizedDeliveryUrl: async () => ({
          url: "https://signed.example/profile.webp",
          urlExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        }),
        remove: async () => ({ destroyResult: "ok" as const }),
      },
      {
        normalize: async () => ({
          bytes: Buffer.from("webp"),
          contentType: "image/webp" as const,
          byteSize: 48,
          width: 64,
          height: 64,
        }),
      },
      pendingUploadPort({
        reservePendingUpload: vi.fn(
          async (input: {
            id: string;
            storageKey: string;
            contentType: string;
            byteSize: number;
            width: number;
            height: number;
          }) => {
            mediaRows.set(input.id, {
              id: input.id,
              status: "PENDING_UPLOAD",
              storageKey: input.storageKey,
              storageProvider: "CLOUDINARY",
              contentType: input.contentType,
              byteSize: input.byteSize,
              width: input.width,
              height: input.height,
            });
          },
        ),
        markPendingDelete,
      }),
      { get: vi.fn() } as never,
      { append: vi.fn() },
      "folder",
      900,
    );

    await expect(
      service.put({
        principal: owner,
        bytes: Buffer.from("jpeg"),
        expectedAssociationVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_PROFILE_IMAGE_CONFLICT" });
    expect(markPendingDelete).toHaveBeenCalled();
  });

  it("requires expectedAssociationVersion on delete and rejects absence", async () => {
    const prisma = {
      customerProfile: {
        findUnique: async () => null,
      },
    };
    const service = new ProfileImageService(
      {
        run: async (work: (context: unknown) => Promise<unknown>) =>
          work({ prisma, generalAudit: { append: vi.fn() }, privilegedAudit: {} }),
      } as never,
      { storeProfileImage: vi.fn() } as unknown as MediaStoragePort,
      { normalize: vi.fn() } as unknown as ProfileImageProcessor,
      pendingUploadPort(),
      { get: vi.fn() } as never,
      { append: vi.fn() },
      "folder",
      900,
    );

    await expect(service.remove(owner, 1)).rejects.toMatchObject({
      code: "CUSTOMER_PROFILE_IMAGE_ABSENT",
    });
  });
});
