import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameEngine } from "../GameEngine.js";
import type { GameFlipPayload } from "../../src/multiplayer/protocol.js";

const REVEAL_MS = 1850;

function lastFlip(events: ReturnType<typeof vi.fn>): GameFlipPayload | undefined {
  const call = [...events.mock.calls]
    .reverse()
    .find(([event]) => event === "game:flip");
  return call?.[1] as GameFlipPayload | undefined;
}

function advanceToBell(engine: GameEngine, events: ReturnType<typeof vi.fn>): GameFlipPayload {
  engine.start();

  for (let turn = 0; turn < 72; turn += 1) {
    const flip = lastFlip(events);
    if (flip?.bellAvailable) {
      return flip;
    }
    vi.advanceTimersByTime(REVEAL_MS);
  }

  throw new Error("Expected the deterministic deck to expose a bell window");
}

describe("GameEngine public behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T00:00:00.000Z"));
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("emits an authoritative correct bell result with deterministic reaction time", () => {
    const events = vi.fn();
    const engine = new GameEngine(3, "easy", 600, events);

    advanceToBell(engine, events);
    vi.advanceTimersByTime(127);

    expect(engine.handleBellPress(1)).toMatchObject({
      type: "correct",
      winnerId: 1,
      reactionMs: 127,
    });
    expect(events).toHaveBeenLastCalledWith(
      "game:bell-result",
      expect.objectContaining({ type: "correct", winnerId: 1, reactionMs: 127 }),
    );
  });

  it("emits an authoritative wrong bell result when no bell window is open", () => {
    const events = vi.fn();
    const engine = new GameEngine(3, "easy", 600, events);

    advanceToBell(engine, events);
    engine.handleBellPress(1);

    expect(engine.handleBellPress(1)).toMatchObject({ type: "wrong", playerId: 1 });
    expect(events).toHaveBeenLastCalledWith(
      "game:bell-result",
      expect.objectContaining({ type: "wrong", playerId: 1 }),
    );
  });

  it("emits a missed bell outcome when a public flip advances an unresolved window", () => {
    const events = vi.fn();
    const engine = new GameEngine(3, "easy", 600, events);

    const bellFlip = advanceToBell(engine, events);
    vi.advanceTimersByTime(REVEAL_MS);

    expect(events).toHaveBeenCalledWith("game:missed", { fruitKey: bellFlip.bellFruitKey });
  });

  it("finishes once and clears public timer effects", () => {
    const events = vi.fn();
    const engine = new GameEngine(3, "easy", 600, events);

    engine.start();
    const results = engine.finish();
    const eventCountAfterFinish = events.mock.calls.length;
    vi.advanceTimersByTime(60_000);

    expect(results).toEqual(expect.objectContaining({
      0: expect.objectContaining({ seatIndex: 0 }),
      1: expect.objectContaining({ seatIndex: 1 }),
      2: expect.objectContaining({ seatIndex: 2 }),
    }));
    expect(events).toHaveBeenLastCalledWith("game:end", { results });
    expect(events).toHaveBeenCalledTimes(eventCountAfterFinish);
    expect(engine.finish()).toBeNull();
  });

  it("stops timer-driven events after destruction", () => {
    const events = vi.fn();
    const engine = new GameEngine(3, "easy", 600, events);

    engine.start();
    engine.destroy();
    const eventCountAfterDestroy = events.mock.calls.length;
    vi.advanceTimersByTime(60_000);

    expect(events).toHaveBeenCalledTimes(eventCountAfterDestroy);
    expect(engine.handleBellPress(1)).toBeNull();
  });
});
