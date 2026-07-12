import { describe, expect, it } from "vitest";

import { projectRoomSnapshot } from "./projection.js";
import type { RoomSnapshot } from "./room-entry.js";

describe("projectRoomSnapshot", () => {
  it("renders an authority-owned valid bell window without client scoring", () => {
    const projection = projectRoomSnapshot({
      roomCode: "ABCD",
      revision: 6,
      phase: "playing",
      maxParticipants: 2,
      viewerSeatIndex: 0,
      participants: [
        { name: "Host", seatIndex: 0, ready: true },
        { name: "Guest", seatIndex: 1, ready: true },
      ],
      currentTurn: 0,
      turnDeadlineAt: 2_700,
      topCards: [
        { fruit: "banana", count: 2 },
        { fruit: "banana", count: 3 },
      ],
      bellAvailable: true,
      bellFruit: "banana",
    } satisfies RoomSnapshot);

    expect(projection.canReady).toBe(false);
    expect(projection.canStart).toBe(false);
    expect(projection.canRing).toBe(true);
    expect(projection.cards.map((card) => card?.count)).toEqual([2, 3]);
  });
});
