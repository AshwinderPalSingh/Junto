import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as tf from "@tensorflow/tfjs-core";
import { processProfilePhoto } from "@/lib/images";
import { faceQualityMetrics } from "@/lib/face-quality";

let portrait: Buffer;
beforeAll(async () => { portrait = await readFile(path.join(process.cwd(), "tests/fixtures/face-portrait.jpg")); });

describe("pretrained profile photo validation", () => {
  it("accepts a clear portrait and stores a metadata-free square WebP", async () => {
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network disabled for bundled-model test"));
    let image: Buffer;
    try {
      image = (await processProfilePhoto(portrait)).image;
      expect(network).not.toHaveBeenCalled();
    } finally { network.mockRestore(); }
    expect(await sharp(image).metadata()).toMatchObject({ format: "webp", width: 640, height: 640 });
    const meta = await sharp(image).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.icc).toBeUndefined();
  });
  it("rejects a non-face image and releases inference tensors between attempts", async () => {
    const plain = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#888888" } }).png().toBuffer();
    const tensors = tf.memory().numTensors;
    for (let i = 0; i < 3; i += 1) await expect(processProfilePhoto(plain)).rejects.toThrow(/human face/);
    expect(tf.memory().numTensors).toBe(tensors);
  });
  it("rejects a heavily blurred portrait", async () => {
    const blurred = await sharp(portrait).blur(12).jpeg().toBuffer();
    await expect(processProfilePhoto(blurred)).rejects.toThrow(/blurry|clear human face/);
  });
  it("rejects a group image rather than silently choosing one person's face", async () => {
    const tile = await sharp(portrait).extract({ left: 180, top: 0, width: 460, height: 460 }).resize(320, 320).png().toBuffer();
    const group = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#999999" } })
      .composite([{ input: tile, left: 0, top: 160 }, { input: tile, left: 320, top: 160 }]).png().toBuffer();
    await expect(processProfilePhoto(group)).rejects.toThrow(/More than one face/);
  });
  it("rejects extreme lighting and insufficient resolution", async () => {
    const dark = await sharp(portrait).linear(0.03, 0).jpeg().toBuffer();
    const white = await sharp(portrait).linear(0.03, 247).jpeg().toBuffer();
    await expect(processProfilePhoto(dark)).rejects.toThrow(/dark|clear human face/);
    await expect(processProfilePhoto(white)).rejects.toThrow(/washed out|clear human face/);
    await expect(processProfilePhoto(await sharp(portrait).resize(100, 100).png().toBuffer())).rejects.toThrow(/too small/);
    await expect(processProfilePhoto(Buffer.from("not an image"))).rejects.toThrow(/isn't an image/);
  });
  it("measures sharpness on facial detail independently of overall brightness", () => {
    const flat = new Uint8Array(160 * 160).fill(120);
    const detail = Uint8Array.from(flat, (_, i) => ((Math.floor(i / 160) + i % 160) % 2 ? 80 : 160));
    expect(faceQualityMetrics(flat, 160, 160).sharpness).toBe(0);
    expect(faceQualityMetrics(detail, 160, 160).sharpness).toBeGreaterThan(100);
    expect(faceQualityMetrics(detail, 160, 160).luminance).toBe(120);
  });
  it("bounds concurrent face checks and releases the queue after rejected uploads", async () => {
    const plain = await sharp({ create: { width: 640, height: 640, channels: 3, background: "#888888" } }).png().toBuffer();
    const { validateProfileFace } = await import("@/lib/face-quality");
    const attempts = await Promise.allSettled(Array.from({ length: 5 }, () => validateProfileFace(plain)));
    expect(attempts.filter(result => result.status === "rejected" && /busy/.test(result.reason.message))).toHaveLength(1);
    await expect(processProfilePhoto(portrait)).resolves.toHaveProperty("image");
  });
});
