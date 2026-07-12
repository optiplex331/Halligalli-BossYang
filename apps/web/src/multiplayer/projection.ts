import type { RoomSnapshot } from "./room-entry.js";

export interface RoomProjection {
  snapshot: RoomSnapshot;
  cards: NonNullable<RoomSnapshot["topCards"]>;
  scoreboard: NonNullable<RoomSnapshot["scoreboard"]>;
  lastEvent: RoomSnapshot["lastEvent"];
  canReady: boolean;
  canStart: boolean;
  canRing: boolean;
}

export function projectRoomSnapshot(snapshot: RoomSnapshot): RoomProjection {
  const viewer = snapshot.participants.find(
    (participant) => participant.seatIndex === snapshot.viewerSeatIndex,
  );

  return {
    snapshot,
    cards: snapshot.topCards ?? [],
    scoreboard: snapshot.scoreboard ?? [],
    lastEvent: snapshot.lastEvent,
    canReady: snapshot.phase === "lobby" && !viewer?.ready,
    canStart:
      snapshot.phase === "lobby" &&
      snapshot.viewerSeatIndex === 0 &&
      snapshot.participants.length === snapshot.maxParticipants &&
      snapshot.participants.every((participant) => participant.ready),
    canRing: snapshot.phase === "playing" && snapshot.bellAvailable,
  };
}
