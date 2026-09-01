"use client";

import { useEffect, useRef, useState } from "react";

import { PeerManager } from "@/lib/peer-manager";
import { createParticipant } from "@/lib/participant";
import { RoomSession } from "@/lib/room-session";

import ChatBox from "@/components/ChatBox";

import type { ChatMessage } from "@/types/chat";

import type { Participant, RoomSessionState } from "@/types/room";
import type { PeerMessage, PeerRole } from "@/types/peer";

import { seedFile, downloadTorrent } from "@/lib/torrent";
import type { TorrentFile } from "@/lib/torrent";

import type { TorrentStatus } from "@/types/torrent";

import VideoPlayer, { VideoPlayerHandle } from "@/components/VideoPlayer";
import { DataConnection } from "peerjs";

export default function WatchParty() {
  const peerManagerRef = useRef<PeerManager | null>(null);
  const hostConnectionRef = useRef<DataConnection | null>(null);

  const roomSessionRef = useRef<RoomSession | null>(null);
  const playbackReadyRef = useRef(false);

  const pendingPlaybackStateRef = useRef<{
    currentTime: number;
    isPlaying: boolean;
    updatedAt: number;
  } | null>(null);

  const participantRef = useRef<Participant | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const videoPlayerRef = useRef<VideoPlayerHandle | null>(null);
  // const playbackActionRef = useRef<"local" | "remote" | "sync" | null>(null);

  const lastCorrectionRef = useRef<"rate" | "seek" | "none">("none");
  const [torrentFile, setTorrentFile] = useState<TorrentFile | null>(null);

  const [magnetURI, setMagnetURI] = useState("");
  const activeMagnetRef = useRef<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "reconnecting" | "error"
  >("connecting");

  const [torrentStatus, setTorrentStatus] = useState<TorrentStatus>("idle");

  const [role, setRole] = useState<PeerRole>("host");

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [message, setMessage] = useState("");

  const [peerId, setPeerId] = useState("");
  const [participantId, setParticipantId] = useState<string | null>(null);

  const [roomId, setRoomId] = useState("");

  //testing
  const [syncEnabled, setSyncEnabled] = useState(true);
  function getTimestamp(): number {
    return Date.now();
  }
  /*
   * -----------------------------------------
   * GUEST TORRENT
   * -----------------------------------------
   */
  async function handleGuestTorrent(magnetURI: string) {
    console.log("Starting torrent download...");
    if (activeMagnetRef.current === magnetURI) {
      console.log("Torrent already being loaded:", magnetURI);

      return;
    }

    activeMagnetRef.current = magnetURI;

    setTorrentStatus("downloading");

    setVideoSrc(null);
    setTorrentFile(null);
    playbackReadyRef.current = false;
    pendingPlaybackStateRef.current = null;

    await downloadTorrent(
      magnetURI,

      (file) => {
        console.log("Torrent file ready:", file.name);

        console.log("File size:", file.length);

        /*
         * Give the actual WebTorrent
         * File to VideoPlayer.
         */
        setTorrentFile(file);

        setTorrentStatus("ready");
      },

      (progress) => {
        console.log("Download progress:", Math.round(progress * 100), "%");
      },

      (error) => {
        console.error("Torrent error:", error);

        setTorrentStatus("error");
      },
    );
  }
  /*
   * -----------------------------------------
   * ROOM SESSION
   * -----------------------------------------
   */

  function applySessionState(session: RoomSessionState) {
    console.log("Applying room session state:", session);

    /*
     * Restore participants
     */
    console.log("Participants:", session.participants);

    /*
     * Restore chat history
     */
    setMessages(session.chatHistory);

    /*
     * Restore torrent
     */
    if (session.torrent) {
      console.log("Room already has torrent:", session.torrent);

      setMagnetURI(session.torrent.magnetURI);

      /*
       * Only guests need to download.
       */
      if (participantRef.current?.role === "guest") {
        handleGuestTorrent(session.torrent.magnetURI);
      }
    }

    /*
     * Preserve the authoritative playback snapshot received
     * from the Host.
     *
     * This is the initial playback state for a late joiner.
     * The periodic SYNC heartbeat will correct any small
     * difference after playback begins.
     */
    pendingPlaybackStateRef.current = {
      currentTime: session.playback.currentTime,
      isPlaying: session.playback.isPlaying,
      updatedAt: Date.now(),
    };

    console.log(
      "Initial playback state stored:",
      pendingPlaybackStateRef.current,
    );
  }

  /*
   * -----------------------------------------
   * INCOMING PEER DATA
   * -----------------------------------------
   */

  async function handleIncomingData(data: unknown, connection: DataConnection) {
    console.log("Received:", data);

    const incoming = data as PeerMessage;

    switch (incoming.type) {
      case "CONNECTED": {
        console.log("Peer connected:", incoming.payload.message);

        if (participantRef.current?.role === "guest") {
          connection.send({
            type: "JOIN_ROOM",
            payload: {
              participant: participantRef.current,
            },
          });

          console.log("JOIN_ROOM sent to host:", connection.peer);
        }

        break;
      }

      case "JOIN_ROOM": {
        const participant = incoming.payload.participant;

        console.log("Guest wants to join:", participant);

        const session = roomSessionRef.current;

        const manager = peerManagerRef.current;

        if (!session || !manager) {
          console.warn("Room session or PeerManager unavailable.");

          break;
        }

        /*
         * Add Guest to the room.
         */
        session.addParticipant(participant);

        /*
         * IMPORTANT:
         *
         * RoomSession may contain an older playback snapshot.
         *
         * For a late joiner we want the ACTUAL current
         * position of the Host's video.
         */
        const video = videoPlayerRef.current;

        if (video) {
          const currentTime = video.getCurrentTime();

          if (currentTime !== null) {
            const isPlaying = video.isPlaying();

            session.updatePlayback(isPlaying, currentTime);

            console.log("Late join: refreshed playback state:", {
              currentTime,
              isPlaying,
            });
          }
        }

        /*
         * Now build the session state.
         *
         * This state contains the freshly captured
         * playback position.
         */
        const sessionState = session.getState();

        console.log("Room state before sending:", sessionState);

        connection.send({
          type: "SESSION_STATE",
          payload: sessionState,
        });

        console.log("SESSION_STATE sent to:", connection.peer);

        break;
      }

      case "SESSION_STATE": {
        console.log("Received SESSION_STATE:", incoming.payload);

        applySessionState(incoming.payload);

        break;
      }

      case "MAGNET": {
        const magnet = incoming.payload;

        console.log("Received magnet:", magnet.magnetURI);

        /*
         * Ignore MAGNET if this torrent
         * is already being initialized
         * from SESSION_STATE.
         */
        if (activeMagnetRef.current === magnet.magnetURI) {
          console.log("Ignoring duplicate MAGNET:", magnet.magnetURI);

          break;
        }

        handleGuestTorrent(magnet.magnetURI);

        break;
      }

      case "CHAT": {
        const chatMessage = incoming.payload;

        setMessages((previous) => {
          const exists = previous.some(
            (message) => message.id === chatMessage.id,
          );

          if (exists) {
            return previous;
          }

          return [...previous, chatMessage];
        });

        roomSessionRef.current?.addChatMessage(chatMessage);

        if (participantRef.current?.role === "host") {
          const manager = peerManagerRef.current;

          if (manager) {
            for (const guestConnection of manager.getConnections()) {
              if (guestConnection.peer !== connection.peer) {
                if (guestConnection.open) {
                  guestConnection.send({
                    type: "CHAT",
                    payload: chatMessage,
                  });
                }
              }
            }
          }
        }

        break;
      }

      case "PLAY": {
        const { currentTime } = incoming.payload;

        console.log("Remote PLAY received:", currentTime);

        try {
          await videoPlayerRef.current?.playAt(currentTime);
        } catch (error) {
          console.error("Remote PLAY failed:", error);
        }

        break;
      }
      case "PAUSE": {
        const { currentTime } = incoming.payload;

        console.log("Remote PAUSE received:", currentTime);

        try {
          await videoPlayerRef.current?.pauseAt(currentTime);
        } catch (error) {
          console.error("Remote PAUSE failed:", error);
        }

        break;
      }

      case "SEEK": {
        const { currentTime } = incoming.payload;

        console.log("Remote SEEK received:", currentTime);

        try {
          await videoPlayerRef.current?.seekTo(currentTime);
        } catch (error) {
          console.error("Remote SEEK failed:", error);
        }

        break;
      }

      case "SYNC": {
        /*
         * SYNC is authoritative from the host.
         *
         * Guests use it to:
         * 1. Estimate the host's current playback position.
         * 2. Compare it with their own position.
         * 3. Correct playback when necessary.
         *
         * The host does not process its own SYNC messages.
         */
        if (participantRef.current?.role === "host") {
          break;
        }
        console.log("SYNC HANDLER ENTERED:", {
          participantRole: participantRef.current?.role,
          hostTime: incoming.payload.currentTime,
          hostTimestamp: incoming.payload.timestamp,
          hostIsPlaying: incoming.payload.isPlaying,
        });

        // --------------------------------------------------
        // 1. Read host playback state
        // --------------------------------------------------

        const {
          currentTime: hostTime,
          timestamp: hostTimestamp,
          isPlaying: hostIsPlaying,
        } = incoming.payload;

        const now = Date.now();

        const elapsedSeconds = hostIsPlaying
          ? Math.max(0, now - hostTimestamp) / 1000
          : 0;

        const predictedHostTime = hostTime + elapsedSeconds;

        /*
         * Video is not ready yet.
         *
         * Save the latest authoritative host state.
         * Do not attempt drift correction yet.
         */
        if (!playbackReadyRef.current) {
          pendingPlaybackStateRef.current = {
            currentTime: hostTime,
            isPlaying: hostIsPlaying,
            updatedAt: hostTimestamp,
          };

          console.log("SYNC: video not ready. Saving pending playback state.", {
            currentTime: hostTime,
            isPlaying: hostIsPlaying,
            updatedAt: hostTimestamp,
          });

          break;
        }
        // --------------------------------------------------
        // 2. Read guest playback state
        // --------------------------------------------------

        const playbackInfo = videoPlayerRef.current?.getPlaybackInfo();

        if (!playbackInfo) {
          break;
        }

        const {
          currentTime: guestTime,
          bufferedUntil,
          bufferAhead,
          isPlaying: guestIsPlaying,
          isBuffering,
        } = playbackInfo;

        // --------------------------------------------------
        // 3. Predict current host position
        // --------------------------------------------------

        // const now = Date.now();

        // /*
        //  * If the host is playing, the host has continued
        //  * advancing since the SYNC packet was created.
        //  *
        //  * Example:
        //  *
        //  * hostTime      = 100.0
        //  * packet age    = 0.2 sec
        //  *
        //  * predictedHostTime = 100.2
        //  *
        //  * If the host is paused, time must NOT advance.
        //  */
        // const elapsedSeconds = hostIsPlaying
        //   ? Math.max(0, now - hostTimestamp) / 1000
        //   : 0;

        // const predictedHostTime = hostTime + elapsedSeconds;

        // const playbackInfo = videoPlayerRef.current?.getPlaybackInfo();

        // if (!playbackInfo) {
        //   break;
        // }

        // const {
        //   currentTime: guestTime,
        //   bufferedUntil,
        //   bufferAhead,
        //   isPlaying: guestIsPlaying,
        //   isBuffering,
        // } = playbackInfo;

        // --------------------------------------------------
        // 4. Calculate drift
        // --------------------------------------------------

        const drift = predictedHostTime - guestTime;

        const absoluteDrift = Math.abs(drift);

        console.log("SYNC playback info:", {
          currentTime: guestTime,
          bufferedUntil,
          bufferAhead,
          isPlaying: guestIsPlaying,
          isBuffering,
        });

        console.log("SYNC calculation:", {
          hostTime,
          hostTimestamp,
          guestTime,
          elapsedSeconds,
          predictedHostTime,
          drift,
          absoluteDrift,
          hostIsPlaying,
          guestIsPlaying,
        });

        // ==================================================
        // HOST PAUSED
        // ==================================================

        if (!hostIsPlaying) {
          /*
           * Host is paused.
           *
           * No playback-rate correction should happen while
           * paused.
           */
          videoPlayerRef.current?.setPlaybackRate(1);

          /*
           * If the guest is still playing, stop it and place
           * it at the authoritative host position.
           *
           * pauseAt() is an imperative VideoPlayer command,
           * so its resulting DOM events are suppressed there.
           */
          if (guestIsPlaying) {
            try {
              await videoPlayerRef.current?.pauseAt(hostTime);
            } catch (error) {
              console.error("SYNC pause failed:", error);
            }
          } else {
            /*
             * Guest is already paused.
             *
             * If the positions differ significantly, correct
             * the position while remaining paused.
             */
            if (absoluteDrift >= 0.15) {
              /*
               * Only seek if the target is currently
               * available.
               */
              const targetIsBuffered =
                bufferedUntil !== null && hostTime <= bufferedUntil;

              if (targetIsBuffered) {
                try {
                  await videoPlayerRef.current?.seekTo(hostTime);
                } catch (error) {
                  console.error("SYNC paused seek failed:", error);
                }
              }
            }
          }

          lastCorrectionRef.current = "none";

          break;
        }

        // ==================================================
        // HOST PLAYING
        // ==================================================

        /*
         * At this point:
         *
         * hostIsPlaying === true
         */

        // --------------------------------------------------
        // Guest is paused
        // --------------------------------------------------

        if (!guestIsPlaying) {
          /*
           * If the guest is far behind, move directly to
           * the predicted host position before playing.
           */
          if (absoluteDrift >= 1.5) {
            /*
             * Never seek while the media pipeline is
             * buffering.
             */
            if (isBuffering) {
              videoPlayerRef.current?.setPlaybackRate(1);

              lastCorrectionRef.current = "none";

              console.log("SYNC: guest paused and media is buffering.", {
                guestTime,
                predictedHostTime,
                drift,
                bufferAhead,
                bufferedUntil,
              });

              break;
            }

            /*
             * Don't seek beyond the media currently available.
             */
            const targetIsBuffered =
              bufferedUntil !== null && predictedHostTime <= bufferedUntil;

            if (!targetIsBuffered) {
              videoPlayerRef.current?.setPlaybackRate(1);

              lastCorrectionRef.current = "none";

              console.log("SYNC: guest paused but target is not buffered.", {
                guestTime,
                predictedHostTime,
                drift,
                bufferedUntil,
                bufferAhead,
              });

              break;
            }

            /*
             * Target is available.
             *
             * First seek, then play.
             */
            try {
              videoPlayerRef.current?.setPlaybackRate(1);

              await videoPlayerRef.current?.seekTo(predictedHostTime);

              await videoPlayerRef.current?.playAt(predictedHostTime);

              lastCorrectionRef.current = "seek";
            } catch (error) {
              console.error("SYNC paused-guest recovery failed:", error);
            }

            break;
          }

          /*
           * Guest is paused but already close enough to the
           * host position.
           *
           * Resume from the guest's current position.
           *
           * This avoids an unnecessary seek.
           */
          try {
            await videoPlayerRef.current?.playAt(guestTime);

            lastCorrectionRef.current = "none";
          } catch (error) {
            console.error("SYNC guest resume failed:", error);
          }

          break;
        }

        // ==================================================
        // BOTH HOST AND GUEST ARE PLAYING
        // ==================================================

        // --------------------------------------------------
        // Small drift
        // --------------------------------------------------

        if (absoluteDrift < 0.15) {
          /*
           * Less than 150 ms.
           *
           * This is close enough. Don't touch playback.
           */
          videoPlayerRef.current?.setPlaybackRate(1);

          lastCorrectionRef.current = "none";

          break;
        }

        // --------------------------------------------------
        // Moderate drift
        // --------------------------------------------------

        if (absoluteDrift < 1.5) {
          /*
           * 150 ms → 1.5 sec
           *
           * Correct gradually instead of visibly jumping.
           */
          const correctionRate = drift > 0 ? 1.03 : 0.97;

          videoPlayerRef.current?.setPlaybackRate(correctionRate);

          lastCorrectionRef.current = "rate";

          console.log("SYNC: applying playback-rate correction.", {
            drift,
            correctionRate,
          });

          break;
        }

        // --------------------------------------------------
        // Large drift
        // --------------------------------------------------

        /*
         * We only reach this section when:
         *
         * absoluteDrift >= 1.5
         *
         * The guest is already playing.
         */

        // --------------------------------------------------
        // Buffer protection
        // --------------------------------------------------

        if (isBuffering) {
          /*
           * Don't make a seek while the media pipeline is
           * already struggling to provide data.
           */
          videoPlayerRef.current?.setPlaybackRate(1);

          lastCorrectionRef.current = "none";

          console.log("SYNC: large drift but video is buffering.", {
            guestTime,
            predictedHostTime,
            drift,
            bufferAhead,
            bufferedUntil,
          });

          break;
        }

        // --------------------------------------------------
        // Target buffer protection
        // --------------------------------------------------

        const targetIsBuffered =
          bufferedUntil !== null && predictedHostTime <= bufferedUntil;

        if (!targetIsBuffered) {
          /*
           * The guest cannot seek to a position that the
           * media pipeline hasn't made available yet.
           *
           * Let WebTorrent continue filling the buffer.
           */
          videoPlayerRef.current?.setPlaybackRate(1);

          lastCorrectionRef.current = "none";

          console.log("SYNC: target not buffered yet.", {
            guestTime,
            predictedHostTime,
            drift,
            bufferedUntil,
            bufferAhead,
          });

          break;
        }

        // --------------------------------------------------
        // Hard correction
        // --------------------------------------------------

        /*
         * The target is available and the drift is large.
         *
         * Seek directly to the predicted host position.
         *
         * Because seekTo() is an imperative VideoPlayer
         * operation, the resulting seeked event will NOT
         * be treated as a local user SEEK.
         */
        try {
          videoPlayerRef.current?.setPlaybackRate(1);

          await videoPlayerRef.current?.seekTo(predictedHostTime);

          lastCorrectionRef.current = "seek";

          /*
           * Host is playing and guest was already playing.
           *
           * seekTo() does not pause the video, so playback
           * continues after the seek.
           *
           * We intentionally do NOT call playAt() here.
           */
        } catch (error) {
          console.error("SYNC hard correction failed:", error);
        }

        break;
      }
    }
  }

  /*
   * -----------------------------------------
   * INITIALIZE PEER
   * -----------------------------------------
   */

  useEffect(() => {
    const manager = new PeerManager({
      onPeerOpen: (id) => {
        console.log("My Peer ID:", id);

        setPeerId(id);

        setConnectionStatus("disconnected");

        /*
         * Create our Participant identity
         * once PeerJS gives us our Peer ID.
         */
        const currentRole = participantRef.current?.role ?? role;

        const participant = createParticipant(id, currentRole);

        participantRef.current = participant;
        setParticipantId(participant.participantId);

        /*
         * Create the room session only
         * when we are the Host.
         */
        if (currentRole === "host" && !roomSessionRef.current) {
          roomSessionRef.current = new RoomSession(id, participant);

          setRoomId(id);

          console.log(
            "Room session created:",
            roomSessionRef.current.getState(),
          );
        }
      },

      onConnection: (connection) => {
        console.log("Incoming connection:", connection.peer);

        /*
         * Incoming connections mean
         * this browser is acting as Host.
         */
        setRole("host");
      },

      onConnectionOpen: (connection) => {
        console.log("Connection established:", connection.peer);

        setConnectionStatus("connected");

        if (participantRef.current?.role === "host") {
          connection.send({
            type: "CONNECTED",
            payload: {
              message: "Hello from host",
            },
          });
        }

        if (participantRef.current?.role === "guest") {
          hostConnectionRef.current = connection;
        }
      },

      onData: (data, connection) => {
        handleIncomingData(data, connection);
      },

      onConnectionClose: (remotePeerId) => {
        console.log("Peer disconnected:", remotePeerId);

        setConnectionStatus(
          manager.getConnectionCount() > 0 ? "connected" : "disconnected",
        );
      },

      onConnectionError: (remotePeerId, error) => {
        console.error(`Connection error with ${remotePeerId}:`, error);

        setConnectionStatus("error");
      },

      onPeerError: (error) => {
        console.error("PeerJS error:", error);

        setConnectionStatus("error");
      },

      onPeerReconnecting: () => {
        console.log("PeerJS reconnecting...");

        setConnectionStatus("reconnecting");
      },

      onPeerDisconnected: () => {
        console.warn("PeerJS signaling disconnected.");

        setConnectionStatus("disconnected");
      },
    });

    peerManagerRef.current = manager;

    manager.createPeer();

    return () => {
      manager.destroy();

      peerManagerRef.current = null;

      roomSessionRef.current = null;

      participantRef.current = null;
      setParticipantId(null);
    };
  }, []);

  /*
   * -----------------------------------------
   * GUEST JOIN
   * -----------------------------------------
   */

  function joinRoom() {
    const manager = peerManagerRef.current;

    if (!manager) {
      console.error("Peer manager is not initialized.");

      return;
    }

    const hostId = roomId.trim();

    if (!hostId) {
      return;
    }

    try {
      /*
       * This browser becomes a Guest.
       */
      setRole("guest");

      setConnectionStatus("connecting");

      /*
       * Create/update our Guest identity.
       */
      if (peerId) {
        const participant = createParticipant(peerId, "guest");

        participantRef.current = participant;
        setParticipantId(participant.participantId);
      }

      /*
       * The Host Peer ID is still the
       * previously established Host ID.
       *
       * We are NOT discovering a new
       * Host Peer ID here.
       */
      const connection = manager.connect(hostId);

      console.log("Connecting to host:", connection.peer);
    } catch (error) {
      console.error("Failed to connect to host:", error);

      setConnectionStatus("error");
    }
  }

  /*
   * -----------------------------------------
   * CHAT
   * -----------------------------------------
   */

  function sendMessage() {
    const text = message.trim();

    const manager = peerManagerRef.current;

    const participant = participantRef.current;

    if (!text || !manager || !participant) {
      return;
    }

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),

      text,

      sender: {
        participantId: participant.participantId,

        displayName: participant.displayName,

        peerId: participant.peerId,
      },

      timestamp: Date.now(),
    };

    /*
     * Add locally.
     */
    setMessages((previous) => [...previous, chatMessage]);

    /*
     * Store in room state.
     */
    roomSessionRef.current?.addChatMessage(chatMessage);

    /*
     * Host broadcasts to everyone.
     *
     * Guest sends to Host.
     */
    if (participant.role === "host") {
      manager.broadcast({
        type: "CHAT",
        payload: chatMessage,
      });
    } else {
      const hostConnection = hostConnectionRef.current;

      if (!hostConnection) {
        console.warn("No Host connection available.");

        return;
      }

      if (!hostConnection.open) {
        console.warn("Host connection is not open.");

        return;
      }

      hostConnection.send({
        type: "CHAT",
        payload: chatMessage,
      });
    }

    setMessage("");
  }

  /*
   * -----------------------------------------
   * FILE SELECTION
   * -----------------------------------------
   */

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSelectedFile(file);

    const url = URL.createObjectURL(file);

    setVideoSrc(url);
  }

  /*
   * -----------------------------------------
   * HOST SEED
   * -----------------------------------------
   */

  function handleSeedFile() {
    if (!selectedFile) {
      return;
    }

    setTorrentStatus("seeding");

    seedFile(
      selectedFile,

      (magnet) => {
        console.log("Magnet URI:", magnet);

        setMagnetURI(magnet);

        setTorrentStatus("ready");

        /*
         * Store torrent in RoomSession.
         */
        const session = roomSessionRef.current;

        if (session) {
          session.setTorrent({
            torrentId: magnet,
            magnetURI: magnet,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
          });
        }

        const manager = peerManagerRef.current;

        if (!manager) {
          return;
        }

        /*
         * Keep the existing MAGNET
         * broadcast for compatibility.
         *
         * SESSION_STATE will eventually
         * replace this for late joiners.
         */
        manager.broadcast({
          type: "MAGNET",

          payload: {
            magnetURI: magnet,

            fileName: selectedFile.name,

            fileSize: selectedFile.size,
          },
        });
      },

      (error) => {
        console.error(error);

        setTorrentStatus("error");
      },
    );
  }

  /*
   * -----------------------------------------
   * PLAYBACK SYNCHRONIZATION
   * -----------------------------------------
   */

  //   function canControlPlayback(): boolean {
  //   return (
  //     participantRef.current?.permissions
  //       .canControlPlayback ?? false
  //   );
  // }
  const canControlPlayback = role === "host";
  useEffect(() => {
    if (role !== "host" || !syncEnabled) {
      return;
    }

    const interval = window.setInterval(() => {
      const video = videoPlayerRef.current;

      if (!video) {
        return;
      }

      const currentTime = video.getCurrentTime();

      if (currentTime === null) {
        return;
      }

      const isPlaying = video.isPlaying();
      const timestamp = Date.now();

      peerManagerRef.current?.broadcast({
        type: "SYNC",
        payload: {
          currentTime,
          timestamp,
          isPlaying,
        },
      });

      console.log("Broadcast SYNC:", {
        currentTime,
        timestamp,
        isPlaying,
      });
    }, 5000);

    return () => {
      window.clearInterval(interval);
    };
  }, [role, syncEnabled]);

  function handleLocalPlay(currentTime: number) {
    if (!canControlPlayback) {
      console.log("PLAY ignored: playback control not authorized.");

      return;
    }

    const manager = peerManagerRef.current;
    const session = roomSessionRef.current;

    if (!manager || !session) {
      return;
    }

    const timestamp = getTimestamp();

    session.updatePlayback(true, currentTime);

    manager.broadcast({
      type: "PLAY",
      payload: {
        currentTime,
        timestamp,
      },
    });

    console.log("Broadcast PLAY:", {
      currentTime,
      timestamp,
    });
  }
  function handleLocalPause(currentTime: number) {
    if (!canControlPlayback) {
      console.log("PAUSE ignored: playback control not authorized.");

      return;
    }

    const manager = peerManagerRef.current;
    const session = roomSessionRef.current;

    if (!manager || !session) {
      return;
    }

    const timestamp = getTimestamp();

    session.updatePlayback(false, currentTime);

    manager.broadcast({
      type: "PAUSE",
      payload: {
        currentTime,
        timestamp,
      },
    });

    console.log("Broadcast PAUSE:", {
      currentTime,
      timestamp,
    });
  }

  function handleLocalSeek(currentTime: number) {
    if (!canControlPlayback) {
      console.log("SEEK ignored: playback control not authorized.");

      return;
    }

    const manager = peerManagerRef.current;
    const session = roomSessionRef.current;

    if (!manager || !session) {
      return;
    }

    const timestamp = getTimestamp();

    /*
     * Preserve the current play/pause state.
     */
    const playback = session.getPlayback();

    session.updatePlayback(playback.isPlaying, currentTime);

    manager.broadcast({
      type: "SEEK",
      payload: {
        currentTime,
        timestamp,
      },
    });

    console.log("Broadcast SEEK:", {
      currentTime,
      timestamp,
    });
  }

  const applyPendingPlaybackState = async () => {
    if (role === "host") {
      return;
    }

    if (!playbackReadyRef.current) {
      return;
    }

    const pending = pendingPlaybackStateRef.current;

    if (!pending) {
      return;
    }

    const elapsedSeconds = pending.isPlaying
      ? Math.max(0, Date.now() - pending.updatedAt) / 1000
      : 0;

    const targetTime = pending.currentTime + elapsedSeconds;
    pendingPlaybackStateRef.current = null;

    const { currentTime, isPlaying } = pending;

    console.log("LATE JOIN: applying pending playback state:", {
      currentTime,
      isPlaying,
    });

    try {
      videoPlayerRef.current?.setPlaybackRate(1);

      if (isPlaying) {
        /*
         * Guest joined while host was playing.
         *
         * Jump directly to the host's latest known position
         * and start playback.
         */
        await videoPlayerRef.current?.playAt(targetTime);

        console.log("LATE JOIN: playback started.", currentTime);
      } else {
        /*
         * Host is paused.
         *
         * Guest should remain paused at the same position.
         */
        //await videoPlayerRef.current?.seekTo(currentTime);
        await videoPlayerRef.current?.pauseAt(targetTime);

        console.log(
          "LATE JOIN: playback positioned while paused.",
          currentTime,
        );
      }
    } catch (error) {
      console.error("LATE JOIN: failed to apply playback state:", error);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold">Streamify</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        {/* LEFT SIDE */}

        <div className="space-y-6">
          <VideoPlayer
            ref={videoPlayerRef}
            src={videoSrc}
            torrentFile={torrentFile}
            canControlPlayback={canControlPlayback}
            autoPlay={false}
            onReady={() => {
              console.log("WatchParty: video playback ready.");

              playbackReadyRef.current = true;

              void applyPendingPlaybackState();
            }}
            onPlay={handleLocalPlay}
            onPause={handleLocalPause}
            onSeek={handleLocalSeek}
          />

          {/* Peer ID */}

          <div>
            <p className="text-sm text-gray-500">Your Peer ID</p>

            <p className="break-all font-mono">{peerId || "Generating..."}</p>
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
                disabled={
                  connectionStatus === "connected" ||
                  connectionStatus === "connecting"
                }
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
              className={`font-semibold capitalize ${
                connectionStatus === "connected"
                  ? "text-green-600"
                  : connectionStatus === "error"
                    ? "text-red-600"
                    : "text-gray-500"
              }`}
            >
              {connectionStatus}
            </p>
            {/* Temporary performance test */}
            {role === "host" && (
              <button
                onClick={() => setSyncEnabled((enabled) => !enabled)}
                className="mt-4 rounded-lg border px-4 py-2 text-sm"
              >
                Sync Heartbeat: {syncEnabled ? "ON" : "OFF"}
              </button>
            )}
          </div>

          {/* Host Media */}

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
          participantId={participantId}
          message={message}
          onMessageChange={setMessage}
          onSend={sendMessage}
        />
      </div>
    </main>
  );
}
