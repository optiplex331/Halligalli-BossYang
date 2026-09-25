import { useEffect, useMemo, useRef, useState } from "react";
import type { FeedbackKind } from "../audio/useAudioEngine.js";
import { FRUITS, MODES } from "../game/catalog.js";
import type { GameModeConfig } from "../game/catalog.js";
import { DEFAULT_SETTINGS, INITIAL_BREAKDOWN } from "../game/constants.js";
import {
  clearGameLoopHandles,
  clearTimeoutRef,
  finishSinglePlayerMatch,
  resolveSinglePlayerBell,
  resolveSinglePlayerMissedBell,
} from "../game/lifecycle.js";
import type { GameLoopHandles, SinglePlayerMatchState } from "../game/lifecycle.js";
import { clonePlayers, createPlayers, evaluateBellAvailability, flipCardForPlayer, getHumanSeatIndex } from "../game/rules.js";
import type { BellState, Difficulty, FruitKey, PlayerState, RoundSummary } from "../game/types.js";
import { useBellPress } from "../useBellPress.js";

const COUNTDOWN_STEP_MS = 1_000;
const CLOCK_TICK_MS = 1_000;
const NOTICE_MS = 1_200;
const BOSS_TAUNT_MS = 1_700;
const REVEAL_FLASH_MS = 500;

interface SoloRoundConfig {
  tableSeatCount: number;
  difficulty: Difficulty;
  durationSec: number;
}

/** What the table-update line should say. Transient notices fall back to "observe" after a short delay. */
export type SoloRoundNotice =
  | { kind: "start" }
  | { kind: "observe" }
  | { kind: "missed"; fruit: FruitKey | null }
  | { kind: "correct"; collectedCount: number }
  | { kind: "wrong"; penaltyCount: number };

interface SoloRoundState {
  /** `idle` before the first start, `countdown` during 3-2-1, `playing` while cards reveal, `finished` once summarized. */
  phase: "idle" | "countdown" | "playing" | "finished";
  countdown: { runId: number; value: 3 | 2 | 1 } | null;
  secondsLeft: number;
  match: SinglePlayerMatchState;
  userSeatId: number;
  /** Fruit whose visible total is exactly five while the bell window is open. */
  bellFruit: FruitKey | null;
  bellPressed: boolean;
  /** Seat that just revealed a card; `sequence` changes on every reveal. */
  reveal: { sequence: number; seatIndex: number } | null;
  notice: SoloRoundNotice;
  /** Uniform roll in [0, 1) for picking a Boss Mode taunt after a missed bell; null when no taunt shows. */
  bossTauntRoll: number | null;
  summary: RoundSummary | null;
}

interface SoloRound {
  state: SoloRoundState;
  /** Starts a fresh round: 3-2-1 countdown, then timed reveals until the clock runs out. Restarts a running round. */
  start: (config: SoloRoundConfig) => void;
  /** The human rings the bell. Ignored unless cards are revealing. */
  ring: () => void;
  /** Ends a running round early and summarizes it. Ignored during the countdown. */
  end: () => void;
}

const CLOSED_BELL: BellState = {
  available: false,
  fruitKey: null,
  startedAt: 0,
  handled: true,
};

function freshMatch(config: SoloRoundConfig, players: PlayerState[]): SinglePlayerMatchState {
  return {
    players,
    currentTurn: 0,
    actingPlayer: 0,
    score: 0,
    correctHits: 0,
    wrongHits: 0,
    missedHits: 0,
    reactionTimes: [],
    scoreBreakdown: { ...INITIAL_BREAKDOWN },
    difficulty: config.difficulty,
    durationSec: config.durationSec,
    tableSeatCount: config.tableSeatCount,
    maxStreak: 0,
    streak: 0,
  };
}

const INITIAL_CONFIG: SoloRoundConfig = {
  tableSeatCount: DEFAULT_SETTINGS.tableSeatCount,
  difficulty: DEFAULT_SETTINGS.difficulty,
  durationSec: DEFAULT_SETTINGS.duration,
};

const INITIAL_STATE: Omit<SoloRoundState, "bellPressed"> = {
  phase: "idle",
  countdown: null,
  secondsLeft: DEFAULT_SETTINGS.duration,
  match: freshMatch(INITIAL_CONFIG, []),
  userSeatId: 0,
  bellFruit: null,
  reveal: null,
  notice: { kind: "start" },
  bossTauntRoll: null,
  summary: null,
};

/**
 * Single-player round loop. Owns every round timer (countdown, card reveals, clock,
 * notice and taunt expiry) and the bell window; the rules stay in game/lifecycle.
 * Sound cues are sent through `playFeedback` at the moments the round decides them.
 */
