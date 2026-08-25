"use client";

import { useEffect, useRef, useState } from "react";
import Peer, { DataConnection } from "peerjs";
import { createPeer, connectToPeer } from "@/lib/peer";
import ChatBox from "@/components/ChatBox";
import type { ChatMessage } from "@/types/chat";
import type { PeerMessage, PeerRole } from "@/types/peer";
import { seedFile, downloadTorrent } from "@/lib/torrent";

import type { TorrentStatus } from "@/types/torrent";
import VideoPlayer from "@/components/VideoPlayer";
export default function WatchParty() {
  const peerRef = useRef<Peer | null>(null);
  const connectionRef = useRef<DataConnection | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [magnetURI, setMagnetURI] = useState("");

  const [torrentStatus, setTorrentStatus] = useState<TorrentStatus>("idle");

  const [role, setRole] = useState<PeerRole>("host");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");

  const [peerId, setPeerId] = useState("");
  const [roomId, setRoomId] = useState("");

  // Reactive connection status
  const [isConnected, setIsConnected] = useState(false);
  
  async function handleGuestTorrent(
  magnetURI: string
) {
  console.log(
    "Starting torrent download..."
  );

  setTorrentStatus("downloading");

  await downloadTorrent(
    magnetURI,

    async (file) => {
      console.log(
        "Torrent file ready:",
        file.name
      );

      console.log(
        "File size:",
        file.length
      );

      try {
        const blob = await file.blob();

        const url = URL.createObjectURL(blob);

        setVideoSrc(url);

        setTorrentStatus("ready");

        console.log(
          "Guest video URL created:",
          url
        );
      } catch (error) {
        console.error(
          "Failed to create video URL:",
          error
        );

        setTorrentStatus("error");
      }
    },

    (progress) => {
      console.log(
        "Download progress:",
        Math.round(progress * 100),
        "%"
      );
    },

    (error) => {
      console.error(
        "Torrent download error:",
        error
      );

      setTorrentStatus("error");
    }
  );
}
  /*
   * Handle incoming PeerJS data
   */
  function handleIncomingData(data: unknown) {
    console.log("Received:", data);

    const incoming = data as PeerMessage;
    if (incoming.type === "MAGNET") {
      const magnet = incoming.payload as {
        magnetURI: string;
        fileName: string;
        fileSize: number;
      };

      console.log("Received magnet:", magnet.magnetURI);

      handleGuestTorrent(magnet.magnetURI);

      return;
    }
    switch (incoming.type) {
      case "CONNECTED":
        console.log("Peer connected:", incoming.payload.message);
        break;

      case "CHAT": {
        const chatMessage = incoming.payload;

        setMessages((previous) => [...previous, chatMessage]);

        break;
      }

      default:
        console.warn("Unknown message type:", incoming);
    }
  }

  /*
   * Initialize PeerJS
   */
  useEffect(() => {
    const peer = createPeer();

    peerRef.current = peer;

    /*
     * Our PeerJS ID is ready
     */
    peer.on("open", (id) => {
      console.log("My Peer ID:", id);
      setPeerId(id);
    });

    /*
     * HOST:
     * Someone connects to us.
     */
    peer.on("connection", (connection) => {
      console.log("Incoming connection:", connection.peer);

      setRole("host");

      connectionRef.current = connection;

      connection.on("open", () => {
        console.log("Connection established");

        // Update React state
        setIsConnected(true);

        connection.send({
          type: "CONNECTED",
          payload: {
            message: "Hello from host",
          },
        });
      });

      connection.on("data", handleIncomingData);

      /*
       * Peer disconnected
       */
      connection.on("close", () => {
        console.log("Peer disconnected");

        setIsConnected(false);

        if (connectionRef.current?.peer === connection.peer) {
          connectionRef.current = null;
        }
      });

      /*
       * Connection error
       */
      connection.on("error", (error) => {
        console.error("Connection error:", error);

        setIsConnected(false);
      });
    });

    /*
     * PeerJS error
     */
    peer.on("error", (error) => {
      console.error("PeerJS error:", error);

      setIsConnected(false);
    });

    /*
     * Cleanup
     */
    return () => {
      peer.destroy();

      peerRef.current = null;
      connectionRef.current = null;
    };
  }, []);

  /*
   * GUEST:
   * Connect to host.
   */
  function joinRoom() {
    if (!peerRef.current || !roomId.trim()) {
      return;
    }

    setRole("guest");

    const connection = connectToPeer(peerRef.current, roomId.trim());

    connectionRef.current = connection;

    /*
     * Connection established
     */
    connection.on("open", () => {
      console.log("Connected to host");

      // Update React state
      setIsConnected(true);

      connection.send({
        type: "CONNECTED",
        payload: {
          message: "Hello from guest",
        },
      });
    });

    /*
     * Incoming data
     */
    connection.on("data", handleIncomingData);

    /*
     * Connection closed
     */
    connection.on("close", () => {
      console.log("Disconnected from host");

      setIsConnected(false);

      connectionRef.current = null;
    });

    /*
     * Connection error
     */
    connection.on("error", (error) => {
      console.error("Connection error:", error);

      setIsConnected(false);
    });
  }

  /*
   * Send chat message
   */
  function sendMessage() {
    const text = message.trim();

    if (!text || !connectionRef.current || !isConnected) {
      return;
    }

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      text,
      sender: role,
      timestamp: Date.now(),
    };

    /*
     * Add message locally
     */
    setMessages((previous) => [...previous, chatMessage]);

    /*
     * Send to other peer
     */
    connectionRef.current.send({
      type: "CHAT",
      payload: chatMessage,
    });

    /*
     * Clear input
     */
    setMessage("");
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);

    setVideoSrc(url);
  }

  function handleSeedFile() {
    if (!selectedFile) {
      return;
    }

    setTorrentStatus("seeding");

    seedFile(
      selectedFile,

      // (magnet) => {
      //   console.log("Magnet URI:", magnet);

      //   setMagnetURI(magnet);
      //   setTorrentStatus("ready");
      // },
      (magnet) => {
        console.log("Magnet URI:", magnet);

        setMagnetURI(magnet);
        setTorrentStatus("ready");

        if (connectionRef.current) {
          connectionRef.current.send({
            type: "MAGNET",
            payload: {
              magnetURI: magnet,
              fileName: selectedFile.name,
              fileSize: selectedFile.size,
            },
          });
        }
      },

      (error) => {
        console.error(error);

        setTorrentStatus("error");
      },
    );
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Streamify</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* LEFT SIDE */}
        <div className="space-y-6">
          <VideoPlayer src={videoSrc} autoPlay={false} />
          {/* Peer ID */}
          <div>
            <p className="text-sm text-gray-500">Your Peer ID</p>

            <p className="break-all font-mono">{peerId || "Connecting..."}</p>
          </div>

          {/* Join room */}
          <div>
            <p className="mb-2 text-sm font-medium">Join Host</p>

            <div className="flex gap-2">
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter host Peer ID"
                className="flex-1 rounded border px-3 py-2"
              />

              <button
                onClick={joinRoom}
                disabled={isConnected}
                className="rounded bg-black px-4 py-2 text-white disabled:opacity-40"
              >
                Join
              </button>
            </div>
          </div>

          {/* Connection information */}
          <div className="rounded border p-4">
            <p className="text-sm text-gray-500">Role</p>

            <p className="font-semibold capitalize">{role}</p>

            <p className="mt-4 text-sm text-gray-500">Connection</p>

            <p
              className={
                isConnected
                  ? "font-semibold text-green-600"
                  : "font-semibold text-gray-500"
              }
            >
              {isConnected ? "Connected" : "Not connected"}
            </p>
          </div>

          <div className="space-y-3 rounded-xl border p-4">
            <h2 className="font-semibold">Host Media</h2>

            <input
              type="file"
              accept=".mp4,.webm,.mkv,video/mp4,video/webm"
              onChange={handleFileSelect}
            />

            {selectedFile && (
              <div className="text-sm text-gray-500">
                Selected: {selectedFile.name}
              </div>
            )}

            <button
              onClick={handleSeedFile}
              disabled={!selectedFile || torrentStatus === "seeding"}
              className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-40"
            >
              {torrentStatus === "seeding"
                ? "Creating torrent..."
                : "Start Streaming"}
            </button>

            {torrentStatus === "ready" && (
              <p className="text-sm text-green-600">Torrent ready</p>
            )}
          </div>
        </div>

        {/* RIGHT SIDE */}
        <ChatBox
          messages={messages}
          role={role}
          message={message}
          onMessageChange={setMessage}
          onSend={sendMessage}
        />
      </div>
    </main>
  );
}
