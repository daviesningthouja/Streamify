/* eslint-disable @next/next/no-assign-module-variable */
"use client";

let client: any = null;
// import type WebTorrent from "webtorrent";

// let client: WebTorrent.Instance | null = null;

async function loadWebTorrent() {
  if (typeof window === "undefined") {
    throw new Error("WebTorrent can only be loaded in the browser.");
  }

  if (!client) {
    const module = await import("webtorrent/dist/webtorrent.min.js");

    const WebTorrent = module.default ?? module;

    client = new WebTorrent();
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
  onError?: (error: Error) => void
) {
  try {
    const torrentClient = await loadWebTorrent();

    console.log(
      "Adding torrent:",
      magnetURI
    );

    torrentClient.add(
      magnetURI,
      (torrent: any) => {
        console.log(
          "Torrent metadata received:",
          torrent.name
        );

        torrent.on("download", () => {
          onProgress?.(torrent.progress);
        });

        torrent.on("done", () => {
          console.log(
            "Torrent download complete"
          );

          onProgress?.(1);
        });

        torrent.on("error", (error: Error) => {
          console.error(
            "Torrent error:",
            error
          );

          onError?.(error);
        });

        const file = torrent.files[0];

        if (!file) {
          onError?.(
            new Error(
              "Torrent contains no files."
            )
          );

          return;
        }

        onReady(file);
      }
    );
  } catch (error) {
    onError?.(
      error instanceof Error
        ? error
        : new Error(String(error))
    );
  }
}
