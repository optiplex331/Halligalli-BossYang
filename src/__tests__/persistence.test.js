import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appendHistoryEntry,
  HISTORY_KEY,
  loadHistory,
  normalizeHistoryEntry,
  normalizeSettings,
  normalizeSummary,
  normalizeDailyGoal,
  loadDailyGoal,
  saveDailyGoal,
  normalizeAchievements,
  loadAchievements,
  unlockAchievement,
  DAILY_GOAL_KEY,
  saveJson,
} from "../game/persistence";
import { MAX_HISTORY, ACHIEVEMENTS_KEY } from "../game/constants";

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

describe("daily goal persistence", () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00"));
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
    vi.useRealTimers();
    globalThis.window = originalWindow;
  });

  it("normalizeDailyGoal clamps invalid fields", () => {
    expect(normalizeDailyGoal({ date: "bad", completedRounds: -3, goalReached: "yes" })).toEqual({
      date: "2025-06-10",
      completedRounds: 0,
      goalReached: false,
    });
  });

  it("loadDailyGoal returns fresh goal when stored date is different", () => {
    saveDailyGoal({ date: "2025-06-09", completedRounds: 5, goalReached: true });
    const goal = loadDailyGoal();
    expect(goal.date).toBe("2025-06-10");
    expect(goal.completedRounds).toBe(0);
    expect(goal.goalReached).toBe(false);
  });

  it("loadDailyGoal returns stored goal when date matches today", () => {
    saveDailyGoal({ date: "2025-06-10", completedRounds: 3, goalReached: false });
    expect(loadDailyGoal().completedRounds).toBe(3);
  });

  it("loadDailyGoal returns fresh goal when nothing stored", () => {
    const goal = loadDailyGoal();
    expect(goal.date).toBe("2025-06-10");
    expect(goal.completedRounds).toBe(0);
  });
});

describe("achievements persistence", () => {
  const originalWindow = globalThis.window;
  let store;

  beforeEach(() => {
    store = new Map();
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

  it("normalizeAchievements sets all known keys to null by default", () => {
    const result = normalizeAchievements({});
    expect(Object.keys(result)).toEqual(["first_win", "streak_5", "perfect_round", "sub_200ms", "daily_3"]);
    expect(Object.values(result).every((v) => v === null)).toBe(true);
  });

  it("normalizeAchievements keeps valid timestamps, rejects non-finite values", () => {
    const result = normalizeAchievements({ first_win: 1700000000000, streak_5: "bad" });
    expect(result.first_win).toBe(1700000000000);
    expect(result.streak_5).toBeNull();
  });

  it("loadAchievements returns normalized structure when nothing stored", () => {
    const result = loadAchievements();
    expect(result.first_win).toBeNull();
  });

  it("unlockAchievement sets a timestamp and persists", () => {
    const initial = loadAchievements();
    const updated = unlockAchievement("first_win", initial);
    expect(updated.first_win).toBeGreaterThan(0);
    expect(store.has(ACHIEVEMENTS_KEY)).toBe(true);
  });

  it("unlockAchievement does not overwrite an existing unlock", () => {
    const initial = { ...loadAchievements(), first_win: 1700000000000 };
    const result = unlockAchievement("first_win", initial);
    expect(result.first_win).toBe(1700000000000);
  });
});
