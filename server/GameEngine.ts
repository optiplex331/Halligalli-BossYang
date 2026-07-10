import {
  createPlayers,
  evaluateBellAvailability,
  flipCardForPlayer,
  collectFaceUpCards,
  takePenaltyCards,
  totalTableCards,
  clonePlayers,
  getTopCard,
  calcAccuracy,
} from "../src/game/rules.js";
import { FRUITS, MODES } from "../src/game/catalog.js";
import type {
  BellState,
  Difficulty,
  PlayerState,
  ScoreBreakdown,
} from "../src/game/types.js";
import type { GameModeConfig } from "../src/game/catalog.js";
import type {
  CorrectBellResultPayload,
  GameBellResultPayload,
  GameEndPayload,
  GameFlipPayload,
  GameMissedPayload,
  GameStartPayload,
  GameTickPayload,
  MultiplayerResults,
  WrongBellResultPayload,
} from "../src/multiplayer/protocol.js";

interface PlayerStats {
  score: number;
  correctHits: number;
  wrongHits: number;
  missedHits: number;
  reactionTimes: number[];
  streak: number;
  scoreBreakdown: ScoreBreakdown;
}

type GameEngineStartPayload = Omit<GameStartPayload, "seatMap">;

interface GameEngineEventMap {
  "game:tick": GameTickPayload;
  "game:missed": GameMissedPayload;
  "game:flip": GameFlipPayload;
  "game:bell-result": GameBellResultPayload;
  "game:end": GameEndPayload;
}

type GameEngineEmitter = <EventName extends keyof GameEngineEventMap>(
  event: EventName,
  data: GameEngineEventMap[EventName],
) => void;

