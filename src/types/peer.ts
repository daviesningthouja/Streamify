import type {
  ChatMessage,
} from "./chat";

import type {
  Participant,
  RoomSessionState,
} from "./room";

export type PeerRole =
  | "host"
  | "guest";

export type PeerMessage =
  | {
      type: "CONNECTED";

      payload: {
        message: string;
      };
    }

  | {
      type: "CHAT";

      payload: ChatMessage;
    }

  | {
      type: "MAGNET";

      payload: {
        magnetURI: string;
        fileName: string;
        fileSize: number;
      };
    }

  | {
      type: "JOIN_ROOM";

      payload: {
        participant: Participant;
      };
    }

  | {
      type: "SESSION_STATE";

      payload: RoomSessionState;
    };