import { describe, expect, it } from "vitest";
import {
  collectFaceUpCards,
  createRoundSummary,
  evaluateBellAvailability,
  reconcilePendingBellWindow,
  takePenaltyCards,
  visibleTotals,
} from "../game/rules";
import { INITIAL_BREAKDOWN } from "../game/constants";

function makePlayer(id, overrides = {}) {
  return {
    id,
    labelZh: `P${id}`,
    labelEn: `P${id}`,
    drawPile: [],
    wonPile: [],
    faceUpPile: [],
    ...overrides,
  };
}

describe("game rules", () => {
  it("computes visible totals from top face-up cards only", () => {
    const players = [
      makePlayer(0, {
        faceUpPile: [
          { id: "old-1", fruit: "banana", count: 4 },
          { id: "top-1", fruit: "banana", count: 2 },
        ],
      }),
      makePlayer(1, {
        faceUpPile: [{ id: "top-2", fruit: "banana", count: 3 }],
      }),
      makePlayer(2, {
        faceUpPile: [{ id: "top-3", fruit: "grape", count: 5 }],
      }),
    ];

    expect(visibleTotals(players)).toEqual({
      banana: 5,
      strawberry: 0,
      lemon: 0,
      grape: 5,
    });
    expect(evaluateBellAvailability(players)).toMatchObject({
      available: true,
      fruitKey: "banana",
    });
  });

  it("moves penalty cards onto the face-up pile from draw then won piles", () => {
    const player = makePlayer(0, {
      drawPile: [{ id: "draw-1", fruit: "banana", count: 1 }],
      wonPile: [
        { id: "won-1", fruit: "grape", count: 2 },
        { id: "won-2", fruit: "lemon", count: 3 },
      ],
      faceUpPile: [{ id: "face-up", fruit: "strawberry", count: 1 }],
    });

    const result = takePenaltyCards(player, 3);

    expect(result.penaltyCount).toBe(3);
    expect(result.player.faceUpPile).toHaveLength(4);
    expect(result.player.faceUpPile[3]).toEqual({
      id: "face-up",
      fruit: "strawberry",
      count: 1,
    });
  });

  it("collects all face-up cards onto the winner's won pile", () => {
    const players = [
      makePlayer(0, {
        wonPile: [{ id: "won", fruit: "banana", count: 1 }],
        faceUpPile: [{ id: "a", fruit: "banana", count: 2 }],
      }),
      makePlayer(1, {
        faceUpPile: [{ id: "b", fruit: "grape", count: 3 }],
      }),
    ];

    const result = collectFaceUpCards(players, 0);

    expect(result.collectedCount).toBe(2);
    expect(result.players[0].wonPile).toHaveLength(3);
    expect(result.players[0].faceUpPile).toEqual([]);
    expect(result.players[1].faceUpPile).toEqual([]);
  });

  it("reconciles an unresolved final bell window as a missed hit", () => {
    const snapshot = {
      correctHits: 2,
      wrongHits: 1,
      missedHits: 0,
      reactionTimes: [410, 580],
      scoreBreakdown: {
        ...INITIAL_BREAKDOWN,
        correctBase: 240,
        wrongPenalty: 50,
      },
      difficulty: "normal",
      durationSec: 60,
      playerCount: 4,
    };

    const resolved = reconcilePendingBellWindow(snapshot, {
      available: true,
      fruitKey: "banana",
      startedAt: Date.now() - 200,
      handled: false,
    });

    expect(resolved.missed).toBe(true);
    expect(resolved.snapshot.missedHits).toBe(1);
    expect(resolved.snapshot.scoreBreakdown.missedPenalty).toBe(30);
  });

  it("creates the expected round summary from score breakdown and reactions", () => {
    const summary = createRoundSummary({
      correctHits: 3,
      wrongHits: 1,
      missedHits: 1,
      reactionTimes: [300, 600, 900],
      scoreBreakdown: {
        correctBase: 360,
        collectionBonus: 18,
        speedBonus: 12,
        streakBonus: 20,
        wrongPenalty: 50,
        missedPenalty: 30,
        cardPenalty: 8,
      },
      difficulty: "hard",
      durationSec: 90,
      playerCount: 5,
    });

    expect(summary).toEqual({
      score: 322,
      correctHits: 3,
      wrongHits: 1,
      missedHits: 1,
      accuracy: 0.6,
      avgReactionMs: 600,
      bestReactionMs: 300,
      difficulty: "hard",
      durationSec: 90,
      playerCount: 5,
    });
  });
});
