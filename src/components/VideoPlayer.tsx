// //new 2.54
// "use client";

// import { useEffect, useRef } from "react";
// import type { TorrentFile } from "@/lib/torrent";
// // interface TorrentFile {
// //   name: string;
// //   length: number;

// //   streamTo?: (
// //     element: HTMLVideoElement,
// //     callback?: (error?: Error) => void,
// //   ) => void;
// // }

// interface VideoPlayerProps {
//   src: string | null;
//   torrentFile?: TorrentFile | null;
//   autoPlay?: boolean;

//   onPlay?: (currentTime: number) => void;
//   onPause?: (currentTime: number) => void;
//   onSeek?: (currentTime: number) => void;
// }

// export default function VideoPlayer({
//   src,
//   torrentFile = null,
//   autoPlay = false,
//   onPlay,
//   onPause,
//   onSeek,
// }: VideoPlayerProps) {
//   const videoRef = useRef<HTMLVideoElement | null>(null);

//   useEffect(() => {
//     const video = videoRef.current;

//     if (!video) {
//       return;
//     }

//     // Normal Blob/Object URL path
//     if (src) {
//       console.log("VideoPlayer: loading src");

//       video.src = src;
//       video.load();

//       return;
//     }

//     // WebTorrent path
//     if (torrentFile) {
//       console.log("VideoPlayer: received torrent file:", torrentFile.name);

//       if (!torrentFile.streamTo) {
//         console.error("VideoPlayer: torrent file does not expose streamTo().");

//         return;
//       }

//       console.log("VideoPlayer: starting WebTorrent stream...");

//       torrentFile.streamTo(video, (error?: Error) => {
//         if (error) {
//           console.error("VideoPlayer: WebTorrent stream failed:", error);

//           return;
//         }

//         console.log("VideoPlayer: WebTorrent stream attached.");
//       });

//       return;
//     }

//     // Nothing loaded
//     video.removeAttribute("src");
//     video.load();
//   }, [src, torrentFile]);

//   return (
//     <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
//       {src || torrentFile ? (
//         <video
//           ref={videoRef}
//           controls
//           playsInline
//           preload="metadata"
//           autoPlay={autoPlay}
//           onPlay={() => {
//             const video = videoRef.current;

//             if (!video) {
//               return;
//             }

//             console.log("VideoPlayer: play", video.currentTime);

//             onPlay?.(video.currentTime);
//           }}
//           onPause={() => {
//             const video = videoRef.current;

//             if (!video) {
//               return;
//             }

//             console.log("VideoPlayer: pause", video.currentTime);

//             onPause?.(video.currentTime);
//           }}
//           onSeeked={() => {
//             const video = videoRef.current;

//             if (!video) {
//               return;
//             }

//             console.log("VideoPlayer: seeked", video.currentTime);

//             onSeek?.(video.currentTime);
//           }}
//           className="h-full w-full object-contain"
//         />
//       ) : (
//         <div className="flex h-full items-center justify-center text-sm text-white/50">
//           No video loaded
//         </div>
//       )}
//     </div>
//   );
// }

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

import type { TorrentFile } from "@/lib/torrent";

export interface VideoPlayerHandle {
  playAt: (currentTime: number) => Promise<void>;
  pauseAt: (currentTime: number) => void;
  seekTo: (currentTime: number) => void;

  getCurrentTime: () => number | null;
  isPlaying: () => boolean;
  setPlaybackRate: (rate: number) => void;
}

interface VideoPlayerProps {
  src: string | null;
  torrentFile?: TorrentFile | null;
  autoPlay?: boolean;

  onReady?: () => void;

  onPlay?: (currentTime: number) => void;
  onPause?: (currentTime: number) => void;
  onSeek?: (currentTime: number) => void;
  canControlPlayback?: boolean;
}

