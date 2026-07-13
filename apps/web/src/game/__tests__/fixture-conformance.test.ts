import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FRUITS, MODES } from "../catalog.js";
import { COUNT_DISTRIBUTION, INITIAL_BREAKDOWN } from "../constants.js";
import { finishSinglePlayerMatch, resolveSinglePlayerBell } from "../lifecycle.js";
import {
  applyScoringPenalty,
  createDeck,
  evaluateBellAvailability,
  sumBreakdown,
} from "../rules.js";
import type { Difficulty, FruitKey, PlayerState } from "../types.js";

interface FixtureCard {
  fruit: FruitKey;
  count: number;
}

interface FixtureCase {
  id: string;
  expected: Record<string, unknown>;
  mode?: Difficulty;
  reactionMs?: number;
  startingScore?: number;
  award?: number;
  assessed?: { wrongPenalty?: number; cardPenalty?: number; missedPenalty?: number };
  topCards?: FixtureCard[];
}

interface SinglePlayerFixture {
  version: number;
  cases: FixtureCase[];
}

const fixture = JSON.parse(
  readFileSync(
    new URL("../../../../../contracts/fixtures/v1/single-player.json", import.meta.url),
    "utf8",
  ),
) as SinglePlayerFixture;

function fixtureCase(id: string): FixtureCase {
  const found = fixture.cases.find((item) => item.id === id);
  if (!found) throw new Error(`Missing fixture: ${id}`);
  return found;
}

function player(id: number, faceUpPile: PlayerState["faceUpPile"]): PlayerState {
  return {
    id,
    labelZh: `玩家${id + 1}`,
    labelEn: `Player ${id + 1}`,
    drawPile: [],
    wonPile: [],
    faceUpPile,
  };
}

