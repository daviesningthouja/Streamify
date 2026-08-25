import type { PeerRole } from "./peer";

export interface ChatMessage {
  id: string;
  text: string;
  sender: PeerRole;
  timestamp: number;
}