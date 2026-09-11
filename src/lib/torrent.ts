"use client";

let client: any = null;
let serverReady = false;
let initializationPromise: Promise<any> | null = null;

export interface TorrentFile {
  name: string;
  length: number;

  streamURL?: string;

  streamTo?: (
    element: HTMLVideoElement,
    callback?: (error?: Error) => void,
  ) => void;
}

/*
 * ------------------------------------------------------
 * WEBTORRENT INITIALIZATION
 * ------------------------------------------------------
 *
 * One WebTorrent client + one browser server per
 * JavaScript runtime (browser tab).
 *
 * Multiple WatchParty components in the same tab
 * therefore reuse the same WebTorrent infrastructure.
 *
 * Different browser tabs still have independent
 * WebTorrent clients.
 */

async function loadWebTorrent() {
  if (typeof window === "undefined") {
    throw new Error("WebTorrent can only run in the browser.");
  }

  /*
   * If initialization is already running, wait for it.
   *
   * This prevents two simultaneous calls from creating
   * competing WebTorrent clients / servers.
   */
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    /*
     * --------------------------------------------------
     * CREATE / REUSE WEBTORRENT CLIENT
     * --------------------------------------------------
     */

    if (!client) {
      const module = await import("webtorrent/dist/webtorrent.min.js");

      const WebTorrent = module.default ?? module;

      client = new WebTorrent();

      console.log("WebTorrent client created.");
    }

    /*
     * --------------------------------------------------
     * CREATE / REUSE SERVICE WORKER SERVER
     * --------------------------------------------------
     */

    if (!serverReady) {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Workers are not supported in this browser.");
      }

      console.log("Initializing WebTorrent Service Worker...");

      /*
       * Reuse an existing registration if one already
       * exists.
       *
       * This is important because Service Worker
       * registration is browser/origin scoped rather
       * than React-component scoped.
       */
const serviceWorkerUrl = "/stream-sync-sw.js";

let registration =
  await navigator.serviceWorker.getRegistration("/");

if (!registration) {
  console.log(
    "Registering Stream-Sync Service Worker:",
    serviceWorkerUrl,
  );

  registration = await navigator.serviceWorker.register(
    serviceWorkerUrl,
    {
      scope: "/",
      updateViaCache: "none",
    },
  );
} else {
  console.log(
    "Existing Service Worker registration:",
    registration.active?.scriptURL,
  );

  await registration.update();
}
  //     let registration = await navigator.serviceWorker.getRegistration("/");

  //     /*
  //      * Register it only if it does not already exist.
  //      */
  //     if (!registration) {
  //       console.log("Registering WebTorrent Service Worker...");

  //       registration = await navigator.serviceWorker.register("/stream-sync-sw.js", {
  //         scope: "/",
  //       });
  // //       registration =
  // // await navigator.serviceWorker.register(
  // //   "/api/stream-sync-sw",
  // //   {
  // //     scope: "/",
  // //   },
  // // );
  //     } else {
  //       console.log("Reusing existing WebTorrent Service Worker registration.");
  //     }

      console.log("Service Worker registration:", registration);

      /*
       * Wait until the Service Worker is ready.
       */
      await navigator.serviceWorker.ready;

      /*
       * Re-read the registration after ready().
       *
       * This avoids relying on a possibly stale
       * registration.active reference.
       */
      const readyRegistration =
        await navigator.serviceWorker.getRegistration("/");

      if (!readyRegistration) {
        throw new Error("WebTorrent Service Worker registration was lost.");
      }

      if (!readyRegistration.active) {
        throw new Error("WebTorrent Service Worker is not active.");
      }

      console.log(
        "WebTorrent Service Worker active:",
        readyRegistration.active,
      );

      /*
       * IMPORTANT:
       *
       * createServer() belongs to THIS WebTorrent
       * client and uses the existing Service Worker.
       */
      client.createServer({
        controller: readyRegistration,
      });
      console.log(
  "WebTorrent browser server created for:",
  readyRegistration.active?.scriptURL,
);

      serverReady = true;

      console.log("WebTorrent browser server created.");
    }

    return client;
  })();

  try {
    return await initializationPromise;
  } catch (error) {
    /*
     * If initialization fails, allow a future call
     * to retry instead of permanently caching
     * a rejected promise.
     */
    initializationPromise = null;

    throw error;
  }
}

