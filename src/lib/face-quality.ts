import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import * as tf from "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-cpu";
import { createDetector, SupportedModels, type FaceDetector } from "@tensorflow-models/face-detection";
import { DomainError } from "@/lib/errors";

let detector: Promise<FaceDetector> | undefined;
let queue = Promise.resolve();
let pending = 0;

function faceDetector(): Promise<FaceDetector> {
  detector ??= (async () => {
    await tf.setBackend("cpu");
    await tf.ready();
    const directory = path.join(process.cwd(), "models", "face-detection");
    const manifest = JSON.parse(await readFile(path.join(directory, "model.json"), "utf8")) as tf.io.ModelJSON;
    const weights = await readFile(path.join(directory, "group1-shard1of1.bin"));
    return createDetector(SupportedModels.MediaPipeFaceDetector, {
      runtime: "tfjs", modelType: "short", maxFaces: 3,
      detectorModelUrl: tf.io.fromMemory({ ...manifest,
        weightSpecs: manifest.weightsManifest.flatMap(group => group.weights),
        weightData: Uint8Array.from(weights).buffer,
      }),
    });
  })().catch(error => { detector = undefined; throw error; });
  return detector;
}

/** Evaluate visibility on the detected face, rather than sharp background detail. */
export function faceQualityMetrics(pixels: Uint8Array, width: number, height: number) {
  let luminance = 0;
  let clipped = 0;
  let sum = 0;
  let squares = 0;
  let count = 0;
  for (const pixel of pixels) { luminance += pixel; if (pixel < 8 || pixel > 247) clipped += 1; }
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const laplacian = pixels[i - 1] + pixels[i + 1] + pixels[i - width] + pixels[i + width] - 4 * pixels[i];
      sum += laplacian; squares += laplacian * laplacian; count += 1;
    }
  }
  return { luminance: luminance / pixels.length, clippedFraction: clipped / pixels.length,
    sharpness: count ? squares / count - (sum / count) ** 2 : 0 };
}

/** A bundled pretrained model runs locally. No face templates or provider requests are made. */
export async function validateProfileFace(image: Buffer) {
  if (pending >= 4) throw new DomainError("Photo checks are busy. Try uploading again in a moment.");
  pending += 1;
  const previous = queue;
  let release!: () => void;
  queue = new Promise(resolve => { release = resolve; });
  await previous;
  let tensor: tf.Tensor3D | undefined;
  try {
    const model = await faceDetector();
    const { data, info } = await sharp(image).removeAlpha().toColourspace("srgb").raw().toBuffer({ resolveWithObject: true });
    tensor = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], "int32");
    const faces = await model.estimateFaces(tensor, { flipHorizontal: false });
    if (!faces.length) throw new DomainError("We couldn't find a clear human face. Use a front-facing photo with your face visible.");
    if (faces.length !== 1) throw new DomainError("More than one face is visible. Choose a photo of just you.");
    const { box, keypoints } = faces[0];
    if (Math.min(box.width, box.height) < Math.max(80, Math.min(info.width, info.height) * 0.22)) {
      throw new DomainError("Your face is too small in this photo. Crop closer or take a closer photo.");
    }
    const margin = Math.min(info.width, info.height) * 0.03;
    if (box.xMin < -margin || box.yMin < -margin || box.xMax > info.width + margin || box.yMax > info.height + margin) {
      throw new DomainError("Part of your face is cut off. Keep your whole face inside the photo.");
    }
    const rightEye = keypoints.find(point => point.name === "rightEye");
    const leftEye = keypoints.find(point => point.name === "leftEye");
    const mouth = keypoints.find(point => point.name === "mouthCenter");
    const nose = keypoints.find(point => point.name === "noseTip");
    if (!rightEye || !leftEye || !mouth || !nose ||
        [rightEye, leftEye, mouth, nose].some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
          point.x < 0 || point.x >= info.width || point.y < 0 || point.y >= info.height)) {
      throw new DomainError("Keep your eyes, nose and mouth visible inside the photo.");
    }
    const eyeDistance = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
    if (eyeDistance < box.width * 0.2 || Math.abs(rightEye.y - leftEye.y) > eyeDistance * 0.55 ||
        mouth.y <= (rightEye.y + leftEye.y) / 2 || nose.x < Math.min(rightEye.x, leftEye.x) - eyeDistance * 0.15 ||
        nose.x > Math.max(rightEye.x, leftEye.x) + eyeDistance * 0.15) {
      throw new DomainError("Face the camera so both eyes and your face are clearly visible.");
    }
    const left = Math.max(0, Math.floor(box.xMin));
    const top = Math.max(0, Math.floor(box.yMin));
    const width = Math.min(info.width - left, Math.ceil(box.width));
    const height = Math.min(info.height - top, Math.ceil(box.height));
    const face = await sharp(image).extract({ left, top, width, height }).resize(160, 160).toColourspace("b-w").raw().toBuffer();
    const quality = faceQualityMetrics(face, 160, 160);
    if (quality.luminance < 25 || quality.luminance > 240 || quality.clippedFraction > 0.75) {
      throw new DomainError("Your face is too dark or washed out. Try a photo in even, natural light.");
    }
    if (quality.sharpness < 35) throw new DomainError("Your face looks blurry. Use a sharper photo or take another one.");
    return { box, imageWidth: info.width, imageHeight: info.height };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    console.error("[photo] face check unavailable", error);
    throw new DomainError("Photo checks are temporarily unavailable. Please try again shortly.");
  } finally {
    tensor?.dispose();
    pending -= 1;
    release();
  }
}
