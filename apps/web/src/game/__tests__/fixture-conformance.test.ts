import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRUITS, MODES } from "../catalog.js";
import { COUNT_DISTRIBUTION, INITIAL_BREAKDOWN } from "../constants.js";
import { finishSinglePlayerMatch, resolveSinglePlayerBell } from "../lifecycle.js";
import { applyScoringPenalty, createDeck, createPlayers, evaluateBellAvailability, sumBreakdown } from "../rules.js";
import type { Difficulty, FruitKey, PlayerState } from "../types.js";

interface FixtureCase {
  id: string;
  expected: Record<string, unknown>;
  mode?: Difficulty;
  reactionMs?: number;
  startingScore?: number;
  award?: number;
  assessed?: { wrongPenalty?: number; cardPenalty?: number; missedPenalty?: number };
  topCards?: { fruit: FruitKey; count: number }[];
  kind?: string;
  tableSeatCount?: number;
  humanSeatIndexes?: number[];
}

const fixture = JSON.parse(readFileSync(
  new URL("../../../../../contracts/fixtures/v1/single-player.json", import.meta.url),
  "utf8",
)) as { version: number; cases: FixtureCase[] };

function fixtureCase(id: string): FixtureCase {
  const found = fixture.cases.find((item) => item.id === id);
  if (!found) throw new Error(`Missing fixture: ${id}`);
  return found;
}

function player(id: number, card?: { fruit: FruitKey; count: number }): PlayerState {
  return {
    id,
    isHuman: id === 0,
    labelZh: `玩家${id + 1}`,
    labelEn: `Player ${id + 1}`,
    drawPile: [],
    wonPile: [],
    faceUpPile: card ? [{ id: `${card.fruit}-${id}`, ...card }] : [],
  };
}

describe("v1 Shared Behavior Contract", () => {
  it("covers supported Single-Player tables and catalog inventory", () => {
    const tables = fixture.cases.filter((item) => item.kind === "single-player-table");
    expect(tables.map((item) => item.tableSeatCount)).toEqual([4, 5, 6, 7, 8]);
    for (const item of tables) {
      const seats = createPlayers(item.tableSeatCount ?? 0, FRUITS);
      expect(seats.filter((seat) => seat.isHuman).map((seat) => seat.id)).toEqual(item.humanSeatIndexes);
      expect(seats.reduce((total, seat) => total + seat.drawPile.length, 0)).toBe(72);
    }

    const expected = fixtureCase("catalog-inventory").expected;
    const inventory = new Map<string, number>();
    for (const card of createDeck(FRUITS)) {
      const key = `${card.fruit}:${card.count}`;
      inventory.set(key, (inventory.get(key) ?? 0) + 1);
    }
    expect(fixture.version).toBe(1);
    expect(FRUITS.map((fruit) => fruit.key)).toEqual(expected.fruitOrder);
    for (const fruit of FRUITS) {
      for (const [count, repeat] of COUNT_DISTRIBUTION) expect(inventory.get(`${fruit.key}:${count}`)).toBe(repeat);
    }
  });

  it("chooses the canonical fruit when more than one total is five", () => {
    const current = fixtureCase("visible-totals-first-match");
    if (!current.topCards) throw new Error("Fixture top cards are required");
    expect(evaluateBellAvailability(current.topCards.map((card, index) => player(index, card))))
      .toMatchObject(current.expected);
  });

  it("consumes the shared correct-bell vector", () => {
    const current = fixtureCase("two-seat-correct-bell");
    if (!current.topCards) throw new Error("Fixture top cards are required");
    const mode = current.mode ?? "normal";
    const result = resolveSinglePlayerBell({
      state: {
        players: current.topCards.map((card, index) => player(index, card)),
        currentTurn: 0,
        actingPlayer: 0,
        score: 0,
        correctHits: 0,
        wrongHits: 0,
        missedHits: 0,
        reactionTimes: [],
        scoreBreakdown: INITIAL_BREAKDOWN,
        difficulty: mode,
        durationSec: 60,
        tableSeatCount: 4,
        maxStreak: 0,
        streak: 0,
      },
      bellState: { available: true, fruitKey: "banana", startedAt: 1_000, handled: false },
      userSeatId: 0,
      mode: MODES[mode],
      now: 1_000 + (current.reactionMs ?? 0),
    });
    expect(result.state.score).toBe(current.expected.score);
    expect(result.state.scoreBreakdown).toMatchObject(current.expected.breakdown as object);
  });

  it("consumes shared Transition Score Floor vectors without hidden debt", () => {
    for (const id of ["partial-wrong-penalty", "two-seat-wrong-floor", "two-seat-missed-floor"]) {
      const current = fixtureCase(id);
      if (!current.assessed) throw new Error("Fixture assessed penalty is required");
      const breakdown = applyScoringPenalty(
        { ...INITIAL_BREAKDOWN, correctBase: current.startingScore ?? 0 },
        current.assessed,
      );
      expect(sumBreakdown(breakdown)).toBe(current.expected.score);
      expect(breakdown).toMatchObject({
        wrongPenalty: current.expected.wrongPenalty ?? 0,
        cardPenalty: current.expected.cardPenalty ?? 0,
        missedPenalty: current.expected.missedPenalty ?? 0,
      });
    }

    const noDebt = fixtureCase("zero-floor-followed-by-award");
    if (!noDebt.assessed) throw new Error("Fixture assessed penalty is required");
    const afterPenalty = applyScoringPenalty(
      { ...INITIAL_BREAKDOWN, correctBase: noDebt.startingScore ?? 0 },
      noDebt.assessed,
    );
    expect(sumBreakdown(afterPenalty) + (noDebt.award ?? 0)).toBe(noDebt.expected.scoreAfterAward);
  });

  it("reconciles a pending final window once through the score ledger", () => {
    const current = fixtureCase("pending-window-finalization");
    const result = finishSinglePlayerMatch({
      correctHits: 0,
      wrongHits: 0,
      missedHits: 0,
      reactionTimes: [],
      scoreBreakdown: { ...INITIAL_BREAKDOWN, correctBase: current.startingScore ?? 0 },
      difficulty: "normal",
      durationSec: 60,
      tableSeatCount: 4,
    }, { available: true, fruitKey: "grape", startedAt: 1_000, handled: false });
    expect(result.summary.score).toBe(current.expected.score);
    expect(result.summary.missedHits).toBe(current.expected.missedHits);
    expect(result.pendingResolution.snapshot.scoreBreakdown.missedPenalty).toBe(current.expected.missedPenalty);
  });
});
