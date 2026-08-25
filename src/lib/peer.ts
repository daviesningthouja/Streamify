import Peer, { DataConnection } from "peerjs";

export function createPeer(peerId?: string): Peer {
  if (typeof window === "undefined") {
    throw new Error("PeerJS can only run in the browser.");
  }

  // return new Peer(peerId);
  return peerId ? new Peer(peerId) : new Peer();
}

export function connectToPeer(
  peer: Peer,
  hostId: string
): DataConnection {
  return peer.connect(hostId, {
    reliable: true,
  });
}