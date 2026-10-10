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
  const meta = await sharp(input)
    .metadata()
    .catch(() => null);
  if (!meta) throw new DomainError("That file isn't an image we can read. Try a JPG or PNG.");
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
    throw new DomainError("Please upload a JPG, PNG or WebP photo.");
  }
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  if (Math.min(width, height) < RULES.photo.minSide) {
    throw new DomainError("That photo is too small. Use one at least 200×200 pixels.");
  }

  const side = RULES.photo.outputSide;
  const image = await sharp(input)
    .rotate()
    .resize(side, side, { fit: "cover", position: sharp.strategy.attention })
    .webp({ quality: 82 })
    .toBuffer();

  return { image };
}
