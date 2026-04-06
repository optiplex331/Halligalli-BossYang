import { afterEach, describe, expect, it, vi } from "vitest";
import { clearGameLoopHandles } from "../game/lifecycle";

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
    };

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
});