/*
 * ------------------------------------------------------
 * REGISTER TORRENT OWNER
 * ------------------------------------------------------
 *
 * Tell the Stream-Sync Service Worker that THIS browser
 * tab owns the supplied torrent.
 */
async function registerTorrentOwner(infoHash: string) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    throw new Error("Service Workers are not available.");
  }

  const registration = await navigator.serviceWorker.getRegistration("/");

  if (!registration?.active) {
    throw new Error("WebTorrent Service Worker is not active.");
  }

  return new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();

    const timeout = window.setTimeout(() => {
      channel.port1.close();

      reject(new Error("Timed out while registering torrent owner."));
    }, 5000);

    channel.port1.onmessage = (event) => {
      window.clearTimeout(timeout);

      channel.port1.close();

      const response = event.data;

      if (!response?.ok) {
        reject(
          new Error(response?.error || "Failed to register torrent owner."),
        );

        return;
      }

      console.log("Torrent owner registered with Service Worker:", {
        infoHash,
        clientId: response.clientId,
      });

      resolve();
    };

    registration.active!.postMessage(
      {
        type: "stream-sync-register-torrent",
        infoHash,
      },
      [channel.port2],
    );
  });
}

/*
 * ------------------------------------------------------
 * SEED FILE
 * ------------------------------------------------------
 */

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

/*
 * ------------------------------------------------------
 * DOWNLOAD TORRENT
 * ------------------------------------------------------
 */

export async function downloadTorrent(
  magnetURI: string,
  onReady: (file: TorrentFile) => void,
  onProgress?: (progress: number) => void,
  onError?: (error: Error) => void,
) {
  try {
    const torrentClient = await loadWebTorrent();

    console.log("Adding torrent:", magnetURI);

    /*
     * --------------------------------------------------
     * REUSE EXISTING TORRENT
     * --------------------------------------------------
     *
     * This prevents the same torrent from being added
     * repeatedly to the same WebTorrent client.
     */

    // const existingTorrent =
    //   torrentClient.get(magnetURI);

    // if (existingTorrent) {
    //   console.log(
    //     "Torrent already exists. Reusing it:",
    //     existingTorrent.infoHash,
    //   );

    //   const file =
    //     existingTorrent.files?.[0];

    //   if (!file) {
    //     throw new Error(
    //       "Existing torrent contains no files.",
    //     );
    //   }

    //   console.log(
    //     "Reusing torrent file:",
    //     file.name,
    //   );

    //   onReady(file);

    //   return;
    // }

    /*
     * --------------------------------------------------
     * ADD NEW TORRENT
     * --------------------------------------------------
     */

    torrentClient.add(magnetURI, async (torrent: any) => {
      console.log("Torrent metadata received:", torrent.name);

      console.log("Torrent infoHash:", torrent.infoHash);

      torrent.on("download", () => {
        onProgress?.(torrent.progress);
      });

      torrent.on("done", () => {
        console.log("Torrent download complete:", torrent.infoHash);

        onProgress?.(1);
      });

      torrent.on("error", (error: Error) => {
        console.error("Torrent error:", error);

        onError?.(error);
      });

      const file = torrent.files?.[0];

      if (!file) {
        onError?.(new Error("Torrent contains no files."));

        return;
      }
      /*
       * --------------------------------------------------
       * REGISTER THIS TAB AS THE TORRENT OWNER
       * --------------------------------------------------
       *
       * The Service Worker will use this mapping when
       * the video element requests:
       *
       * /webtorrent/<infoHash>/<file>
       */
      try {
        await registerTorrentOwner(torrent.infoHash);
      } catch (error) {
        console.error("Failed to register torrent owner:", error);

        onError?.(error instanceof Error ? error : new Error(String(error)));

        return;
      }

      console.log("Torrent file ready:", file.name);

      console.log("File size:", file.length);

      console.log("Torrent infoHash:", torrent.infoHash);

      console.log("WebTorrent stream URL:", file.streamURL);

      /*
       * IMPORTANT:
       *
       * Do NOT call file.blob().
       *
       * We want WebTorrent's browser HTTP streaming
       * path through the Service Worker.
       */
      onReady(file);
    });
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}
