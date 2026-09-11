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
      const infoHash = String(data.infoHash || "").toLowerCase();

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

      torrentOwners.set(infoHash, source.id);

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
      const infoHash = String(data.infoHash || "").toLowerCase();

      const currentOwner = torrentOwners.get(infoHash);

      if (infoHash && currentOwner === (event.source && event.source.id)) {
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

    const prefix = self.registration.scope + "webtorrent/";

    if (!url.includes(prefix)) {
      return;
    }

    if (url.includes(prefix + "keepalive/")) {
      event.respondWith(new Response());

      return;
    }

    if (url.includes(prefix + "cancel/")) {
      cancelRequested = true;

      event.respondWith(new Response());

      return;
    }

    event.respondWith(handleWebTorrentRequest(request));
  });

  async function handleWebTorrentRequest(request) {
    const prefix = self.registration.scope + "webtorrent/";
    const index = request.url.indexOf(prefix);

    if (index === -1) {
      return new Response("Not Found", {
        status: 404,
      });
    }

    const path = request.url.slice(index + prefix.length);
    const slash = path.indexOf("/");

    if (slash === -1) {
      return new Response("Not Found", {
        status: 404,
      });
    }

    const infoHash = decodeURIComponent(path.slice(0, slash)).toLowerCase();

    const ownerClientId = torrentOwners.get(infoHash);

    console.log("[Stream-Sync SW] Request:", {
      infoHash,
      ownerClientId,
      url: request.url,
    });

    if (!ownerClientId) {
      return new Response("No WebTorrent owner registered.", {
        status: 404,
      });
    }

    /*
     * IMPORTANT:
     * Use matchAll() exactly like WebTorrent's official
     * worker implementation, but select only our registered
     * torrent owner.
     */
    const clientList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    const ownerClient = clientList.find(
      (client) => client.id === ownerClientId,
    );

    console.log("[Stream-Sync SW] Owner client lookup:", {
      ownerClientId,
      found: !!ownerClient,
      availableClients: clientList.map((client) => client.id),
    });

    if (!ownerClient) {
      torrentOwners.delete(infoHash);

      return new Response("Torrent owner unavailable.", {
        status: 404,
      });
    }

    const { url, method, headers, destination } = request;

    const messageChannel = new MessageChannel();

    const [responseData, port] = await new Promise((resolve) => {
      messageChannel.port1.onmessage = ({ data }) => {
        console.log("[Stream-Sync SW] Received response from owner:", data);

        resolve([data, messageChannel.port1]);
      };

      ownerClient.postMessage(
        {
          url,
          method,
          headers: Object.fromEntries(headers.entries()),
          scope: self.registration.scope,
          destination,
          type: "webtorrent",
        },
        [messageChannel.port2],
      );
    });

    let timeout = null;

    const cleanup = () => {
      try {
        port.postMessage(false);
      } catch (_) {}

      if (timeout) {
        clearTimeout(timeout);
      }

      port.onmessage = null;
    };

    /*
     * WebTorrent can return a normal HTTP response
     * or STREAM.
     */
    if (responseData.body !== "STREAM") {
      cleanup();

      return new Response(responseData.body, responseData);
    }

    return new Response(
      new ReadableStream({
        pull(controller) {
          return new Promise((resolve) => {
            port.onmessage = ({ data }) => {
              if (data) {
                controller.enqueue(data);
              } else {
                cleanup();
                controller.close();
              }

              resolve();
            };

            clearTimeout(timeout);

            if (destination !== "document") {
              timeout = setTimeout(() => {
                cleanup();
                resolve();
              }, 5000);
            }

            port.postMessage(true);
          });
        },

        cancel() {
          cleanup();
        },
      }),
      responseData,
    );
  }
})();
