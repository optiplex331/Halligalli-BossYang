import type { RoomSnapshot } from "./room-entry.js";

export interface RoomSeatProjection {
  seatIndex: number;
  seatNumber: number;
  name: string;
  ready: boolean;
  card: NonNullable<RoomSnapshot["seats"]>[number]["topCard"] | null;
  faceUpCardCount: number;
  occupied: boolean;
  currentTurn: boolean;
}

export interface RoomProjection {
  snapshot: RoomSnapshot;
  seats: RoomSeatProjection[];
  scoreboard: NonNullable<RoomSnapshot["scoreboard"]>;
  lastEvent: RoomSnapshot["lastEvent"];
  canReady: boolean;
  canStart: boolean;
  canRing: boolean;
}

export function projectRoomSnapshot(snapshot: RoomSnapshot): RoomProjection {
  const allowedCommands = snapshot.allowedCommands ?? [];
  return {
    snapshot,
    seats: (snapshot.seats ?? []).map((seat) => {
      const participant = snapshot.participants.find((item) => item.seatIndex === seat.seatIndex);
      return {
        seatIndex: seat.seatIndex,
        seatNumber: seat.seatIndex + 1,
        name: participant?.name ?? "",
        ready: participant?.ready ?? false,
        occupied: Boolean(participant),
        card: seat.topCard ?? null,
        faceUpCardCount: seat.faceUpCardCount,
        currentTurn: snapshot.currentTurnSeatIndex === seat.seatIndex,
      };
    }),
    scoreboard: snapshot.scoreboard ?? [],
    lastEvent: snapshot.lastEvent,
    canReady: allowedCommands.includes("ready"),
    canStart: allowedCommands.includes("start"),
    canRing: allowedCommands.includes("bell"),
  };
}