const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer(
    {
      src,
      torrentFile = null,
      autoPlay = false,
      onReady,
      onPlay,
      onPause,
      onSeek,
      canControlPlayback = false,
    },
    ref,
  ) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamReadyRef = useRef(false);
    //const remoteActionRef = useRef(false);

    //can be update optimise
    const remoteActionRef = useRef<"play" | "pause" | "seek" | null>(null);

    const handleVideoReady = () => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      if (streamReadyRef.current) {
        return;
      }

      streamReadyRef.current = true;

      console.log("VideoPlayer: video source is playable.");

      onReady?.();
    };

    useImperativeHandle(
      ref,
      () => ({
        async playAt(currentTime: number) {
          const video = videoRef.current;

          if (!video) {
            return;
          }

          //remoteActionRef.current = true;
          remoteActionRef.current = "play";

          video.currentTime = currentTime;

          try {
            await video.play();
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
              console.log(
                "VideoPlayer: remote play interrupted by another playback action.",
              );

              return;
            }

            console.error("VideoPlayer: remote play failed:", error);
          }
        },

        pauseAt(currentTime: number) {
          const video = videoRef.current;

          if (!video) {
            return;
          }
          remoteActionRef.current = "pause";

          video.currentTime = currentTime;
          video.pause();
        },

        seekTo(currentTime: number) {
          const video = videoRef.current;

          if (!video) {
            return;
          }
          remoteActionRef.current = "seek";

          video.currentTime = currentTime;
        },
        getCurrentTime() {
          const video = videoRef.current;

          if (!video) {
            return null;
          }

          return video.currentTime;
        },

        isPlaying() {
          const video = videoRef.current;

          if (!video) {
            return false;
          }

          return !video.paused;
        },

        setPlaybackRate(rate: number) {
          const video = videoRef.current;

          if (!video) {
            return;
          }

          video.playbackRate = rate;
        },
      }),
      [],
    );

    useEffect(() => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      // Normal Blob/Object URL path
      if (src) {
        console.log("VideoPlayer: loading src");

        video.src = src;
        video.load();

        return;
      }

      // WebTorrent path
      if (torrentFile) {
        console.log("VideoPlayer: received torrent file:", torrentFile.name);

        if (!torrentFile.streamTo) {
          console.error(
            "VideoPlayer: torrent file does not expose streamTo().",
          );

          return;
        }

        console.log("VideoPlayer: starting WebTorrent stream...");

        torrentFile.streamTo(video, (error?: Error) => {
          if (error) {
            console.error("VideoPlayer: WebTorrent stream failed:", error);

            return;
          }

          console.log("VideoPlayer: WebTorrent stream attached.");
          /*
           * The WebTorrent stream has now been
           * attached to the video element.
           */
          onReady?.();
        });

        return;
      }

      // Nothing loaded
      video.removeAttribute("src");
      video.load();
    }, [src, torrentFile]);

    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        {src || torrentFile ? (
          <video
            ref={videoRef}
            //controls={canControlPlayback}
            controls
            controlsList="nodownload"
            playsInline
            preload="metadata"
            autoPlay={autoPlay}
            onLoadedMetadata={handleVideoReady}
            onCanPlay={handleVideoReady}
            onPlay={() => {
              const video = videoRef.current;

              if (!video) {
                return;
              }

              console.log("VideoPlayer: play", video.currentTime);

              if (remoteActionRef.current) {
                remoteActionRef.current = null;

                return;
              }

              onPlay?.(video.currentTime);
            }}
            //pause
            onPause={() => {
              const video = videoRef.current;

              if (!video) {
                return;
              }

              console.log("VideoPlayer: pause", video.currentTime);

              if (remoteActionRef.current === "pause") {
                remoteActionRef.current = null;

                return;
              }

              onPause?.(video.currentTime);
            }}
            //onSeek
            onSeeked={() => {
              const video = videoRef.current;

              if (!video) {
                return;
              }

              console.log("VideoPlayer: seeked", video.currentTime);

              if (remoteActionRef.current === "seek") {
                remoteActionRef.current = null;

                return;
              }

              onSeek?.(video.currentTime);
            }}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-white/50">
            No video loaded
          </div>
        )}
      </div>
    );
  },
);

VideoPlayer.displayName = "VideoPlayer";

export default VideoPlayer;
