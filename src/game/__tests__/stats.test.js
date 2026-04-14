import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bucketByDay,
  computeDailyGoalStreak,
  computeReactionTrend,
  computeRollingAccuracy,
  computeStreak,
} from "../stats.js";

const DAY_MS = 86_400_000;

function daysAgo(n) {
  return Date.now() - n * DAY_MS;
}

function makeEntry(overrides = {}) {
  return {
    ts: daysAgo(0),
    mode: "solo",
    score: 200,
    correctHits: 5,
    wrongHits: 0,
    missedHits: 0,
    accuracy: 1,
    avgReactionMs: 300,
    bestReactionMs: 200,
    difficulty: "normal",
    durationSec: 60,
    playerCount: 4,
    ...overrides,
  };
}

describe("bucketByDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("groups entries by local date", () => {
    const history = [
      makeEntry({ ts: new Date("2025-06-10T08:00:00").getTime() }),
      makeEntry({ ts: new Date("2025-06-10T20:00:00").getTime() }),
      makeEntry({ ts: new Date("2025-06-09T10:00:00").getTime() }),
    ];
    const bucketed = bucketByDay(history);
    expect(Object.keys(bucketed)).toHaveLength(2);
    expect(bucketed["2025-06-10"]).toHaveLength(2);
    expect(bucketed["2025-06-09"]).toHaveLength(1);
  });

  it("returns empty object for empty history", () => {
    expect(bucketByDay([])).toEqual({});
  });
});

describe("computeStreak", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns 0 for empty history", () => {
    expect(computeStreak([])).toBe(0);
  });

  it("counts consecutive days ending today", () => {
    const history = [
      makeEntry({ ts: new Date("2025-06-10T10:00:00").getTime() }),
      makeEntry({ ts: new Date("2025-06-09T10:00:00").getTime() }),
      makeEntry({ ts: new Date("2025-06-08T10:00:00").getTime() }),
    ];
    expect(computeStreak(history)).toBe(3);
  });

  it("stops at gap in streak", () => {
    const history = [
      makeEntry({ ts: new Date("2025-06-10T10:00:00").getTime() }),
      makeEntry({ ts: new Date("2025-06-08T10:00:00").getTime() }), // gap: no June 9
    ];
    expect(computeStreak(history)).toBe(1);
  });

  it("returns 0 if most recent entry is not today", () => {
    const history = [makeEntry({ ts: new Date("2025-06-08T10:00:00").getTime() })];
    expect(computeStreak(history)).toBe(0);
  });
});

describe("computeDailyGoalStreak", () => {
  it("returns 0 when no day meets the target", () => {
    const history = [
      makeEntry({ ts: new Date("2025-06-10T10:00:00").getTime() }),
      makeEntry({ ts: new Date("2025-06-10T11:00:00").getTime() }),
    ];
    expect(computeDailyGoalStreak(history, 5)).toBe(0);
  });

  it("counts consecutive qualifying days", () => {
    const entries = [];
    const days = ["2025-06-08", "2025-06-09", "2025-06-10"];
    for (const day of days) {
      for (let r = 0; r < 5; r++) {
        entries.push(makeEntry({ ts: new Date(`${day}T${10 + r}:00:00`).getTime() }));
      }
    }
    expect(computeDailyGoalStreak(entries, 5)).toBe(3);
  });

  it("stops at gap between qualifying days", () => {
    const entries = [];
    // June 10: 5 entries, June 8: 5 entries (no June 9)
    for (let r = 0; r < 5; r++) {
      entries.push(makeEntry({ ts: new Date(`2025-06-10T${10 + r}:00:00`).getTime() }));
      entries.push(makeEntry({ ts: new Date(`2025-06-08T${10 + r}:00:00`).getTime() }));
    }
    expect(computeDailyGoalStreak(entries, 5)).toBe(1);
  });
});

describe("computeRollingAccuracy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns array of requested length with nulls for missing days", () => {
    const result = computeRollingAccuracy([], 7);
    expect(result).toHaveLength(7);
    expect(result.every((p) => p.value === null)).toBe(true);
  });

  it("averages accuracy for days with entries", () => {
    const history = [
      makeEntry({ ts: new Date("2025-06-10T10:00:00").getTime(), accuracy: 0.8 }),
      makeEntry({ ts: new Date("2025-06-10T11:00:00").getTime(), accuracy: 0.6 }),
    ];
    const result = computeRollingAccuracy(history, 3);
    const today = result[result.length - 1];
    expect(today.value).toBe(70); // avg of 80% and 60% = 70%
  });

  it("newest day is last in the array", () => {
    const result = computeRollingAccuracy([], 5);
    const today = new Date("2025-06-10T12:00:00");
    const d = today;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    expect(result[result.length - 1].date).toBe(`${y}-${m}-${day}`);
  });
});

describe("computeReactionTrend", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-10T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("excludes entries with zero avgReactionMs", () => {
    const history = [
      makeEntry({ ts: new Date("2025-06-10T10:00:00").getTime(), avgReactionMs: 0 }),
      makeEntry({ ts: new Date("2025-06-10T11:00:00").getTime(), avgReactionMs: 400 }),
    ];
    const result = computeReactionTrend(history, 3);
    const today = result[result.length - 1];
    expect(today.value).toBe(400);
  });

  it("returns null for days with no valid entries", () => {
    const history = [makeEntry({ ts: new Date("2025-06-10T10:00:00").getTime(), avgReactionMs: 0 })];
    const result = computeReactionTrend(history, 3);
    expect(result[result.length - 1].value).toBeNull();
  });
});
