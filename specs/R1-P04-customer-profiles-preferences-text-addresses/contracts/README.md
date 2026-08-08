# Phase 1 Contracts — R1-P04

Contracts repaired under **DEC-031**, **DEC-032**, and **DEC-033**. They record
the approved R1-P04 behavior; they do **not** authorize commit, push, merge,
deployment, production migration, or phase Complete.

| Contract | Purpose |
|---|---|
| [customer-self-service.openapi.yaml](./customer-self-service.openapi.yaml) | Draft HTTPS customer self-service API |
| [customer-self-service.md](./customer-self-service.md) | Behavioral rules for SELF operations |
| [privacy-processor.md](./privacy-processor.md) | Trusted processor claim/resolve contract |
| [privacy-privileged-reassign.md](./privacy-privileged-reassign.md) | staff_admin-only PROCESSING reassignment |
| [media-profile-image.md](./media-profile-image.md) | Cloudinary authenticated upload + signed delivery (DEC-033) |
| [transaction-boundaries.md](./transaction-boundaries.md) | Customers TX + Admin audit writers |

## Non-goals encoded in every contract

- No `customer` role or `resource.self.*` requirement
- No geospatial fields
- No R1-P02 `/auth/*` contract changes
- No staff UI / production privacy-processor adapter
- No local filesystem / `MEDIA_STORAGE_ROOT` profile-image storage (DEC-033)
- No video, PDF, AWS S3 runtime, Docker-specific requirements, or job queues in R1-P04
- No public/unsigned media URL or storage-key leakage
