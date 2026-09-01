
// "use client";

// import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// import type { TorrentFile } from "@/lib/torrent";

// export interface VideoPlayerHandle {
//   playAt: (currentTime: number) => Promise<void>;
//   pauseAt: (currentTime: number) => void;
//   seekTo: (currentTime: number) => Promise<void>;

//   getCurrentTime: () => number | null;
//   isPlaying: () => boolean;
//   setPlaybackRate: (rate: number) => void;
//   getPlaybackInfo: () => {
//     currentTime: number;
//     bufferedUntil: number | null;
//     bufferAhead: number;
//     isPlaying: boolean;
//     isBuffering: boolean;
//   } | null;
// }

// interface VideoPlayerProps {
//   src: string | null;
//   torrentFile?: TorrentFile | null;
//   autoPlay?: boolean;

//   onReady?: () => void;

//   onPlay?: (currentTime: number) => void;
//   onPause?: (currentTime: number) => void;
//   onSeek?: (currentTime: number) => void;
//   canControlPlayback?: boolean;
// }

// const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
//   function VideoPlayer(
//     {
//       src,
//       torrentFile = null,
//       autoPlay = false,
//       onReady,
//       onPlay,
//       onPause,
//       onSeek,
//       canControlPlayback = false,
//     },
//     ref,
//   ) {
//     const videoRef = useRef<HTMLVideoElement | null>(null);
//     const streamReadyRef = useRef(false);
//     //const remoteActionRef = useRef(false);

//     //can be update optimise
//     //const remoteActionRef = useRef<"play" | "pause" | "seek" | null>(null);
//     const playbackActionRef = useRef<"local" | "remote" | "sync" | null>(null);

//     const handleVideoReady = () => {
//       const video = videoRef.current;

//       if (!video) {
//         return;
//       }

//       if (streamReadyRef.current) {
//         return;
//       }

//       streamReadyRef.current = true;

//       console.log("VideoPlayer: video source is playable.");

//       onReady?.();
//     };

//     useImperativeHandle(
//       ref,
//       () => ({
//         async playAt(currentTime: number) {
//           const video = videoRef.current;

//           if (!video) {
//             return;
//           }
//           const startedAt = performance.now();

//           video.currentTime = currentTime;

//           try {
//             console.log("VideoPlayer: playAt started:", {
//               currentTime: video.currentTime,
//               delayMs: performance.now() - startedAt,
//               readyState: video.readyState,
//             });
//             await video.play();
//           } catch (error) {
//             if (error instanceof DOMException && error.name === "AbortError") {
//               console.log(
//                 "VideoPlayer: play interrupted by another playback action.",
//               );

//               throw error;
//             }

//             console.error("VideoPlayer: remote play failed:", error);

//             throw error;
//           }
//         },

//         pauseAt(currentTime: number) {
//           const video = videoRef.current;

//           if (!video) {
//             return;
//           }
//           //remoteActionRef.current = "pause";

//           video.currentTime = currentTime;
//           video.pause();
//         },

//         async seekTo(currentTime: number) {
//           const video = videoRef.current;

//           if (!video) {
//             return;
//           }

//           await new Promise<void>((resolve) => {
//             const handleSeeked = () => {
//               video.removeEventListener("seeked", handleSeeked);
//               resolve();
//             };

//             video.addEventListener("seeked", handleSeeked, {
//               once: true,
//             });

//             video.currentTime = currentTime;
//           });
//         },
//         getCurrentTime() {
//           const video = videoRef.current;

//           if (!video) {
//             return null;
//           }

//           return video.currentTime;
//         },

//         isPlaying() {
//           const video = videoRef.current;

//           if (!video) {
//             return false;
//           }

//           return !video.paused;
//         },

//         setPlaybackRate(rate: number) {
//           const video = videoRef.current;

//           if (!video) {
//             return;
//           }

//           video.playbackRate = rate;
//         },
//         getPlaybackInfo() {
//           const video = videoRef.current;

//           if (!video) {
//             return null;
//           }

//           let bufferedUntil: number | null = null;

//           if (video.buffered.length > 0) {
//             bufferedUntil = video.buffered.end(video.buffered.length - 1);
//           }

//           const currentTime = video.currentTime;

//           const bufferAhead =
//             bufferedUntil !== null
//               ? Math.max(0, bufferedUntil - currentTime)
//               : 0;

