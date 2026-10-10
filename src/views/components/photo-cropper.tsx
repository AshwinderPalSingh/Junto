"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/views/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/views/ui/dialog";
import { Slider } from "@/views/ui/slider";

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image"));
    img.src = src;
  });
}

/** Crops the selected area to a square JPEG (the server re-encodes and strips metadata). */
export async function cropToBlob(src: string, area: Area, size = 800): Promise<Blob> {
  const img = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))), "image/jpeg", 0.9),
  );
}

export function PhotoCropDialog({
  src,
  onCancel,
  onConfirm,
}: {
  src: string | null;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (!src || !area) return;
    setBusy(true);
    try {
      onConfirm(await cropToBlob(src, area));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={Boolean(src)} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Frame your face</DialogTitle>
          <DialogDescription>Drag to centre your face. Pinch or slide to zoom.</DialogDescription>
        </DialogHeader>
        <div className="relative aspect-square w-full overflow-hidden bg-black">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setArea(pixels)}
            />
          )}
        </div>
        <div className="flex items-center gap-3 px-1">
          <Minus className="size-4 text-muted-foreground" />
          <Slider
            value={[zoom]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={([z]) => setZoom(z)}
            aria-label="Zoom"
          />
          <Plus className="size-4 text-muted-foreground" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!area || busy}>
            Use this photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
