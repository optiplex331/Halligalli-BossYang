import type { GameBellResultPayload, SeatIndex } from "./protocol.js";

export function getLocalCorrectBellReactionMs(
  data: GameBellResultPayload,
  mySeatIndex: SeatIndex,
): number | null {
  if (data.type !== "correct") return null;
  if (data.winnerId !== mySeatIndex) return null;
  return data.reactionMs;
}
