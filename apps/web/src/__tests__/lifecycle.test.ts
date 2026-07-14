import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGameLoopHandles,
  finishSinglePlayerMatch,
  resolveSinglePlayerBell,
  resolveSinglePlayerMissedBell,
} from "../game/lifecycle.js";
import { INITIAL_BREAKDOWN } from "../game/constants.js";
import type { BellState, PlayerState } from "../game/types.js";

const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.window = originalWindow;
});

describe("game lifecycle cleanup", () => {
  it("clears every tracked interval and timeout handle, including startup", () => {
    const clearInterval = vi.fn();
    const clearTimeout = vi.fn();

    globalThis.window = {
      clearInterval,
      clearTimeout,
    } as unknown as Window & typeof globalThis;

    clearGameLoopHandles({
      revealIntervalRef: { current: 11 },
      countdownIntervalRef: { current: 12 },
      feedbackTimeoutRef: { current: 21 },
      penaltyTimeoutRef: { current: 22 },
      bossTauntTimeoutRef: { current: 23 },
      startupTimeoutRef: { current: 24 },
    });

    expect(clearInterval).toHaveBeenCalledTimes(2);
    expect(clearInterval).toHaveBeenNthCalledWith(1, 11);
    expect(clearInterval).toHaveBeenNthCalledWith(2, 12);
    expect(clearTimeout).toHaveBeenCalledTimes(4);
    expect(clearTimeout).toHaveBeenNthCalledWith(4, 24);
  });

  it("resolves a correct bell through the lifecycle interface", () => {
    const players: PlayerState[] = [
      {
        id: 0,
        isHuman: true,
        labelZh: "你",
        labelEn: "You",
        drawPile: [],
        wonPile: [],
        faceUpPile: [{ id: "banana", fruit: "banana", count: 5 }],
      },
      { id: 1, isHuman: false, labelZh: "P1", labelEn: "P1", drawPile: [], wonPile: [], faceUpPile: [] },
      { id: 2, isHuman: false, labelZh: "P2", labelEn: "P2", drawPile: [], wonPile: [], faceUpPile: [] },
    ];

    const result = resolveSinglePlayerBell({
      state: {
        players,
        currentTurn: 0,
        actingPlayer: 0,
        score: 0,
        correctHits: 0,
        wrongHits: 0,
        missedHits: 0,
        reactionTimes: [],
        scoreBreakdown: INITIAL_BREAKDOWN,
        difficulty: "easy",
        durationSec: 60,
        tableSeatCount: 4,
        maxStreak: 0,
        streak: 0,
      },
      bellState: { available: true, fruitKey: "banana", startedAt: 1_000, handled: false },
      userSeatId: 0,
      mode: { label: "简单", labelEn: "Easy", revealMs: 1850, scoreBonusWindow: 1900 },
      now: 1_250,
    });

    expect(result.kind).toBe("correct");
    expect(result.state.correctHits).toBe(1);
    expect(result.state.score).toBe(209);
    expect(result.state.players[0]?.wonPile).toHaveLength(1);
    expect(result.bellState.handled).toBe(true);
  });

  it("returns a final summary after reconciling a pending bell window", () => {
    const bellState: BellState = {
      available: true,
      fruitKey: "grape",
      startedAt: 1_000,
      handled: false,
    };

    const result = finishSinglePlayerMatch({
      correctHits: 1,
      wrongHits: 0,
      missedHits: 0,
      reactionTimes: [250],
      scoreBreakdown: { ...INITIAL_BREAKDOWN, correctBase: 120 },
      difficulty: "easy",
      durationSec: 60,
      tableSeatCount: 4,
    }, bellState);

    expect(result.pendingResolution).toMatchObject({ missed: true, missedFruit: "grape" });
    expect(result.summary).toMatchObject({ score: 90, missedHits: 1 });
  });

  it("records only the applied missed penalty at the transition score floor", () => {
    const result = resolveSinglePlayerMissedBell({
      players: [],
      currentTurn: 0,
      actingPlayer: 0,
      score: 12,
      correctHits: 0,
      wrongHits: 0,
      missedHits: 0,
      reactionTimes: [],
      scoreBreakdown: { ...INITIAL_BREAKDOWN, correctBase: 12 },
      difficulty: "normal",
      durationSec: 60,
      tableSeatCount: 4,
      maxStreak: 0,
      streak: 2,
    });

    expect(result.score).toBe(0);
    expect(result.scoreBreakdown.missedPenalty).toBe(12);
    expect(result.streak).toBe(0);
  });
});
