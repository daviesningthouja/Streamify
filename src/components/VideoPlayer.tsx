// "use client";

// import { useEffect, useRef } from "react";

// // import type { TorrentFile } from "@/lib/torrent";

// interface VideoPlayerProps {
//   src: string | null;
//   // torrentFile?: TorrentFile | null;
//   autoPlay?: boolean;
// }

// export default function VideoPlayer({
//   src,
//   // torrentFile = null,
//   autoPlay = false,
// }: VideoPlayerProps) {
//   const videoRef = useRef<HTMLVideoElement | null>(null);

//   useEffect(() => {
//     const video = videoRef.current;

//     if (!video || !src) {
//       return;
//     }

//     /*
//      * Normal local video
//      */
//     // if (src) {

//     video.src = src;
//     video.load();
//     // }

//     return;
//     /*
//      * Progressive WebTorrent video
//      */
//     // if (torrentFile) {
//     //   console.log(
//     //     "Rendering torrent directly to video:",
//     //     torrentFile.name,
//     //   );

//     //   torrentFile.renderTo(
//     //     video,
//     //     (error) => {
//     //       if (error) {
//     //         console.error(
//     //           "Failed to render torrent:",
//     //           error,
//     //         );

//     //         return;
//     //       }

//     //       console.log(
//     //         "Torrent is now attached to video element.",
//     //       );
//     //     },
//     //   );
//     // }

//     // return () => {
//     //   /*
//     //    * Clear the media source when
//     //    * switching videos.
//     //    */
//     //   video.removeAttribute(
//     //     "src",
//     //   );

//     //   video.load();
//     // };
//   }, [
//     src,
//     // torrentFile,
//   ]);

//   return (
//     <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
//       {src  ? (
//         <video
//           ref={videoRef}
//           controls
//           playsInline
//           autoPlay={autoPlay}
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

//new

// "use client";

// import {
//   useEffect,
//   useRef,
// } from "react";

// interface VideoPlayerProps {
//   src: string | null;
//   autoPlay?: boolean;
// }

// export default function VideoPlayer({
//   src,
//   autoPlay = false,
// }: VideoPlayerProps) {
//   const videoRef =
//     useRef<HTMLVideoElement | null>(
//       null,
//     );

//   useEffect(() => {
//     const video =
//       videoRef.current;

//     if (!video || !src) {
//       return;
//     }

//     video.src = src;
//     video.load();
//   }, [src]);

//   return (
//     <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
//       {src ? (
//         <video
//           ref={videoRef}
//           controls
//           playsInline
//           autoPlay={autoPlay}
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

// "use client";

// import { useEffect, useRef } from "react";

// interface TorrentFile {
//   name: string;
//   length: number;

//   streamTo(element: HTMLVideoElement): void;
// }

// interface VideoPlayerProps {
//   src: string | null;
//   torrentFile?: TorrentFile | null;
//   autoPlay?: boolean;
// }

// export default function VideoPlayer({
//   src,
//   torrentFile = null,
//   autoPlay = false,
// }: VideoPlayerProps) {
//   const videoRef = useRef<HTMLVideoElement | null>(null);

//   useEffect(() => {
//     const video = videoRef.current;

//     if (!video) {
//       return;
//     }

//     /*
//      * Normal video URL.
//      */
//     if (src) {
//       console.log("Loading normal video source.");

//       video.src = src;
//       video.load();

//       return;
//     }

//     /*
//      * WebTorrent progressive stream.
//      */
//     if (torrentFile) {
//       console.log("Streaming torrent file:", torrentFile.name);

//       try {
//         torrentFile.streamTo(video);

//         console.log("Torrent stream attached to video.");
//       } catch (error) {
//         console.error("Failed to stream torrent file:", error);
//       }
//     }

//     return () => {
//       video.pause();

//       video.removeAttribute("src");

//       video.load();
//     };
//   }, [src, torrentFile]);

//   return (
//     <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
//       {src || torrentFile ? (
//         <video
//           ref={videoRef}
//           controls
//           playsInline
//           autoPlay={autoPlay}
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


//2C  Torrent file reaches player      ✅
// "use client";

// import {
//   useEffect,
//   useRef,
// } from "react";

// interface VideoPlayerProps {
//   src: string | null;
//   torrentFile?: {
//     name: string;
//     length: number;
//   } | null;
//   autoPlay?: boolean;
// }

// export default function VideoPlayer({
//   src,
//   torrentFile = null,
//   autoPlay = false,
// }: VideoPlayerProps) {
//   const videoRef =
//     useRef<HTMLVideoElement | null>(
//       null,
//     );

//   useEffect(() => {
//     const video =
//       videoRef.current;

//     if (!video) {
//       return;
//     }

//     if (src) {
//       video.src = src;
//       video.load();

//       return;
//     }

//     /*
//      * Torrent streaming will be
//      * connected here in the next step.
//      */
//     if (torrentFile) {
//       console.log(
//         "Torrent file received by VideoPlayer:",
//         torrentFile.name,
//       );
//     }

//     return () => {
//       video.pause();
//       video.removeAttribute("src");
//       video.load();
//     };
//   }, [src, torrentFile]);

//   return (
//     <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
//       {src || torrentFile ? (
//         <video
//           ref={videoRef}
//           controls
//           playsInline
//           autoPlay={autoPlay}
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

//new 2.54
"use client";

import { useEffect, useRef } from "react";

interface TorrentFile {
  name: string;
  length: number;

  streamTo?: (
    element: HTMLVideoElement,
    callback?: (error?: Error) => void,
  ) => void;
}

interface VideoPlayerProps {
  src: string | null;
  torrentFile?: TorrentFile | null;
  autoPlay?: boolean;
}

export default function VideoPlayer({
  src,
  torrentFile = null,
  autoPlay = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
        },
      );

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
          controls
          playsInline
          preload="metadata"
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