//           return {
//             currentTime,
//             bufferedUntil,
//             bufferAhead,
//             isPlaying: !video.paused,
//             isBuffering: video.readyState < HTMLMediaElement.HAVE_FUTURE_DATA,
//           };
//         },
//       }),
//       [],
//     );

//     useEffect(() => {
//       const video = videoRef.current;

//       if (!video) {
//         return;
//       }

//       // Normal Blob/Object URL path
//       if (src) {
//         console.log("VideoPlayer: loading src");

//         video.src = src;
//         video.load();

//         return;
//       }

//       // WebTorrent path
//       if (torrentFile) {
//         console.log("VideoPlayer: received torrent file:", torrentFile.name);

//         if (!torrentFile.streamTo) {
//           console.error(
//             "VideoPlayer: torrent file does not expose streamTo().",
//           );

//           return;
//         }

//         console.log("VideoPlayer: starting WebTorrent stream...");

//         torrentFile.streamTo(video, (error?: Error) => {
//           if (error) {
//             console.error("VideoPlayer: WebTorrent stream failed:", error);

//             return;
//           }

//           console.log("VideoPlayer: WebTorrent stream attached.");
//           /*
//            * The WebTorrent stream has now been
//            * attached to the video element.
//            */
//           onReady?.();
//         });

//         return;
//       }

//       // Nothing loaded
//       video.removeAttribute("src");
//       video.load();
//     }, [src, torrentFile]);

//     return (
//       <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
//         {src || torrentFile ? (
//           <video
//             ref={videoRef}
//             //controls={canControlPlayback}
//             controls
//             controlsList="nodownload"
//             playsInline
//             preload="metadata"
//             autoPlay={autoPlay}
//             onLoadedMetadata={handleVideoReady}
//             onCanPlay={handleVideoReady}
//             onPlay={() => {
//               const video = videoRef.current;

//               if (!video) {
//                 return;
//               }

//               console.log("VideoPlayer: play", video.currentTime);

//               // if (remoteActionRef.current) {
//               //   remoteActionRef.current = null;

//               //   return;
//               // }

//               onPlay?.(video.currentTime);
//             }}
//             //pause
//             onPause={() => {
//               const video = videoRef.current;

//               if (!video) {
//                 return;
//               }

//               console.log("VideoPlayer: pause", video.currentTime);

//               // if (remoteActionRef.current === "pause") {
//               //   remoteActionRef.current = null;

//               //   return;
//               // }

//               onPause?.(video.currentTime);
//             }}
//             //onSeek
//             onSeeked={() => {
//               const video = videoRef.current;

//               if (!video) {
//                 return;
//               }

//               console.log("VideoPlayer: seeked", video.currentTime);

//               // if (remoteActionRef.current === "seek") {
//               //   remoteActionRef.current = null;

//               //   return;
//               // }

//               onSeek?.(video.currentTime);
//             }}
//             className="h-full w-full object-contain"
//           />
//         ) : (
//           <div className="flex h-full items-center justify-center text-sm text-white/50">
//             No video loaded
//           </div>
//         )}
//       </div>
//     );
//   },
// );

// VideoPlayer.displayName = "VideoPlayer";

// export default VideoPlayer;


//v2 architecture

"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

import type { TorrentFile } from "@/lib/torrent";

export interface VideoPlayerHandle {
  playAt: (currentTime: number) => Promise<void>;
  pauseAt: (currentTime: number) => Promise<void>;
  seekTo: (currentTime: number) => Promise<void>;

  getCurrentTime: () => number | null;
  isPlaying: () => boolean;

  setPlaybackRate: (rate: number) => void;

  getPlaybackInfo: () => {
    currentTime: number;
    bufferedUntil: number | null;
    bufferAhead: number;
    isPlaying: boolean;
    isBuffering: boolean;
  } | null;
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

    /*
     * These counters represent DOM events that were caused
     * by an imperative playback command.
     *
     * Example:
     *
     * playAt()
     *   -> currentTime =
     *   -> seeked event
     *   -> play event
     *
     * Neither event should be treated as a local user action.
     */
    const suppressedPlayEventsRef = useRef(0);
    const suppressedPauseEventsRef = useRef(0);
    const suppressedSeekEventsRef = useRef(0);

