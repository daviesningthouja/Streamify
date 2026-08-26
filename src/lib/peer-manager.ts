"use client";

import Peer, { DataConnection } from "peerjs";
import type { PeerMessage } from "@/types/peer";

export type PeerManagerCallbacks = {
  onPeerOpen?: (peerId: string) => void;
  onConnection?: (connection: DataConnection) => void;
  onConnectionOpen?: (connection: DataConnection) => void;
  onData?: (data: PeerMessage, connection: DataConnection) => void;
  onConnectionClose?: (peerId: string) => void;
  onConnectionError?: (peerId: string, error: Error) => void;
  onPeerError?: (error: Error) => void;
  onPeerDisconnected?: () => void;
  onPeerReconnecting?: () => void;
  onPeerReconnected?: (peerId: string) => void;
};

export class PeerManager {
  private peer: Peer | null = null;

  private connections = new Map<string, DataConnection>();

  private callbacks: PeerManagerCallbacks;

  constructor(callbacks: PeerManagerCallbacks = {}) {
    this.callbacks = callbacks;
  }

  createPeer(peerId?: string) {
    if (typeof window === "undefined") {
      throw new Error("PeerManager can only run in the browser.");
    }

    if (this.peer) {
      return this.peer;
    }

    this.peer = peerId ? new Peer(peerId) : new Peer();

    this.registerPeerEvents();

    return this.peer;
  }

  private registerPeerEvents() {
    if (!this.peer) {
      return;
    }

    this.peer.on("open", (id) => {
      console.log("Peer opened:", id);

      this.callbacks.onPeerOpen?.(id);
    });

    this.peer.on("connection", (connection) => {
      console.log("Incoming connection:", connection.peer);

      this.registerConnection(connection);

      this.callbacks.onConnection?.(connection);
    });

    // this.peer.on("disconnected", () => {
    //   console.warn("PeerJS signaling server disconnected.");

    //   this.callbacks.onPeerDisconnected?.();
    //   //this.callbacks.onPeerReconnecting?.();
    // });

    this.peer.on("disconnected", () => {
      console.warn("PeerJS signaling server disconnected.");

      this.callbacks.onPeerDisconnected?.();

      if (this.peer && !this.peer.destroyed && this.peer.disconnected) {
        console.log("Attempting PeerJS reconnect...");

        this.callbacks.onPeerReconnecting?.();

        this.peer.reconnect();
      }
    });

    this.peer.on("error", (error) => {
      console.error("PeerJS error:", error);

      this.callbacks.onPeerError?.(error);
    });

    this.peer.on("close", () => {
      console.log("PeerJS peer closed.");

      this.connections.clear();
      this.peer = null;
    });
  }

  private registerConnection(connection: DataConnection) {
    this.connections.set(connection.peer, connection);

    // connection.on("open", () => {
    //   console.log(
    //     "Data connection opened:",
    //     connection.peer
    //   );
    // });

    connection.on("open", () => {
      console.log("Data connection opened:", connection.peer);

      this.callbacks.onConnectionOpen?.(connection);
    });

    connection.on("data", (data) => {
      this.callbacks.onData?.(data as PeerMessage, connection);
    });

    connection.on("close", () => {
      console.log("Data connection closed:", connection.peer);

      this.connections.delete(connection.peer);

      this.callbacks.onConnectionClose?.(connection.peer);
    });

    connection.on("error", (error) => {
      console.error("Data connection error:", error);

      this.callbacks.onConnectionError?.(connection.peer, error);
    });
  }

  connect(hostId: string) {
    if (!this.peer) {
      throw new Error("Peer has not been created.");
    }

    if (this.peer.destroyed) {
      throw new Error("Peer has been destroyed.");
    }

    if (this.peer.disconnected) {
      console.log("Peer is disconnected. Reconnecting...");

    //   this.peer.reconnect();

    //   throw new Error(
    //     "Peer is reconnecting. Please try again when the Peer is connected.",
    //   );
    }

    const connection = this.peer.connect(hostId, {
      reliable: true,
    });

    this.registerConnection(connection);

    return connection;
  }

  reconnect() {
    if (!this.peer) {
      return false;
    }

    if (this.peer.destroyed) {
      console.warn("Cannot reconnect a destroyed Peer.");

      return false;
    }

    if (!this.peer.disconnected) {
      return true;
    }

    console.log("Attempting PeerJS reconnect...");

    this.callbacks.onPeerReconnecting?.();

    this.peer.reconnect();

    return true;
  }

  broadcast(message: PeerMessage) {
    for (const connection of this.connections.values()) {
      if (connection.open) {
        connection.send(message);
      }
    }
  }

  //***//single messaging as guest to host
  sendTo(peerId: string, message: PeerMessage) {
    const connection = this.connections.get(peerId);

    if (!connection) {
      console.warn(`No connection found for peer ${peerId}`);

      return false;
    }

    if (!connection.open) {
      console.warn(`Connection to ${peerId} is not open.`);

      return false;
    }

    connection.send(message);

    return true;
  }

  //   sendTo( message: PeerMessage) {

  //     for (const connection of this.connections.values()) {
  //       if (connection.open) {
  //         connection.send(message);
  //     }
  //     if (!connection.open) {
  //       console.warn(`Connection fail`);

  //       return false;
  //     }
  //     }
  //   }

  getConnection(peerId: string) {
    return this.connections.get(peerId);
  }

  getConnections() {
    return Array.from(this.connections.values());
  }

  getConnectionCount() {
    return this.connections.size;
  }

  isPeerConnected() {
    return Boolean(
      this.peer && !this.peer.destroyed && !this.peer.disconnected,
    );
  }

  destroy() {
    for (const connection of this.connections.values()) {
      connection.close();
    }

    this.connections.clear();

    this.peer?.destroy();

    this.peer = null;
  }

  isDestroyed() {
    return Boolean(this.peer?.destroyed);
  }

  isDisconnected() {
    return Boolean(this.peer?.disconnected);
  }

  getPeerId() {
    return this.peer?.id ?? null;
  }
}
