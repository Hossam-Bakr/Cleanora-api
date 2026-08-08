import sharp from "sharp";

import { MediaError } from "../../../../src/modules/media/domain/media.errors.js";
import { PROFILE_IMAGE_MAX_BYTES } from "../../../../src/modules/media/domain/media.types.js";
import { SharpProfileImageProcessor } from "../../../../src/modules/media/infrastructure/sharp-profile-image.processor.js";

const processor = new SharpProfileImageProcessor();

async function jpegFixture(size = 64): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .jpeg()
    .toBuffer();
}

async function pngFixture(size = 64): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 10, g: 180, b: 90, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function webpFixture(size = 64): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 220, g: 80, b: 40 },
    },
  })
    .webp()
    .toBuffer();
}

describe("SharpProfileImageProcessor", () => {
  it("normalizes JPEG, PNG, and WebP to image/webp within the edge limit", async () => {
    for (const bytes of [
      await jpegFixture(800),
      await pngFixture(400),
      await webpFixture(200),
    ]) {
      const normalized = await processor.normalize(bytes);
      expect(normalized.contentType).toBe("image/webp");
      expect(normalized.byteSize).toBe(normalized.bytes.byteLength);
      expect(normalized.width).toBeGreaterThan(0);
      expect(normalized.height).toBeGreaterThan(0);
      expect(normalized.width).toBeLessThanOrEqual(1200);
      expect(normalized.height).toBeLessThanOrEqual(1200);
      const meta = await sharp(normalized.bytes).metadata();
      expect(meta.format).toBe("webp");
    }
  });

  it("rejects SVG and GIF inputs even when the buffer is well-formed", async () => {
    const svg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>`,
    );
    const gif = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .gif()
      .toBuffer();

    await expect(processor.normalize(svg)).rejects.toMatchObject({
      code: "MEDIA_IMAGE_INVALID",
    } satisfies Partial<MediaError>);
    await expect(processor.normalize(gif)).rejects.toMatchObject({
      code: "MEDIA_IMAGE_INVALID",
    } satisfies Partial<MediaError>);
  });

  it("rejects corrupt and empty buffers", async () => {
    await expect(processor.normalize(Buffer.alloc(0))).rejects.toMatchObject({
      code: "MEDIA_IMAGE_INVALID",
    });
    await expect(processor.normalize(Buffer.from("not-an-image"))).rejects.toThrow();
  });

  it("rejects oversize inputs before decoding work expands", async () => {
    const oversize = Buffer.alloc(PROFILE_IMAGE_MAX_BYTES + 1, 0xff);
    await expect(processor.normalize(oversize)).rejects.toMatchObject({
      code: "MEDIA_IMAGE_TOO_LARGE",
    });
  });

  it("strips EXIF/orientation metadata from normalized WebP output (T116)", async () => {
    const withMetadata = await sharp({
      create: {
        width: 120,
        height: 80,
        channels: 3,
        background: { r: 200, g: 100, b: 50 },
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const inputMeta = await sharp(withMetadata).metadata();
    expect(inputMeta.orientation).toBe(6);

    const normalized = await processor.normalize(withMetadata);
    expect(normalized.contentType).toBe("image/webp");
    expect(normalized.width).toBeLessThanOrEqual(1200);
    expect(normalized.height).toBeLessThanOrEqual(1200);

    const outputMeta = await sharp(normalized.bytes).metadata();
    expect(outputMeta.format).toBe("webp");
    expect(outputMeta.exif).toBeUndefined();
    expect(outputMeta.icc).toBeUndefined();
    expect(outputMeta.iptc).toBeUndefined();
    expect(outputMeta.xmp).toBeUndefined();
    expect(outputMeta.orientation).toBeUndefined();
  });
});
