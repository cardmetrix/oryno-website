"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type KycSelfieCameraProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
};

export function KycSelfieCamera({
  open,
  onOpenChange,
  onCapture,
}: KycSelfieCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function attachVideo(node: HTMLVideoElement | null) {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      void node.play().catch(() => undefined);
    }
  }
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const snapshotRef = useRef<Blob | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function clearSnapshot() {
    if (snapshot) URL.revokeObjectURL(snapshot);
    setSnapshot(null);
    snapshotRef.current = null;
  }

  useEffect(() => {
    if (!open) {
      stopStream();
      clearSnapshot();
      setError(null);
      return;
    }

    let cancelled = false;
    setStarting(true);
    setError(null);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          setError(
            "Camera access is needed to take your selfie. Allow the camera, or choose a photo instead.",
          );
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when dialog opens/closes
  }, [open]);

  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        clearSnapshot();
        snapshotRef.current = blob;
        setSnapshot(URL.createObjectURL(blob));
      },
      "image/jpeg",
      0.9,
    );
  }

  function usePhoto() {
    const blob = snapshotRef.current;
    if (!blob) return;
    const file = new File([blob], `kyc-selfie-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    onCapture(file);
    onOpenChange(false);
  }

  function pickFromFiles() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.setAttribute("capture", "user");
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      onCapture(file);
      onOpenChange(false);
    };
    input.click();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0 sm:p-0">
        <DialogHeader className="px-5 pt-5 pr-12 text-left">
          <DialogTitle>Take a selfie</DialogTitle>
          <DialogDescription>
            Face the camera, then capture and use the photo for KYC.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5">
          <div className="relative aspect-square overflow-hidden rounded-[22px] bg-black">
            <video
              ref={attachVideo}
              autoPlay
              muted
              playsInline
              className={`h-full w-full scale-x-[-1] object-cover ${snapshot ? "invisible" : ""}`}
            />
            {snapshot ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob preview
              <img
                src={snapshot}
                alt="Selfie preview"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            {starting && !snapshot ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            ) : null}
          </div>
          {error ? (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 px-5 pb-5 pt-4">
          {snapshot ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  clearSnapshot();
                }}
                className="btn-secondary inline-flex h-11 items-center justify-center gap-2 text-sm"
              >
                <RefreshCw className="h-4 w-4" />
                Retake
              </button>
              <button
                type="button"
                onClick={usePhoto}
                className="btn-primary h-11 text-sm"
              >
                Use photo
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                disabled={starting || Boolean(error)}
                onClick={takePhoto}
                className="btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-60"
              >
                <Camera className="h-4 w-4" />
                Capture
              </button>
              <button
                type="button"
                onClick={pickFromFiles}
                className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
              >
                Choose a photo instead
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