export class GameEngine {
  private mode: GameModeConfig;
  private players: PlayerState[] = [];
  private currentTurn = 0;
  private secondsLeft: number;
  private running = false;
  private bellState: BellState = {
    available: false,
    fruitKey: null,
    startedAt: 0,
    handled: true,
  };
  private playerStats: Record<number, PlayerStats> = {};
  private _revealInterval: ReturnType<typeof setInterval> | null = null;
  private _countdownInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private playerCount: number,
    private difficulty: Difficulty,
    private duration: number,
    private onEvent: GameEngineEmitter,
  ) {
    this.mode = MODES[difficulty] ?? MODES.normal;
    this.secondsLeft = duration;
  }

  start(): GameEngineStartPayload {
    this.players = createPlayers(this.playerCount, FRUITS);
    this.currentTurn = 0;
    this.secondsLeft = this.duration;
    this.running = true;

    for (let i = 0; i < this.playerCount; i++) {
      this.playerStats[i] = {
        score: 0,
        correctHits: 0,
        wrongHits: 0,
        missedHits: 0,
        reactionTimes: [],
        streak: 0,
        scoreBreakdown: {
          correctBase: 0,
          collectionBonus: 0,
          speedBonus: 0,
          streakBonus: 0,
          wrongPenalty: 0,
          missedPenalty: 0,
          cardPenalty: 0,
        },
      };
    }

    this.bellState = {
      available: false,
      fruitKey: null,
      startedAt: 0,
      handled: true,
    };

    // First flip immediately
    this._advanceTurn();

    this._revealInterval = setInterval(() => {
      this._advanceTurn();
    }, this.mode.revealMs);

    this._countdownInterval = setInterval(() => {
      this.secondsLeft--;
      this.onEvent("game:tick", { secondsLeft: this.secondsLeft });
      if (this.secondsLeft <= 0) {
        this.finish();
      }
    }, 1000);

    return this._getStartPayload();
  }

  private _advanceTurn(): void {
    if (!this.running) return;

    // Check missed bell from previous turn
    if (this.bellState.available && !this.bellState.handled) {
      const missedFruit = this.bellState.fruitKey;
      // All players get missed penalty (they all failed to ring)
      for (const stats of Object.values(this.playerStats)) {
        stats.missedHits++;
        stats.scoreBreakdown.missedPenalty += 30;
        stats.score = Math.max(0, stats.score - 30);
        stats.streak = 0;
      }
      this.onEvent("game:missed", { fruitKey: missedFruit });
    }

    const preparedPlayers = clonePlayers(this.players);
    const actorIndex = this.currentTurn;
    const actor = preparedPlayers[actorIndex];
    if (!actor) return;

    const { player, card } = flipCardForPlayer(actor);
    preparedPlayers[actorIndex] = player;

    const nextTurn = preparedPlayers.length ? (actorIndex + 1) % preparedPlayers.length : 0;
    this.players = preparedPlayers;
    this.currentTurn = nextTurn;

    // Check bell availability
    const evaluation = evaluateBellAvailability(preparedPlayers);
    if (evaluation.available) {
      this.bellState = {
        available: true,
        fruitKey: evaluation.fruitKey,
        startedAt: Date.now(),
        handled: false,
      };
    } else {
      this.bellState = {
        available: false,
        fruitKey: null,
        startedAt: 0,
        handled: true,
      };
    }

    this.onEvent("game:flip", {
      seatIndex: actorIndex,
      card,
      nextTurn,
      bellAvailable: evaluation.available,
      bellFruitKey: evaluation.fruitKey,
      topCards: this._getTopCards(),
    });
  }

  handleBellPress(seatIndex: number): GameBellResultPayload | null {
    if (!this.running) return null;

    const stats = this.playerStats[seatIndex];
    if (!stats) return null;

    if (this.bellState.available && !this.bellState.handled) {
      // Correct ring
      const reactionMs = Date.now() - this.bellState.startedAt;
      const { players: nextPlayers, collectedCount } = collectFaceUpCards(
        this.players,
        seatIndex,
      );

      const speedBonus = Math.max(
        0,
        Math.round((this.mode.scoreBonusWindow - reactionMs) / 20),
      );
      const streakBonus = stats.streak * 10;
      const earned = 120 + collectedCount * 6 + speedBonus + streakBonus;

      this.bellState.handled = true;
      this.players = nextPlayers;
      this.currentTurn = seatIndex;

      stats.correctHits++;
      stats.reactionTimes.push(reactionMs);
      stats.streak++;
      stats.score += earned;
      stats.scoreBreakdown.correctBase += 120;
      stats.scoreBreakdown.collectionBonus += collectedCount * 6;
      stats.scoreBreakdown.speedBonus += speedBonus;
      stats.scoreBreakdown.streakBonus += streakBonus;

      const result: CorrectBellResultPayload = {
        type: "correct",
        winnerId: seatIndex,
        collectedCount,
        reactionMs,
        earned,
        topCards: this._getTopCards(),
      };
      this.onEvent("game:bell-result", result);
      return result;
    }

    // Wrong ring
    const tableCount = totalTableCards(this.players);
    const penaltyTarget = Math.ceil(tableCount / 2);
    const nextPlayers = clonePlayers(this.players);
    const penaltyPlayer = nextPlayers[seatIndex];
    if (!penaltyPlayer) return null;

    const penaltyResult = takePenaltyCards(penaltyPlayer, penaltyTarget);
    nextPlayers[seatIndex] = penaltyResult.player;
    this.players = nextPlayers;

    const penalty = 50 + penaltyResult.penaltyCount * 4;
    stats.wrongHits++;
    stats.score = Math.max(0, stats.score - penalty);
    stats.streak = 0;
    stats.scoreBreakdown.wrongPenalty += 50;
    stats.scoreBreakdown.cardPenalty += penaltyResult.penaltyCount * 4;

    // Check bell availability after penalty cards changed
    const evaluation = evaluateBellAvailability(nextPlayers);
    if (evaluation.available) {
      this.bellState = {
        available: true,
        fruitKey: evaluation.fruitKey,
        startedAt: Date.now(),
        handled: false,
      };
    } else {
      this.bellState = {
        available: false,
        fruitKey: null,
        startedAt: 0,
        handled: true,
      };
    }

    const result: WrongBellResultPayload = {
      type: "wrong",
      playerId: seatIndex,
      penaltyCount: penaltyResult.penaltyCount,
      bellAvailable: evaluation.available,
      bellFruitKey: evaluation.fruitKey,
      topCards: this._getTopCards(),
    };
    this.onEvent("game:bell-result", result);
    return result;
  }

  finish(): MultiplayerResults | null {
    if (!this.running) return null;
    this.running = false;
    this.clearTimers();

    // Reconcile pending bell
    if (this.bellState.available && !this.bellState.handled) {
      for (const stats of Object.values(this.playerStats)) {
        stats.missedHits++;
        stats.scoreBreakdown.missedPenalty += 30;
        stats.score = Math.max(0, stats.score - 30);
      }
    }

    const results: MultiplayerResults = {};
    for (const [seatIndex, stats] of Object.entries(this.playerStats)) {
      const accuracy = calcAccuracy(stats.correctHits, stats.wrongHits, stats.missedHits);
      const avgReactionMs = stats.reactionTimes.length
        ? Math.round(stats.reactionTimes.reduce((a, b) => a + b, 0) / stats.reactionTimes.length)
        : 0;
      const bestReactionMs = stats.reactionTimes.length
        ? Math.min(...stats.reactionTimes)
        : 0;

      results[seatIndex] = {
        seatIndex: Number(seatIndex),
        score: Math.max(0, stats.score),
        correctHits: stats.correctHits,
        wrongHits: stats.wrongHits,
        missedHits: stats.missedHits,
        accuracy,
        avgReactionMs,
        bestReactionMs,
        scoreBreakdown: stats.scoreBreakdown,
      };
    }

    this.onEvent("game:end", { results });
    return results;
  }

  destroy(): void {
    this.running = false;
    this.clearTimers();
  }

  private clearTimers(): void {
    if (this._revealInterval) {
      clearInterval(this._revealInterval);
      this._revealInterval = null;
    }
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  private _getTopCards(): GameStartPayload["topCards"] {
    return this.players.map((p) => getTopCard(p));
  }

  private _getStartPayload(): GameEngineStartPayload {
    return {
      playerCount: this.playerCount,
      difficulty: this.difficulty,
      duration: this.duration,
      topCards: this._getTopCards(),
    };
  }
}
