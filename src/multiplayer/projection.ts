import type { FruitKey } from "../game/types.js";
import type { GameBellResultPayload, SeatIndex, TopCards } from "./protocol.js";

export interface BellResultProjection {
  topCards: TopCards;
  currentTurn: SeatIndex | null;
  bellState: { available: boolean; fruitKey: FruitKey | null };
  localOutcome: { type: "correct"; reactionMs: number; earned: number; collectedCount: number }
    | { type: "wrong"; penaltyCount: number }
    | null;
}

export function getLocalCorrectBellReactionMs(
  data: GameBellResultPayload,
  mySeatIndex: SeatIndex,
): number | null {
  if (data.type !== "correct") return null;
  if (data.winnerId !== mySeatIndex) return null;
  return data.reactionMs;
}

export function projectBellResult(
  data: GameBellResultPayload,
  mySeatIndex: SeatIndex,
): BellResultProjection {
  if (data.type === "correct") {
    return {
      topCards: data.topCards,
      currentTurn: data.winnerId,
      bellState: { available: false, fruitKey: null },
      localOutcome:
        data.winnerId === mySeatIndex
          ? {
              type: "correct",
              reactionMs: data.reactionMs,
              earned: data.earned,
              collectedCount: data.collectedCount,
            }
          : null,
    };
  }

  return {
    topCards: data.topCards,
    currentTurn: null,
    bellState: { available: data.bellAvailable, fruitKey: data.bellFruitKey },
    localOutcome:
      data.playerId === mySeatIndex
        ? { type: "wrong", penaltyCount: data.penaltyCount }
        : null,
  };
}
