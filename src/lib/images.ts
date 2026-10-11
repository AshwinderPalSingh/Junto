import "server-only";
import sharp from "sharp";
import { RULES } from "@/config/app";
import { DomainError } from "@/lib/errors";

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "heif", "avif"]);

/**
 * Normalises an uploaded profile photo:
 * - checks it is a real image of a sensible size,
 * - fixes orientation, centre-crops to a square, re-encodes to WebP,
 * - strips all metadata (EXIF can contain GPS coordinates).
 */
export async function processProfilePhoto(input: Buffer) {
  if (input.length > RULES.photo.maxBytes) throw new DomainError("That photo is too large. Use a smaller photo.");
  const options = { limitInputPixels: 25_000_000 };
  const meta = await sharp(input, options)
    .metadata()
    .catch(() => null);
  if (!meta) throw new DomainError("That file isn't an image we can read. Try a JPG or PNG.");
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new DomainError("Please upload a JPG, PNG or WebP photo.");
  }
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  if (width * height > options.limitInputPixels || (meta.pages ?? 1) > 1) {
    throw new DomainError("Use a still photo under 25 megapixels.");
  }
  if (Math.min(width, height) < RULES.photo.minSide) {
    throw new DomainError("That photo is too small. Use one at least 200×200 pixels.");
  }

  const side = RULES.photo.outputSide;
  const image = await sharp(input, options)
    .rotate()
    .resize(side, side, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toBuffer();

  return { image };
}
