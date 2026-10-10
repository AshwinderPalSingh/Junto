"use client";

import { Camera, CameraOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/views/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/views/ui/dialog";
import { Spinner } from "@/views/ui/spinner";

/**
 * Take the profile photo with the webcam — no file picker needed.
 * Mount it only while open: the camera is released when it unmounts.
 */
export function CameraCaptureDialog({ onCancel, onCapture }: { onCancel: () => void; onCapture: (url: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      queueMicrotask(() => setError("This browser can't use the camera here. Choose a photo instead."));
      return;
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        stream = s;
        const video = videoRef.current;
        if (video) {
          video.srcObject = s;
          void video.play().catch(() => {});
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access is blocked. Allow it in your browser's site settings, or choose a photo instead."
            : "No camera was found. Choose a photo instead.",
        );
      });
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // Square centre crop; saved un-mirrored (how other people actually see you).
    const side = Math.min(video.videoWidth, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    canvas
      .getContext("2d")
      ?.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, side, side);
    canvas.toBlob((blob) => blob && onCapture(URL.createObjectURL(blob)), "image/jpeg", 0.92);
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Take a photo</DialogTitle>
          <DialogDescription>Face the camera in good light. You can adjust the framing next.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className="size-full -scale-x-100 object-cover"
          />
          {!ready && !error && (
            <div className="absolute inset-0 grid place-items-center text-white/80">
              <Spinner className="size-6" />
            </div>
          )}
          {ready && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[12%] border border-white/70 shadow-[0_0_0_999px_rgba(0,0,0,0.4)]"
            />
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/90">
              <div className="space-y-3">
                <CameraOff className="mx-auto size-8" />
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={capture} disabled={!ready}>
            <Camera /> Take photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
