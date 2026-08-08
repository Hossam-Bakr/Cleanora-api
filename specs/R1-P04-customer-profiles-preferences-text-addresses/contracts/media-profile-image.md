# Media Profile Image Contract — R1-P04 (DEC-033)

## Ownership split

| Concern | Owner |
|---|---|
| Profile-image association + customer authorization + CAS | `customers` |
| Sharp normalization + Cloudinary storage + signed delivery + cleanup | `media` |

## Configuration (DEC-033)

| Name | Rule |
|---|---|
| `MEDIA_STORAGE_PROVIDER` | Required when media composed; functional value `cloudinary`; `s3` fails readiness clearly |
| `CLOUDINARY_CLOUD_NAME` | Required for Cloudinary provider |
| `CLOUDINARY_API_KEY` | Required; never exposed via HTTP/logs/errors |
| `CLOUDINARY_API_SECRET` | Required; never exposed via HTTP/logs/errors |
| `CLOUDINARY_PROFILE_IMAGE_FOLDER` | Required asset folder |
| `CLOUDINARY_SIGNED_URL_TTL_SECONDS` | Bounded positive integer |
| `MEDIA_IMAGE_MAX_BYTES` | Exactly `5242880` (5 MiB) for R1-P04 |

**Removed:** `MEDIA_STORAGE_ROOT` — superseded by DEC-033.

## MediaStoragePort (media module)

```text
storeProfileImage({ ownerUserId, buffer, sourceContentType }) -> StoredMediaReference
createAuthorizedDeliveryUrl({ mediaFileId, principalUserId }) -> { url, urlExpiresAt }
markPendingDelete({ mediaFileId, ownerUserId }) -> void
cleanupPendingMedia({ limit }) -> numberProcessed   # idempotent bounded sweep
```

`StoredMediaReference` (internal only): `provider`, `storageKey` (Cloudinary
`public_id`), `contentType`, `byteSize`, `width`, `height`. Never returned on
HTTP.

## Upload pipeline (always replace)

1. Route-scoped Multer `memoryStorage`: exactly one multipart field `file`; max
   5 MiB; initial MIME filter JPEG/PNG/WebP only.
2. Required multipart field `expectedAssociationVersion` (CAS).
3. Sharp decodes `req.file.buffer`, auto-orients, resizes inside 1200×1200,
   strips metadata, outputs WebP. Reject empty, corrupt, SVG, GIF/animated,
   oversize, and undecodable input.
4. Persist durable `media_files` row as `PENDING_UPLOAD` **before** Cloudinary
   upload (outside Prisma business TX).
5. Upload optimized WebP to Cloudinary outside any Prisma transaction.
6. Customers association TX: CAS on `image_association_version`; mark new media
   `READY`; link profile; mark prior media `PENDING_DELETE`; increment version;
   append Admin general transactional audit.
7. Generate signed delivery URL; return canonical customer profile including
   `profileImage`.
8. Async bounded cleanup deletes prior `PENDING_DELETE` Cloudinary assets.

**Always replace:** no content hash, duplicate comparison, or reuse of prior
`public_id`. Each success creates a new opaque Cloudinary `public_id`.

## Storage safety

- Server generates opaque `public_id` values only; client filename never used
- Cloudinary `type: authenticated`; `overwrite: false`
- No unsigned public URL presented as protected delivery
- Responses never leak storage keys, `public_id`, folder paths, or credentials
- Cloudinary upload/delete/network I/O **never** inside Prisma transactions
- Existing image is **never** removed before new upload + association commit succeed
- Previous asset deletion is durable, bounded, asynchronous; must not delay success

## Association rules (customers)

- At most one current profile image per identity (`image_association_version` CAS)
- Shared across all customer categories
- `expectedAssociationVersion` **required** on PUT and DELETE
- Stale CAS → conflict; prior association unchanged; new candidate →
  `PENDING_DELETE` + cleanup
- Failed Sharp/upload/reservation/association/audit: current image unchanged;
  compensating cleanup for new candidate only
- Concurrent replacement: losing writer's new media becomes cleanup work

## HTTP delivery (`/api/v1/customers/profile-image`)

| Method | Behavior |
|---|---|
| GET | Authenticated SELF + shared-image eligibility; returns `profileImage { mediaId, url, urlExpiresAt, associationVersion, contentType?, width?, height? }` or explicit safe absence. Regenerates signed URL; no business audit on successful read (FR-035). |
| PUT | Multipart `file` + `expectedAssociationVersion`; always replaces; returns canonical customer profile aggregate including new `profileImage` signed URL |
| DELETE | Requires `expectedAssociationVersion`; clears association; prior media → async cleanup |

Delivery requires media authorization **and** customers SELF + shared-image
eligibility. Knowing a media id is never enough.

## Audit

Association add/replace/remove mutations are auditable through the Admin
general transactional writer. Audit must not store image bytes, signed URLs,
storage keys, or Cloudinary credentials.

## Cleanup sweep (media-owned)

Handles `PENDING_DELETE` and stale `PENDING_UPLOAD` (grace period) in bounded
batches at startup and on a fixed interval. Idempotent; Cloudinary not-found =
success; `DELETED` only after successful/idempotent provider removal; never
delete `READY` associated media.
