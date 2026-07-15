import { describe, expect, it } from "vitest";

import { projectRoomSnapshot } from "./projection.js";
import type { RoomSnapshot } from "./room-entry.js";

function snapshot(): RoomSnapshot {
  return {
    roomCode: "ABCD",
    revision: 3,
    phase: "playing",
    configuration: {
      tableSeatCount: 6,
      targetHumanParticipantCount: 3,
      difficulty: "normal",
      durationSec: 60,
    },
    viewerSeatIndex: 2,
    participants: [
      { seatIndex: 0, name: "Host", ready: true, active: true },
      { seatIndex: 1, name: "Guest", ready: true, active: true },
      { seatIndex: 2, name: "Viewer", ready: true, active: true },
    ],
    currentTurnSeatIndex: 4,
    seats: Array.from({ length: 6 }, (_, seatIndex) => ({
      seatIndex,
      topCard: seatIndex === 4 ? { fruit: "banana" as const, count: 5 } : null,
      faceUpCardCount: seatIndex === 4 ? 2 : 0,
    })),
    lastReveal: { sequence: 7, seatIndex: 4 },
    allowedCommands: ["bell", "forfeit"],
    scoreboard: [],
    bellFruit: "banana",
    matchNumber: 1,
  };
}

describe("Socket Projection", () => {
  it("joins complete Table Seats to sparse Human Participants", () => {
    const projection = projectRoomSnapshot(snapshot());

    expect(projection.seats).toHaveLength(6);
    expect(projection.seats.filter((seat) => seat.occupied)).toHaveLength(3);
    expect(projection.seats[4]).toMatchObject({
      seatNumber: 5,
      occupied: false,
      currentTurn: true,
      faceUpCardCount: 2,
      card: { fruit: "banana", count: 5 },
    });
  });

  it("uses authority-provided capabilities", () => {
    const projection = projectRoomSnapshot(snapshot());

    expect(projection.canRing).toBe(true);
    expect(projection.canReady).toBe(false);
    expect(projection.canStart).toBe(false);
  });
});
