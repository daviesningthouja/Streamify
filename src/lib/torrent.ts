/* eslint-disable @next/next/no-assign-module-variable */
"use client";

let client: any = null;
let serverReady = false;
// import type WebTorrent from "webtorrent";

// let client: WebTorrent.Instance | null = null;
export interface TorrentFile {
  name: string;
  length: number;

  // streamTo(
  //   element: HTMLVideoElement,
  // ): void;
  streamTo?: (
    element: HTMLVideoElement,
    callback?: (error?: Error) => void,
  ) => void;
}
async function loadWebTorrent() {
  if (typeof window === "undefined") {
    throw new Error("WebTorrent can only run in the browser.");
  }

  if (!client) {
    const module = await import("webtorrent/dist/webtorrent.min.js");

    const WebTorrent = module.default ?? module;

    client = new WebTorrent();
  }

  if (!serverReady) {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Workers are not supported in this browser.");
    }

    console.log("Registering WebTorrent Service Worker...");

    const registration = await navigator.serviceWorker.register("sw.min.js", {
      scope: "/",
    });

    console.log("Service Worker registration:", registration);

    await navigator.serviceWorker.ready;

    const worker = registration.active;

    // if (!worker) {
    //   throw new Error(
    //     "WebTorrent Service Worker is not active.",
    //   );
    // }

    console.log(
      "WebTorrent Service Worker active:",
      registration.active,
      // worker.scriptURL,
      // worker.state,
    );

    client.createServer({
      controller: registration,
    });

    serverReady = true;

    console.log("WebTorrent browser server created.");
  }

  return client;
}

export async function seedFile(
  file: File,
  onReady: (magnetURI: string) => void,
  onError: (error: Error) => void,
) {
  try {
    const torrentClient = await loadWebTorrent();

    torrentClient.seed(file, (torrent: any) => {
      console.log("Torrent created:", torrent.magnetURI);

      onReady(torrent.magnetURI);
    });
  } catch (error) {
    console.error("Failed to initialize WebTorrent:", error);

    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
export async function downloadTorrent(
  magnetURI: string,
  onReady: (file: any) => void,
  onProgress?: (progress: number) => void,
  onError?: (error: Error) => void,
) {
  try {
    const torrentClient = await loadWebTorrent();

    console.log("Adding torrent:", magnetURI);

    /*
     * Prevent duplicate torrent
     * instances.
     */
    // const existingTorrent =
    //   torrentClient.get(
    //     magnetURI,
    //   );

    // if (existingTorrent) {
    //   console.log(
    //     "Torrent already exists. Reusing it.",
    //   );

    //   const file =
    //     existingTorrent.files[0];

    //   if (file) {
    //     onReady(file);
    //   }

    //   return;
    // }

    torrentClient.add(magnetURI, (torrent: any) => {
      console.log("Torrent metadata received:", torrent.name);

      torrent.on("download", () => {
        onProgress?.(torrent.progress);
      });

      torrent.on("done", () => {
        console.log("Torrent download complete");

        onProgress?.(1);
      });

      torrent.on("error", (error: Error) => {
        console.error("Torrent error:", error);

        onError?.(error);
      });

      const file = torrent.files[0];

      if (!file) {
        onError?.(new Error("Torrent contains no files."));

        return;
      }

      console.log("Torrent file ready:", file.name);

      console.log("File size:", file.length);

      /*
       * IMPORTANT:
       *
       * Do NOT call file.blob().
       */
      onReady(file);
    });
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

// export async function getTorrentVideoUrl(
//   magnetURI: string,
//   onReady: (url: string, fileName: string) => void,
//   onProgress?: (progress: number) => void,
//   onError?: (error: Error) => void,
// ) {
//   try {
//     const torrentClient = await loadWebTorrent();

//     console.log("Adding torrent for progressive playback:", magnetURI);

//     torrentClient.add(magnetURI, (torrent: any) => {
//       console.log("Torrent metadata received:", torrent.name);

//       torrent.on("download", () => {
//         onProgress?.(torrent.progress);
//       });

//       torrent.on("error", (error: Error) => {
//         console.error("Torrent error:", error);

//         onError?.(error);
//       });

//       const file = torrent.files[0];

//       if (!file) {
//         onError?.(new Error("Torrent contains no files."));

//         return;
//       }

//       /*
//        * WebTorrent exposes the file
//        * through its streaming API.
//        */
//       file.streamTo(document.createElement("video"));

//       console.log("Torrent file available for streaming:", file.name);

//       /*
//        * NOTE:
//        * This is only a temporary test
//        * of the streaming capability.
//        */
//       onReady("", file.name);
//     });
//   } catch (error) {
//     onError?.(error instanceof Error ? error : new Error(String(error)));
//   }
// }
