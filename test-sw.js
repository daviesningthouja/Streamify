(() => {
  "use strict";

  const torrentOwners = new Map();
  let cancelRequested = false;

  self.addEventListener("install", () => {
    self.skipWaiting();
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener("message", (event) => {
    const data = event.data;

    if (!data || !data.type) {
      return;
    }

    if (data.type === "stream-sync-register-torrent") {
      const infoHash = String(
        data.infoHash || "",
      ).toLowerCase();

      const source = event.source;

      if (!infoHash || !source || !source.id) {
        if (event.ports && event.ports[0]) {
          event.ports[0].postMessage({
            ok: false,
            error: "Missing infoHash or client ID.",
          });
        }

        return;
      }

      torrentOwners.set(
        infoHash,
        source.id,
      );

      console.log(
        "[Stream-Sync SW] Registered torrent owner:",
        infoHash,
        source.id,
      );

      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          ok: true,
          infoHash,
          clientId: source.id,
        });
      }

      return;
    }

    if (data.type === "stream-sync-unregister-torrent") {
      const infoHash = String(
        data.infoHash || "",
      ).toLowerCase();

      const currentOwner =
        torrentOwners.get(infoHash);

      if (
        infoHash &&
        currentOwner ===
          (event.source && event.source.id)
      ) {
        torrentOwners.delete(infoHash);
      }

      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          ok: true,
          infoHash,
        });
      }
    }
  });

  self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = request.url;

    const prefix =
      self.registration.scope +
      "webtorrent/";

    if (!url.includes(prefix)) {
      return;
    }

    if (
      url.includes(
        prefix + "keepalive/",
      )
    ) {
      event.respondWith(
        new Response(),
      );

      return;
    }

    if (
      url.includes(
        prefix + "cancel/",
      )
    ) {
      cancelRequested = true;

      event.respondWith(
        new Response(),
      );

      return;
    }

    event.respondWith(
      handleWebTorrentRequest(
        request,
      ),
    );
  });

  async function handleWebTorrentRequest(
    request,
  ) {
    const prefix =
      self.registration.scope +
      "webtorrent/";

    const index =
      request.url.indexOf(prefix);

    if (index === -1) {
      return new Response(
        "Not Found",
        {
          status: 404,
        },
      );
    }

    const path =
      request.url.slice(
        index + prefix.length,
      );

    const slash =
      path.indexOf("/");

    if (slash === -1) {
      return new Response(
        "Not Found",
        {
          status: 404,
        },
      );
    }

    const infoHash =
      decodeURIComponent(
        path.slice(0, slash),
      ).toLowerCase();

    const ownerClientId =
      torrentOwners.get(
        infoHash,
      );

    console.log(
      "[Stream-Sync SW] Request:",
      infoHash,
      ownerClientId,
    );

    if (!ownerClientId) {
      return new Response(
        "No WebTorrent owner registered.",
        {
          status: 404,
        },
      );
    }

    const ownerClient =
      await self.clients.get(
        ownerClientId,
      );

    if (!ownerClient) {
      torrentOwners.delete(
        infoHash,
      );

      return new Response(
        "Torrent owner unavailable.",
        {
          status: 404,
        },
      );
    }

    const channel =
      new MessageChannel();

    const responseData =
      await new Promise(
        (resolve) => {
          channel.port1.onmessage =
            (event) => {
              resolve(
                event.data,
              );
            };

          ownerClient.postMessage(
            {
              url: request.url,
              method: request.method,
              headers:
                Object.fromEntries(
                  request.headers.entries(),
                ),
              scope:
                self.registration.scope,
              destination:
                request.destination,
              type: "webtorrent",
            },
            [channel.port2],
          );
        },
      );

    if (!responseData) {
      channel.port1.close();

      return new Response(
        "Not Found",
        {
          status: 404,
        },
      );
    }

    if (
      responseData.body !==
      "STREAM"
    ) {
      channel.port1.postMessage(
        false,
      );

      channel.port1.close();

      return new Response(
        responseData.body,
        responseData,
      );
    }

    return new Response(
      new ReadableStream({
        pull(controller) {
          return new Promise(
            (resolve) => {
              channel.port1.onmessage =
                (event) => {
                  const chunk =
                    event.data;

                  if (chunk) {
                    controller.enqueue(
                      chunk,
                    );
                  } else {
                    channel.port1.onmessage =
                      null;

                    channel.port1.close();

                    controller.close();
                  }

                  resolve();
                };

              if (
                cancelRequested
              ) {
                channel.port1.postMessage(
                  false,
                );

                cancelRequested = false;

                resolve();

                return;
              }

              channel.port1.postMessage(
                true,
              );
            },
          );
        },

        cancel() {
          try {
            channel.port1.postMessage(
              false,
            );
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          } catch (_) {}

          channel.port1.close();
        },
      }),
      responseData,
    );
  }
})();