export function useSoloRound(playFeedback: (kind: FeedbackKind) => void): SoloRound {
  const [view, setView] = useState(INITIAL_STATE);
  const [bellPressed, pressBell] = useBellPress();
  const playRef = useRef(playFeedback);
  playRef.current = playFeedback;

  const controls = useMemo(() => {
    const timers: Required<GameLoopHandles> = {
      revealIntervalRef: { current: null },
      countdownIntervalRef: { current: null },
      feedbackTimeoutRef: { current: null },
      bossTauntTimeoutRef: { current: null },
      startupTimeoutRef: { current: null },
      revealFlashTimeoutRef: { current: null },
    };
    let config = INITIAL_CONFIG;
    let mode: GameModeConfig = MODES[config.difficulty];
    let userSeatId = 0;
    let match = INITIAL_STATE.match;
    let bell = CLOSED_BELL;
    let running = false;
    let secondsLeft = config.durationSec;
    let countdownRun = 0;
    let revealSequence = 0;

    const play = (kind: FeedbackKind) => playRef.current(kind);
    const patch = (next: Partial<SoloRoundState>) => setView((current) => ({ ...current, ...next }));

    function commit(next: SinglePlayerMatchState): void {
      match = next;
      patch({ match: next });
    }

    function openBellWindow(players: PlayerState[], now: number): void {
      const evaluation = evaluateBellAvailability(players);
      bell = evaluation.available
        ? { available: true, fruitKey: evaluation.fruitKey, startedAt: now, handled: false }
        : CLOSED_BELL;
      patch({ bellFruit: evaluation.fruitKey });
    }

    function announce(notice: SoloRoundNotice): void {
      patch({ notice });
      clearTimeoutRef(timers.feedbackTimeoutRef);
      timers.feedbackTimeoutRef.current = window.setTimeout(() => patch({ notice: { kind: "observe" } }), NOTICE_MS);
    }

    function taunt(): void {
      if (!mode.isBoss) return;
      patch({ bossTauntRoll: Math.random() });
      clearTimeoutRef(timers.bossTauntTimeoutRef);
      timers.bossTauntTimeoutRef.current = window.setTimeout(() => patch({ bossTauntRoll: null }), BOSS_TAUNT_MS);
    }

    function advanceTurn(): void {
      if (!running) return;

      const base = match;
      let next = base;
      if (bell.available && !bell.handled) {
        const missedFruit = bell.fruitKey;
        next = resolveSinglePlayerMissedBell(next);
        announce({ kind: "missed", fruit: missedFruit });
        play("warn");
        taunt();
      }

      const players = clonePlayers(next.players);
      const actorIndex = next.currentTurn;
      const actor = players[actorIndex];
      if (!actor) return;

      players[actorIndex] = flipCardForPlayer(actor).player;
      if (next === base) play("flip");
      openBellWindow(players, Date.now());
      commit({
        ...next,
        players,
        actingPlayer: actorIndex,
        currentTurn: (actorIndex + 1) % players.length,
      });
      revealSequence += 1;
      patch({ reveal: { sequence: revealSequence, seatIndex: actorIndex } });
      clearTimeoutRef(timers.revealFlashTimeoutRef);
      timers.revealFlashTimeoutRef.current = window.setTimeout(() => patch({ reveal: null }), REVEAL_FLASH_MS);
    }

    function begin(): void {
      running = true;
      patch({ phase: "playing", countdown: null });
      announce({ kind: "start" });
      advanceTurn();

      timers.revealIntervalRef.current = window.setInterval(advanceTurn, mode.revealMs);
      timers.countdownIntervalRef.current = window.setInterval(() => {
        if (secondsLeft <= 1) {
          secondsLeft = 0;
          patch({ secondsLeft });
          end();
          return;
        }
        secondsLeft -= 1;
        patch({ secondsLeft });
      }, CLOCK_TICK_MS);
    }

    function start(nextConfig: SoloRoundConfig): void {
      clearGameLoopHandles(timers);
      play("tick");
      config = nextConfig;
      mode = MODES[config.difficulty];
      userSeatId = getHumanSeatIndex(config.tableSeatCount) ?? -1;
      match = freshMatch(config, createPlayers(config.tableSeatCount, FRUITS));
      bell = CLOSED_BELL;
      running = false;
      secondsLeft = config.durationSec;
      countdownRun += 1;
      const runId = countdownRun;
      setView({
        phase: "countdown",
        countdown: { runId, value: 3 },
        secondsLeft,
        match,
        userSeatId,
        bellFruit: null,
        reveal: null,
        notice: { kind: "start" },
        bossTauntRoll: null,
        summary: null,
      });

      const step = (value: number) => {
        timers.startupTimeoutRef.current = window.setTimeout(() => {
          timers.startupTimeoutRef.current = null;
          const nextValue = value - 1;
          if (nextValue > 0) {
            patch({ countdown: { runId, value: nextValue as 2 | 1 } });
            play("tick");
            step(nextValue);
            return;
          }
          play("go");
          begin();
        }, COUNTDOWN_STEP_MS);
      };
      step(3);
    }

    function ring(): void {
      if (!running) return;

      const result = resolveSinglePlayerBell({ state: match, bellState: bell, userSeatId, mode, now: Date.now() });
      bell = result.bellState;
      patch({ bellFruit: result.bellState.fruitKey });
      commit(result.state);
      pressBell();
      play("ring");

      if (result.kind === "correct") {
        announce({ kind: "correct", collectedCount: result.collectedCount });
        play("success");
        return;
      }
      announce({ kind: "wrong", penaltyCount: result.penaltyCount });
      play("penalty");
    }

    function end(): void {
      if (!running) return;

      running = false;
      clearGameLoopHandles(timers);
      const result = finishSinglePlayerMatch(match, bell);
      const resolved = result.pendingResolution.snapshot;
      bell = result.bellState;
      commit({ ...match, ...resolved, score: result.summary.score, scoreBreakdown: resolved.scoreBreakdown });
      patch({ phase: "finished", summary: result.summary });
    }

    return { start, ring, end, stop: () => clearGameLoopHandles(timers) };
  }, [pressBell]);

  useEffect(() => controls.stop, [controls]);

  return {
    state: { ...view, bellPressed },
    start: controls.start,
    ring: controls.ring,
    end: controls.end,
  };
}
