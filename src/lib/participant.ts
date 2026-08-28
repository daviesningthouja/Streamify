import type {
  Participant,
  RoomRole,
} from "@/types/room";

const PARTICIPANT_ID_KEY =
  "stream-sync-participant-id";

function getOrCreateParticipantId(): string {
  const existing =
    localStorage.getItem(
      PARTICIPANT_ID_KEY,
    );

  if (existing) {
    return existing;
  }

  const participantId =
    crypto.randomUUID();

  localStorage.setItem(
    PARTICIPANT_ID_KEY,
    participantId,
  );

  return participantId;
}

export function createParticipant(
  peerId: string,
  role: RoomRole,
  displayName?: string,
): Participant {
  return {
    participantId:
      getOrCreateParticipantId(),

    displayName:
      displayName ??
      (role === "host"
        ? "Host"
        : "Guest"),

    peerId,

    role,
  };
}