    /*
     * Prevent a stale seek event from being interpreted
     * as a local seek after the command has completed.
     */
    const suppressSeekEvent = () => {
      suppressedSeekEventsRef.current += 1;
    };

    const suppressPlayEvent = () => {
      suppressedPlayEventsRef.current += 1;
    };

    const suppressPauseEvent = () => {
      suppressedPauseEventsRef.current += 1;
    };

    const consumeSuppressedSeek = () => {
      if (suppressedSeekEventsRef.current <= 0) {
        return false;
      }

      suppressedSeekEventsRef.current -= 1;

      return true;
    };

    const consumeSuppressedPlay = () => {
      if (suppressedPlayEventsRef.current <= 0) {
        return false;
      }

      suppressedPlayEventsRef.current -= 1;

      return true;
    };

    const consumeSuppressedPause = () => {
      if (suppressedPauseEventsRef.current <= 0) {
        return false;
      }

      suppressedPauseEventsRef.current -= 1;

      return true;
    };

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
        /*
         * --------------------------------------------------
         * REMOTE / SYNC PLAY
         * --------------------------------------------------
         */
        async playAt(currentTime: number) {
          const video = videoRef.current;

          if (!video) {
            return;
          }

          /*
           * currentTime assignment can generate a seeked
           * event later.
           */
          suppressSeekEvent();

          /*
           * video.play() generates play asynchronously.
           */
          suppressPlayEvent();

          console.log("VideoPlayer: playAt", {
            currentTime,
            readyState: video.readyState,
          });

          video.currentTime = currentTime;

          try {
            await video.play();
          } catch (error) {
            /*
             * If play() fails, the expected play event will
             * never arrive, so remove the suppression token.
             */
            suppressedPlayEventsRef.current = Math.max(
              0,
              suppressedPlayEventsRef.current - 1,
            );

            if (
              error instanceof DOMException &&
              error.name === "AbortError"
            ) {
              console.log(
                "VideoPlayer: play interrupted by another playback action.",
              );

              throw error;
            }

            console.error(
              "VideoPlayer: play failed:",
              error,
            );

            throw error;
          }
        },

        /*
         * --------------------------------------------------
         * REMOTE / SYNC PAUSE
         * --------------------------------------------------
         */
        async pauseAt(currentTime: number) {
          const video = videoRef.current;

          if (!video) {
            return;
          }

          /*
           * currentTime assignment can generate seeked.
           */
          suppressSeekEvent();

          /*
           * pause() generates pause asynchronously.
           */
          suppressPauseEvent();

          console.log("VideoPlayer: pauseAt", {
            currentTime,
          });

          video.currentTime = currentTime;
          video.pause();
        },

        /*
         * --------------------------------------------------
         * REMOTE / SYNC SEEK
         * --------------------------------------------------
         */
        async seekTo(currentTime: number) {
          const video = videoRef.current;

          if (!video) {
            return;
          }

          /*
           * This seek was initiated by WatchParty,
           * therefore the resulting seeked event must
           * never become a local SEEK broadcast.
           */
          suppressSeekEvent();

          console.log("VideoPlayer: seekTo", {
            currentTime,
          });

          /*
           * If we're already effectively at the target,
           * don't wait for a seeked event that may never fire.
           */
          if (Math.abs(video.currentTime - currentTime) < 0.01) {
            /*
             * We created a suppression token above, but no
             * seeked event will consume it.
             */
            suppressedSeekEventsRef.current = Math.max(
              0,
              suppressedSeekEventsRef.current - 1,
            );

            return;
          }

          await new Promise<void>((resolve) => {
            let settled = false;

            const finish = () => {
              if (settled) {
                return;
              }

              settled = true;

              video.removeEventListener(
                "seeked",
                finish,
              );

              resolve();
            };

            video.addEventListener(
              "seeked",
              finish,
              { once: true },
            );

            video.currentTime = currentTime;

            /*
             * Safety fallback.
             *
             * Normally seeked fires quickly, but WebTorrent
             * / media pipelines can occasionally delay it.
             */
            window.setTimeout(() => {
              if (settled) {
                return;
              }

              /*
               * The event did not arrive, so remove the
               * suppression token that would otherwise
               * affect a future local seek.
               */
              suppressedSeekEventsRef.current = Math.max(
                0,
                suppressedSeekEventsRef.current - 1,
              );

              finish();
            }, 1500);
          });
        },

