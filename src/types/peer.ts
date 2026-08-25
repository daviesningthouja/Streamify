export type PeerRole = "host" | "guest";

export type PeerMessage =
  | {
      type: "CONNECTED";
      payload: {
        message: string;
      };
    }
  | {
      type: "CHAT";
      payload: {
        id: string;
        text: string;
        sender: PeerRole;
        timestamp: number;
      };
    }
  | {
    type: "MAGNET";
    payload: {
      magnetURI: string;
      fileName: string;
      fileSize: number;
    };
  };