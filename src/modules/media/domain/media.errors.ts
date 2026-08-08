export class MediaError extends Error {
  public constructor(
    public readonly code:
      | "MEDIA_IMAGE_INVALID"
      | "MEDIA_IMAGE_TOO_LARGE"
      | "MEDIA_PROVIDER_UNSUPPORTED"
      | "MEDIA_PROVIDER_FAILURE",
    message: string,
  ) {
    super(message);
    this.name = "MediaError";
  }
}
