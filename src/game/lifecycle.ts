import { INITIAL_BREAKDOWN } from "./constants.js";
import {
  clonePlayers,
  collectFaceUpCards,
  createRoundSummary,
  evaluateBellAvailability,
  reconcilePendingBellWindow,
  takePenaltyCards,
  totalTableCards,
} from "./rules.js";
import type { GameModeConfig } from "./catalog.js";
import type {
  BellState,
  Difficulty,
  PlayerState,
  RoundSnapshot,
  ScoreBreakdown,
} from "./types.js";

interface TimerRef {
  current: number | null;
}

export interface SinglePlayerMatchState extends RoundSnapshot {
  players: PlayerState[];
  currentTurn: number;
  actingPlayer: number;
  score: number;
  correctHits: number;
  wrongHits: number;
  missedHits: number;
  reactionTimes: number[];
  scoreBreakdown: ScoreBreakdown;
  difficulty: Difficulty;
  durationSec: number;
  playerCount: number;
  maxStreak: number;
  streak: number;
}

export type SinglePlayerBellResult =
  | { kind: "correct"; collectedCount: number; reactionMs: number; state: SinglePlayerMatchState; bellState: BellState }
  | { kind: "wrong"; penaltyCount: number; state: SinglePlayerMatchState; bellState: BellState };

export function resolveSinglePlayerBell({
  state,
  bellState,
  userSeatId,
  mode,
  now,
}: {
  state: SinglePlayerMatchState;
  bellState: BellState;
  userSeatId: number;
  mode: GameModeConfig;
  now: number;
}): SinglePlayerBellResult {
  if (bellState.available && !bellState.handled) {
    const reactionMs = now - bellState.startedAt;
    const { players, collectedCount } = collectFaceUpCards(state.players, userSeatId);
    const speedBonus = Math.max(0, Math.round((mode.scoreBonusWindow - reactionMs) / 20));
    const streakBonus = state.streak * 10;
    const earned = 120 + collectedCount * 6 + speedBonus + streakBonus;
    const evaluation = evaluateBellAvailability(players);

    return {
      kind: "correct",
      collectedCount,
      reactionMs,
      state: {
        ...state,
        players,
        currentTurn: userSeatId,
        actingPlayer: userSeatId,
        score: state.score + earned,
        correctHits: state.correctHits + 1,
        reactionTimes: [...state.reactionTimes, reactionMs],
        streak: state.streak + 1,
        maxStreak: Math.max(state.maxStreak, state.streak + 1),
        scoreBreakdown: {
          ...state.scoreBreakdown,
          correctBase: state.scoreBreakdown.correctBase + 120,
          collectionBonus: state.scoreBreakdown.collectionBonus + collectedCount * 6,
          speedBonus: state.scoreBreakdown.speedBonus + speedBonus,
          streakBonus: state.scoreBreakdown.streakBonus + streakBonus,
        },
      },
      bellState: {
        available: evaluation.available,
        fruitKey: evaluation.fruitKey,
        startedAt: evaluation.available ? now : 0,
        handled: !evaluation.available,
      },
    };
  }

  const penaltyTarget = Math.ceil(totalTableCards(state.players) / 2);
  const players = clonePlayers(state.players);
  const player = players[userSeatId];
  if (!player) {
    return {
      kind: "wrong",
      penaltyCount: 0,
      state,
      bellState,
    };
  }
  const penalty = takePenaltyCards(player, penaltyTarget);
  players[userSeatId] = penalty.player;
  const evaluation = evaluateBellAvailability(players);

  return {
    kind: "wrong",
    penaltyCount: penalty.penaltyCount,
    state: {
      ...state,
      players,
      wrongHits: state.wrongHits + 1,
      score: Math.max(0, state.score - 50 - penalty.penaltyCount * 4),
      streak: 0,
      scoreBreakdown: {
        ...state.scoreBreakdown,
        wrongPenalty: state.scoreBreakdown.wrongPenalty + 50,
        cardPenalty: state.scoreBreakdown.cardPenalty + penalty.penaltyCount * 4,
      },
    },
    bellState: {
      available: evaluation.available,
      fruitKey: evaluation.fruitKey,
      startedAt: evaluation.available ? now : 0,
      handled: !evaluation.available,
    },
  };
}

export function finishSinglePlayerMatch(snapshot: RoundSnapshot, bellState: BellState) {
  const pendingResolution = reconcilePendingBellWindow(snapshot, bellState);
  return {
    pendingResolution,
    summary: createRoundSummary(pendingResolution.snapshot),
    bellState: {
      available: false,
      fruitKey: null,
      startedAt: 0,
      handled: true,
    } satisfies BellState,
  };
}

interface GameLoopHandles {
  revealIntervalRef: TimerRef;
  countdownIntervalRef: TimerRef;
  feedbackTimeoutRef: TimerRef;
  penaltyTimeoutRef: TimerRef;
  bossTauntTimeoutRef: TimerRef;
  startupTimeoutRef: TimerRef;
}

function clearIntervalRef(ref: TimerRef) {
  if (ref.current !== null) {
    window.clearInterval(ref.current);
  }
}

function clearTimeoutRef(ref: TimerRef) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
  }
}

export function clearGameLoopHandles(handles: GameLoopHandles): void {
  const {
    revealIntervalRef,
    countdownIntervalRef,
    feedbackTimeoutRef,
    penaltyTimeoutRef,
    bossTauntTimeoutRef,
    startupTimeoutRef,
  } = handles;

  clearIntervalRef(revealIntervalRef);
  clearIntervalRef(countdownIntervalRef);
  clearTimeoutRef(feedbackTimeoutRef);
  clearTimeoutRef(penaltyTimeoutRef);
  clearTimeoutRef(bossTauntTimeoutRef);
  clearTimeoutRef(startupTimeoutRef);
}
