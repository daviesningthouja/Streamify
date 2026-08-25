"use client";

import { useEffect, useRef } from "react";

interface VideoPlayerProps {
  src: string | null;
  autoPlay?: boolean;
}

export default function VideoPlayer({
  src,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(
    null
  );

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !src) {
      return;
    }

    video.src = src;
    video.load();
  }, [src]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
      {src ? (
        <video
          ref={videoRef}
          controls
          playsInline
          autoPlay={autoPlay}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/50">
          No video loaded
        </div>
      )}
    </div>
  );
}