import { describe, expect, it } from "vitest";
import { getLocalCorrectBellReactionMs } from "./projection.js";
import type { GameBellResultPayload } from "./protocol.js";

const topCards: GameBellResultPayload["topCards"] = [null, null, null];

describe("multiplayer socket projection", () => {
  it("uses the server-authoritative reaction time for the local correct bell result", () => {
    expect(
      getLocalCorrectBellReactionMs(
        {
          type: "correct",
          winnerId: 1,
          collectedCount: 3,
          reactionMs: 427,
          earned: 151,
          topCards,
        },
        1,
      ),
    ).toBe(427);
  });

  it("does not record reaction history for another player's correct bell result", () => {
    expect(
      getLocalCorrectBellReactionMs(
        {
          type: "correct",
          winnerId: 2,
          collectedCount: 3,
          reactionMs: 312,
          earned: 157,
          topCards,
        },
        1,
      ),
    ).toBeNull();
  });

  it("does not record reaction history for wrong bell results", () => {
    expect(
      getLocalCorrectBellReactionMs(
        {
          type: "wrong",
          playerId: 1,
          penaltyCount: 2,
          bellAvailable: false,
          bellFruitKey: null,
          topCards,
        },
        1,
      ),
    ).toBeNull();
  });
});
