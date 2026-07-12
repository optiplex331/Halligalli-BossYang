import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { projectRoomSnapshot } from "./projection.js";
import type { RoomSnapshot } from "./room-entry.js";

interface MultiplayerCapacityFixture {
  kind: "multiplayer-capacity";
  participants: number;
  expected: {
    maxParticipants: number;
    topCardSeatIndexes: number[];
    currentTurn: number;
    ringingSeatIndex: number;
    score: number;
    missedHits: number;
    breakdown: {
      correctBase: number;
      collectionBonus: number;
      speedBonus: number;
      streakBonus: number;
    };
  };
}

const capacityFixtures = (
  JSON.parse(
    readFileSync(
      new URL("../../../../contracts/fixtures/v1/single-player.json", import.meta.url),
      "utf8",
    ),
  ) as { cases: MultiplayerCapacityFixture[] }
).cases.filter((fixture) => fixture.kind === "multiplayer-capacity");

function snapshotForCapacity(fixture: MultiplayerCapacityFixture): RoomSnapshot {
  const participants = Array.from({ length: fixture.participants }, (_, seatIndex) => ({
    name: `Player ${seatIndex + 1}`,
    seatIndex,
    ready: true,
  }));
  const scoreboard = participants.map((participant) => {
    return {
      seatIndex: participant.seatIndex,
      score: 0,
      correctHits: 0,
      wrongHits: 0,
      missedHits: fixture.expected.missedHits,
      scoreBreakdown: {
        correctBase: 0,
        collectionBonus: 0,
        speedBonus: 0,
        streakBonus: 0,
        wrongPenalty: 0,
        missedPenalty: 0,
        cardPenalty: 0,
      },
    };
  });

  return {
    roomCode: "ABCD",
    revision: fixture.participants,
    phase: "playing",
    minParticipants: 2,
    maxParticipants: fixture.expected.maxParticipants,
    viewerSeatIndex: 0,
    participants,
    currentTurn: fixture.expected.currentTurn,
    topCards: participants.map((_, seatIndex) => {
      if (seatIndex === 0) return { fruit: "banana", count: 2 };
      if (seatIndex === 1) return { fruit: "banana", count: 3 };
      return fixture.expected.topCardSeatIndexes.includes(seatIndex)
        ? { fruit: "strawberry", count: 1 }
        : null;
    }),
    bellAvailable: true,
    bellFruit: "banana",
    scoreboard,
  };
}

describe("projectRoomSnapshot", () => {
  it("renders an authority-owned valid bell window without client scoring", () => {
    const snapshot = {
      roomCode: "ABCD",
      revision: 6,
      phase: "playing",
      minParticipants: 2,
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
      scoreboard: [
        {
          seatIndex: 0,
          score: 207,
          correctHits: 1,
          wrongHits: 0,
          missedHits: 0,
          scoreBreakdown: {
            correctBase: 120,
            collectionBonus: 12,
            speedBonus: 75,
            streakBonus: 0,
            wrongPenalty: 0,
            missedPenalty: 0,
            cardPenalty: 0,
          },
        },
      ],
      lastEvent: "correct_bell",
    } satisfies RoomSnapshot;
    const projection = projectRoomSnapshot(snapshot);

    expect(projection.canReady).toBe(false);
    expect(projection.canStart).toBe(false);
    expect(projection.canRing).toBe(true);
    expect(projection.cards.map((card) => card?.count)).toEqual([2, 3]);
    expect(projection.scoreboard).toBe(snapshot.scoreboard);
    expect(projection.lastEvent).toBe("correct_bell");
  });

  it("keeps every occupied seat stable from the shared capacity fixtures", () => {
    for (const fixture of capacityFixtures) {
      const matchSnapshot = snapshotForCapacity(fixture);
      const lobbySnapshot = {
        ...matchSnapshot,
        phase: "lobby" as const,
        topCards: [],
        scoreboard: [],
      };
      const projection = projectRoomSnapshot(matchSnapshot);
      const scorecard = matchSnapshot.scoreboard ?? [];
      const scoredProjection = projectRoomSnapshot({
        ...matchSnapshot,
        revision: matchSnapshot.revision + 1,
        currentTurn: fixture.expected.ringingSeatIndex,
        topCards: Array.from({ length: fixture.participants }, () => null),
        bellAvailable: false,
        bellFruit: null,
        lastEvent: "correct_bell",
        scoreboard: scorecard.map((score) => {
          const scored = score.seatIndex === fixture.expected.ringingSeatIndex;
          return {
            ...score,
            score: scored ? fixture.expected.score : 0,
            correctHits: scored ? 1 : 0,
            scoreBreakdown: {
              ...score.scoreBreakdown,
              correctBase: scored ? fixture.expected.breakdown.correctBase : 0,
              collectionBonus: scored ? fixture.expected.breakdown.collectionBonus : 0,
              speedBonus: scored ? fixture.expected.breakdown.speedBonus : 0,
              streakBonus: scored ? fixture.expected.breakdown.streakBonus : 0,
            },
          };
        }),
      });

      expect(projectRoomSnapshot(lobbySnapshot).canStart).toBe(true);
      expect(projection.seats.map((seat) => seat.seatIndex)).toEqual(
        Array.from({ length: fixture.participants }, (_, seatIndex) => seatIndex),
      );
      expect(projection.seats.map((seat) => seat.seatNumber)).toEqual(
        Array.from({ length: fixture.participants }, (_, seatIndex) => seatIndex + 1),
      );
      expect(
        projection.seats
          .filter((seat) => seat.card !== null)
          .map((seat) => seat.seatIndex),
      ).toEqual(fixture.expected.topCardSeatIndexes);
      expect(scoredProjection.scoreboard[fixture.expected.ringingSeatIndex]?.score).toBe(
        fixture.expected.score,
      );
      expect(scoredProjection.seats[fixture.expected.ringingSeatIndex]?.currentTurn).toBe(true);
    }
  });
});
