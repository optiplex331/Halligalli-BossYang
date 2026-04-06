import { describe, expect, it } from "vitest";
import { normalizeSettings, normalizeSummary, saveJson } from "../game/persistence";

describe("persistence normalization", () => {
  it("clamps malformed settings back to supported values", () => {
    expect(
      normalizeSettings({
        difficulty: "impossible",
        duration: 999,
        playerCount: 8,
        language: "fr",
        soundEnabled: "yes",
      }),
    ).toEqual({
      difficulty: "normal",
      duration: 60,
      playerCount: 4,
      language: "zh",
      soundEnabled: true,
    });
  });

  it("normalizes invalid summary payloads into safe numeric shapes", () => {
    expect(
      normalizeSummary({
        score: -100,
        correctHits: 2,
        wrongHits: -1,
        missedHits: 1,
        accuracy: 99,
        avgReactionMs: -20,
        bestReactionMs: -5,
        difficulty: "boss",
        durationSec: 120,
        playerCount: 1,
      }),
    ).toEqual({
      score: 0,
      correctHits: 2,
      wrongHits: 0,
      missedHits: 1,
      accuracy: 2 / 3,
      avgReactionMs: 0,
      bestReactionMs: 0,
      difficulty: "normal",
      durationSec: 60,
      playerCount: 4,
    });
  });

  it("returns false instead of throwing when storage writes fail", () => {
    const originalWindow = globalThis.window;

    globalThis.window = {
      localStorage: {
        setItem() {
          throw new Error("quota");
        },
      },
    };

    expect(saveJson("test-key", { ok: true })).toBe(false);

    globalThis.window = originalWindow;
  });
});
