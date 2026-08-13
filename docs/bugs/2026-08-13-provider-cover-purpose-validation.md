# Provider cover purpose validation

- **Observed:** `PUT /api/v1/providers/{providerId}/media/cover` returned
  `503 PROVIDER_DEPENDENCY_UNAVAILABLE` with `MEDIA_PROVIDER_FAILURE` for a
  valid cover.
- **Root cause:** the Cloudinary storage adapter validated every image using
  the customer-profile maximum edge of 1200 pixels, while a Provider cover is
  intentionally normalized to 1600x600.
- **Fix:** Provider images now use a dedicated storage operation that validates
  authoritative Cloudinary metadata against the exact dimensions for `LOGO`,
  `COVER`, or `GALLERY_IMAGE`. Customer-profile validation remains unchanged.
- **Regression coverage:** focused Cloudinary adapter cases cover all three
  Provider image purposes and reject a purpose/dimension mismatch.