        /*
         * --------------------------------------------------
         * STATE
         * --------------------------------------------------
         */

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

        getPlaybackInfo() {
          const video = videoRef.current;

          if (!video) {
            return null;
          }

          let bufferedUntil: number | null = null;

          if (video.buffered.length > 0) {
            bufferedUntil = video.buffered.end(
              video.buffered.length - 1,
            );
          }

          const currentTime = video.currentTime;

          const bufferAhead =
            bufferedUntil !== null
              ? Math.max(
                  0,
                  bufferedUntil - currentTime,
                )
              : 0;

          return {
            currentTime,
            bufferedUntil,
            bufferAhead,
            isPlaying: !video.paused,
            isBuffering:
              video.readyState <
              HTMLMediaElement.HAVE_FUTURE_DATA,
          };
        },
      }),
      [],
    );

    /*
     * ------------------------------------------------------
     * VIDEO SOURCE
     * ------------------------------------------------------
     */

    useEffect(() => {
      const video = videoRef.current;

      if (!video) {
        return;
      }

      /*
       * Reset readiness whenever the source changes.
       */
      streamReadyRef.current = false;

      /*
       * Clear stale event suppressions when loading a
       * completely new media source.
       */
      suppressedPlayEventsRef.current = 0;
      suppressedPauseEventsRef.current = 0;
      suppressedSeekEventsRef.current = 0;

      /*
       * Normal Blob/Object URL path.
       */
      if (src) {
        console.log(
          "VideoPlayer: loading src",
        );

        video.src = src;
        video.load();

        return;
      }

      /*
       * WebTorrent path.
       */
      if (torrentFile) {
        console.log(
          "VideoPlayer: received torrent file:",
          torrentFile.name,
        );

        if (!torrentFile.streamTo) {
          console.error(
            "VideoPlayer: torrent file does not expose streamTo().",
          );

          return;
        }

        console.log(
          "VideoPlayer: starting WebTorrent stream...",
        );

        torrentFile.streamTo(
          video,
          (error?: Error) => {
            if (error) {
              console.error(
                "VideoPlayer: WebTorrent stream failed:",
                error,
              );

              return;
            }

            console.log(
              "VideoPlayer: WebTorrent stream attached.",
            );

            onReady?.();
          },
        );

        return;
      }

      /*
       * Nothing loaded.
       */
      video.removeAttribute("src");
      video.load();
    }, [src, torrentFile, onReady]);

    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        {src || torrentFile ? (
          <video
            ref={videoRef}
            controls
            controlsList="nodownload"
            playsInline
            preload="metadata"
            autoPlay={autoPlay}
            onLoadedMetadata={handleVideoReady}
            onCanPlay={handleVideoReady}
            /*
             * ------------------------------------------------
             * PLAY EVENT
             * ------------------------------------------------
             */
            onPlay={() => {
              const video = videoRef.current;

              if (!video) {
                return;
              }

              console.log(
                "VideoPlayer: play",
                video.currentTime,
              );

              if (consumeSuppressedPlay()) {
                console.log(
                  "VideoPlayer: suppressed PLAY event.",
                );

                return;
              }

              /*
               * This was a genuine local user PLAY.
               */
              onPlay?.(video.currentTime);
            }}
            /*
             * ------------------------------------------------
             * PAUSE EVENT
             * ------------------------------------------------
             */
            onPause={() => {
              const video = videoRef.current;

              if (!video) {
                return;
              }

              console.log(
                "VideoPlayer: pause",
                video.currentTime,
              );

              if (consumeSuppressedPause()) {
                console.log(
                  "VideoPlayer: suppressed PAUSE event.",
                );

                return;
              }

              /*
               * Genuine local user PAUSE.
               */
              onPause?.(video.currentTime);
            }}
            /*
             * ------------------------------------------------
             * SEEK EVENT
             * ------------------------------------------------
             */
            onSeeked={() => {
              const video = videoRef.current;

              if (!video) {
                return;
              }

              console.log(
                "VideoPlayer: seeked",
                video.currentTime,
              );

              if (consumeSuppressedSeek()) {
                console.log(
                  "VideoPlayer: suppressed SEEK event.",
                );

                return;
              }

              /*
               * Genuine local user SEEK.
               */
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