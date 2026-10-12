# Profile Photo Face Detector

Google MediaPipe Face Detection, short-range TFJS model version 1, loaded by
`@tensorflow-models/face-detection` 1.0.3 under the bundled Apache-2.0 license.

Source: https://tfhub.dev/mediapipe/tfjs-model/face_detection/short/1
Documentation: https://github.com/tensorflow/tfjs-models/tree/master/face-detection

The unmodified `model.json` and `group1-shard1of1.bin` are bundled into Vercel
server functions. TensorFlow.js uses the CPU backend and an in-memory file loader;
inference never downloads models at request time or transmits photos externally.
The server rejects missing/multiple faces, inadequate face size, cropped facial
features, extreme lighting and low facial sharpness. At most four requests queue
per server instance; image limits and per-member upload limits still apply.

This is a photo-quality gate, not identity recognition, liveness detection, or a
guarantee that a photo is unedited. No templates, embeddings, landmarks or quality
metrics are persisted. Moderator review, reports and blocks remain available.
