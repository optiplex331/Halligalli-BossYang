import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearGameLoopHandles,
  finishSinglePlayerMatch,
} from "../game/lifecycle.js";
import { INITIAL_BREAKDOWN } from "../game/constants.js";
import type { BellState } from "../game/types.js";

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

});
