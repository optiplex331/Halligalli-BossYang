import type { RoomSnapshot } from "./room-entry.js";

export interface RoomSeatProjection {
  seatIndex: number;
  seatNumber: number;
  name: string;
  ready: boolean;
  card: NonNullable<RoomSnapshot["topCards"]>[number] | null;
  currentTurn: boolean;
}

export interface RoomProjection {
  snapshot: RoomSnapshot;
  cards: NonNullable<RoomSnapshot["topCards"]>;
  seats: RoomSeatProjection[];
  scoreboard: NonNullable<RoomSnapshot["scoreboard"]>;
  lastEvent: RoomSnapshot["lastEvent"];
  canReady: boolean;
  canStart: boolean;
  canRing: boolean;
}

export function projectRoomSnapshot(snapshot: RoomSnapshot): RoomProjection {
  const cards = snapshot.topCards ?? [];
  const viewer = snapshot.participants.find(
    (participant) => participant.seatIndex === snapshot.viewerSeatIndex,
  );

  return {
    snapshot,
    cards,
    seats: snapshot.participants.map((participant) => ({
      seatIndex: participant.seatIndex,
      seatNumber: participant.seatIndex + 1,
      name: participant.name,
      ready: participant.ready,
      card: cards[participant.seatIndex] ?? null,
      currentTurn: snapshot.currentTurn === participant.seatIndex,
    })),
    scoreboard: snapshot.scoreboard ?? [],
    lastEvent: snapshot.lastEvent,
    canReady: snapshot.phase === "lobby" && !viewer?.ready,
    canStart:
      snapshot.phase === "lobby" &&
      snapshot.viewerSeatIndex === 0 &&
      snapshot.participants.length >= snapshot.minParticipants &&
      snapshot.participants.every((participant) => participant.ready),
    canRing: snapshot.phase === "playing" && snapshot.bellAvailable,
  };
}
