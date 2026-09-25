import type { RoomSnapshot } from "./room-entry.js";

interface RoomSeatProjection {
  seatIndex: number;
  seatNumber: number;
  name: string;
  ready: boolean;
  card: RoomSnapshot["seats"][number]["topCard"] | null;
  occupied: boolean;
  currentTurn: boolean;
}

interface RoomProjection {
  snapshot: RoomSnapshot;
  seats: RoomSeatProjection[];
  canReady: boolean;
  canStart: boolean;
  canRing: boolean;
}

export function projectRoomSnapshot(snapshot: RoomSnapshot): RoomProjection {
  const allowedCommands = snapshot.allowedCommands;
  return {
    snapshot,
    seats: snapshot.seats.map((seat) => {
      const participant = snapshot.participants.find((item) => item.seatIndex === seat.seatIndex);
      return {
        seatIndex: seat.seatIndex,
        seatNumber: seat.seatIndex + 1,
        name: participant?.name ?? "",
        ready: participant?.ready ?? false,
        occupied: Boolean(participant),
        card: seat.topCard ?? null,
        currentTurn: snapshot.currentTurnSeatIndex === seat.seatIndex,
      };
    }),
    canReady: allowedCommands.includes("ready"),
    canStart: allowedCommands.includes("start"),
    canRing: allowedCommands.includes("bell"),
  };
}
