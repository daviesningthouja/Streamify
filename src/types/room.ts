import type { ChatMessage } from "./chat";

export type RoomRole = "host" | "guest";

export interface Participant {
  participantId: string;
  displayName: string;
  peerId: string;
  role: RoomRole;
}

export interface TorrentState {
  torrentId: string;
  magnetURI: string;
  fileName: string;
  fileSize: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  updatedAt: number;
}

export interface RoomSessionState {
  roomId: string;

  host: Participant;

  participants: Participant[];

  torrent: TorrentState | null;

  chatHistory: ChatMessage[];

  playback: PlaybackState;
}