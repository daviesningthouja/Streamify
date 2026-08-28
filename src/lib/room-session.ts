"use client";

import type {
  ChatMessage,
} from "@/types/chat";

import type {
  Participant,
  PlaybackState,
  RoomSessionState as RoomSessionState,
  TorrentState,
} from "@/types/room";

export class RoomSession {
  private state: RoomSessionState;

  constructor(
    roomId: string,
    host: Participant,
  ) {
    this.state = {
      roomId,

      host,

      participants: [
        host,
      ],

      torrent: null,

      chatHistory: [],

      playback: {
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
      },
    };
  }

  getState(): RoomSessionState {
    return {
      ...this.state,

      participants: [
        ...this.state.participants,
      ],

      chatHistory: [
        ...this.state.chatHistory,
      ],

      torrent: this.state.torrent
        ? {
            ...this.state.torrent,
          }
        : null,

      playback: {
        ...this.state.playback,
      },
    };
  }

  getRoomId(): string {
    return this.state.roomId;
  }

  getHost(): Participant {
    return {
      ...this.state.host,
    };
  }

  getParticipants(): Participant[] {
    return this.state.participants.map(
      (participant) => ({
        ...participant,
      }),
    );
  }

  addParticipant(
    participant: Participant,
  ): boolean {
    const exists =
      this.state.participants.some(
        (existing) =>
          existing.participantId ===
          participant.participantId,
      );

    if (exists) {
      return false;
    }

    this.state.participants.push(
      participant,
    );

    return true;
  }

  removeParticipant(
    participantId: string,
  ): boolean {
    const index =
      this.state.participants.findIndex(
        (participant) =>
          participant.participantId ===
          participantId,
      );

    if (index === -1) {
      return false;
    }

    const participant =
      this.state.participants[index];

    // Never remove the Host
    if (
      participant.role === "host"
    ) {
      return false;
    }

    this.state.participants.splice(
      index,
      1,
    );

    return true;
  }

  getTorrent(): TorrentState | null {
    return this.state.torrent
      ? {
          ...this.state.torrent,
        }
      : null;
  }

  setTorrent(
    torrent: TorrentState,
  ): void {
    this.state.torrent = {
      ...torrent,
    };
  }

  clearTorrent(): void {
    this.state.torrent = null;
  }

  getChatHistory(): ChatMessage[] {
    return this.state.chatHistory.map(
      (message) => ({
        ...message,
        sender: message.sender,
        //  sender: {
        //   ...message.sender,
        // },
      }),
    );
  }

  addChatMessage(
    message: ChatMessage,
  ): void {
    const exists =
      this.state.chatHistory.some(
        (existing) =>
          existing.id === message.id,
      );

    if (exists) {
      return;
    }

    this.state.chatHistory.push(
      message,
    );
  }

  getPlayback(): PlaybackState {
    return {
      ...this.state.playback,
    };
  }

  setPlayback(
    playback: PlaybackState,
  ): void {
    this.state.playback = {
      ...playback,
    };
  }

  updatePlayback(
    isPlaying: boolean,
    currentTime: number,
  ): void {
    this.state.playback = {
      isPlaying,
      currentTime,
      updatedAt: Date.now(),
    };
  }
}