describe("v1 single-player behavior fixtures", () => {
  it("keeps the catalog inventory as language-neutral data", () => {
    const expected = fixtureCase("catalog-inventory").expected;
    const deck = createDeck(FRUITS);
    const inventory = new Map<string, number>();
    for (const card of deck) {
      inventory.set(`${card.fruit}:${card.count}`, (inventory.get(`${card.fruit}:${card.count}`) ?? 0) + 1);
    }

    expect(fixture.version).toBe(1);
    expect(deck).toHaveLength(Number(expected.cardCount));
    expect(FRUITS.map((fruit) => fruit.key)).toEqual(expected.fruitOrder);
    for (const fruit of FRUITS) {
      for (const [count, repeat] of COUNT_DISTRIBUTION) {
        expect(inventory.get(`${fruit.key}:${count}`)).toBe(repeat);
      }
    }
  });

  it("chooses the canonical fruit when more than one total is five", () => {
    const current = fixtureCase("visible-totals-first-match");
    if (!current.topCards) throw new Error("Fixture top cards are required");
    const evaluation = evaluateBellAvailability(
      current.topCards.map((card, index) => player(index, [{ id: `${card.fruit}-${card.count}`, ...card }])),
    );

    expect(evaluation).toMatchObject(current.expected);
  });

  it("conforms to the exact correct-bell score vector", () => {
    const current = fixtureCase("correct-bell-easy-250ms");
    const reactionMs = current.reactionMs ?? 0;
    const mode = current.mode ?? "easy";
    const result = resolveSinglePlayerBell({
      state: {
        players: [player(0, [{ id: "banana-5", fruit: "banana", count: 5 }]), player(1, []), player(2, [])],
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
        playerCount: 3,
        maxStreak: 0,
        streak: 0,
      },
      bellState: { available: true, fruitKey: "banana", startedAt: 1_000, handled: false },
      userSeatId: 0,
      mode: MODES[mode],
      now: 1_000 + reactionMs,
    });

    expect(result.kind).toBe("correct");
    expect(result.state.score).toBe(current.expected.score);
    expect(result.state.correctHits).toBe(current.expected.correctHits);
    expect(result.state.scoreBreakdown).toMatchObject(current.expected.breakdown as object);
  });

  it("shares the two-seat correct-bell vector with the multiplayer authority", () => {
    const current = fixtureCase("two-seat-correct-bell");
    if (!current.topCards) throw new Error("Fixture top cards are required");
    const mode = current.mode ?? "normal";
    const result = resolveSinglePlayerBell({
      state: {
        players: current.topCards.map((card, index) => player(index, [{ id: `${card.fruit}-${index}`, ...card }])),
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
        playerCount: 2,
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

  it("applies wrong-ring penalties in base-before-card order", () => {
    const current = fixtureCase("partial-wrong-penalty");
    if (!current.assessed) throw new Error("Fixture assessed penalty is required");
    const breakdown = applyScoringPenalty(
      { ...INITIAL_BREAKDOWN, correctBase: current.startingScore ?? 0 },
      current.assessed,
    );

    expect(sumBreakdown(breakdown)).toBe(current.expected.score);
    expect(breakdown.wrongPenalty).toBe(current.expected.wrongPenalty);
    expect(breakdown.cardPenalty).toBe(current.expected.cardPenalty);
  });

  it("does not turn an absorbed penalty into debt against a later award", () => {
    const current = fixtureCase("zero-floor-followed-by-award");
    if (!current.assessed) throw new Error("Fixture assessed penalty is required");
    const afterPenalty = applyScoringPenalty(
      { ...INITIAL_BREAKDOWN, correctBase: current.startingScore ?? 0 },
      current.assessed,
    );
    const afterAward = { ...afterPenalty, correctBase: afterPenalty.correctBase + (current.award ?? 0) };

    expect(sumBreakdown(afterPenalty)).toBe(current.expected.scoreAfterPenalty);
    expect(afterPenalty.wrongPenalty).toBe(current.expected.wrongPenalty);
    expect(afterPenalty.cardPenalty).toBe(current.expected.cardPenalty);
    expect(sumBreakdown(afterAward)).toBe(current.expected.scoreAfterAward);
  });

  it("shares wrong and missed floor vectors with the multiplayer authority", () => {
    const wrong = fixtureCase("two-seat-wrong-floor");
    const missed = fixtureCase("two-seat-missed-floor");
    if (!wrong.assessed || !missed.assessed) throw new Error("Fixture penalties are required");

    const wrongBreakdown = applyScoringPenalty(
      { ...INITIAL_BREAKDOWN, correctBase: wrong.startingScore ?? 0 },
      wrong.assessed,
    );
    const missedBreakdown = applyScoringPenalty(
      { ...INITIAL_BREAKDOWN, correctBase: missed.startingScore ?? 0 },
      missed.assessed,
    );

    expect(sumBreakdown(wrongBreakdown)).toBe(wrong.expected.score);
    expect(wrongBreakdown).toMatchObject({
      wrongPenalty: wrong.expected.wrongPenalty,
      cardPenalty: wrong.expected.cardPenalty,
    });
    expect(sumBreakdown(missedBreakdown)).toBe(missed.expected.score);
    expect(missedBreakdown.missedPenalty).toBe(missed.expected.missedPenalty);
  });

  it("reconciles a pending final window once through the score ledger", () => {
    const current = fixtureCase("pending-window-finalization");
    const result = finishSinglePlayerMatch(
      {
        correctHits: 0,
        wrongHits: 0,
        missedHits: 0,
        reactionTimes: [],
        scoreBreakdown: { ...INITIAL_BREAKDOWN, correctBase: current.startingScore ?? 0 },
      },
      { available: true, fruitKey: "grape", startedAt: 1_000, handled: false },
    );

    expect(result.summary.score).toBe(current.expected.score);
    expect(result.summary.missedHits).toBe(current.expected.missedHits);
    expect(result.pendingResolution.snapshot.scoreBreakdown?.missedPenalty).toBe(current.expected.missedPenalty);
  });
});
