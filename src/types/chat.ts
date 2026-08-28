//import type { PeerRole } from "./peer";

export interface ChatSender {
  participantId: string;
  displayName: string;
  peerId: string;
}
export interface ChatMessage {
  id: string;
  text: string;
  sender: ChatSender;
  timestamp: number;
}