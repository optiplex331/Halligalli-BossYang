import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendHistoryEntry,
  HISTORY_KEY,
  loadHistory,
  normalizeHistoryEntry,
  normalizeSettings,
  normalizeSummary,
  saveJson,
} from "../game/persistence";
import { MAX_HISTORY } from "../game/constants";

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

describe("history persistence", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const store = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (k) => (store.has(k) ? store.get(k) : null),
        setItem: (k, v) => store.set(k, String(v)),
        removeItem: (k) => store.delete(k),
      },
    };
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  function makeEntry(overrides = {}) {
    return {
      ts: 1700000000000,
      mode: "solo",
      score: 200,
      correctHits: 5,
      wrongHits: 1,
      missedHits: 0,
      avgReactionMs: 320,
      bestReactionMs: 210,
      difficulty: "normal",
      durationSec: 60,
      playerCount: 4,
      ...overrides,
    };
  }

  it("returns empty list when no history stored", () => {
    expect(loadHistory()).toEqual([]);
  });

  it("falls back to empty list when stored value is not an array", () => {
    saveJson(HISTORY_KEY, { not: "array" });
    expect(loadHistory()).toEqual([]);
  });

  it("drops malformed entries while keeping valid ones", () => {
    saveJson(HISTORY_KEY, [makeEntry(), null, "garbage", makeEntry({ ts: 2 })]);
    const history = loadHistory();
    expect(history).toHaveLength(2);
    expect(history[0].ts).toBe(1700000000000);
  });

  it("appends newest entry to the front", () => {
    appendHistoryEntry(makeEntry({ ts: 1, score: 100 }));
    appendHistoryEntry(makeEntry({ ts: 2, score: 200 }));
    const history = loadHistory();
    expect(history[0].score).toBe(200);
    expect(history[1].score).toBe(100);
  });

  it("caps history length at MAX_HISTORY", () => {
    for (let i = 0; i < MAX_HISTORY + 25; i++) {
      appendHistoryEntry(makeEntry({ ts: i }));
    }
    const history = loadHistory();
    expect(history).toHaveLength(MAX_HISTORY);
    expect(history[0].ts).toBe(MAX_HISTORY + 24);
  });

  it("normalizes mode field, defaulting to solo for unknown values", () => {
    expect(normalizeHistoryEntry(makeEntry({ mode: "co-op" })).mode).toBe("solo");
    expect(normalizeHistoryEntry(makeEntry({ mode: "multi" })).mode).toBe("multi");
  });

  it("returns null for non-object input", () => {
    expect(normalizeHistoryEntry(null)).toBeNull();
    expect(normalizeHistoryEntry("string")).toBeNull();
  });

  it("ignores invalid entry on append without throwing", () => {
    appendHistoryEntry(makeEntry({ ts: 1 }));
    appendHistoryEntry(null);
    expect(loadHistory()).toHaveLength(1);
  });
});
