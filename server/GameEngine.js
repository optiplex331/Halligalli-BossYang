import {
  createPlayers,
  evaluateBellAvailability,
  flipCardForPlayer,
  collectFaceUpCards,
  takePenaltyCards,
  totalTableCards,
  clonePlayers,
  getTopCard,
  reconcilePendingBellWindow,
  createRoundSummary,
  calcAccuracy,
} from "../src/game/rules.js";
import { FRUIT_KEYS } from "../src/game/constants.js";

const FRUITS = [
  { key: "banana", label: "香蕉", labelEn: "banana", icon: "🍌" },
  { key: "strawberry", label: "草莓", labelEn: "strawberry", icon: "🍓" },
  { key: "lemon", label: "柠檬", labelEn: "lemon", icon: "🍋" },
  { key: "grape", label: "葡萄", labelEn: "grape", icon: "🍇" },
];

const MODES = {
  easy: { revealMs: 1850, scoreBonusWindow: 1900, isBoss: false },
  normal: { revealMs: 1400, scoreBonusWindow: 1500, isBoss: false },
  hard: { revealMs: 900, scoreBonusWindow: 1000, isBoss: true },
};

export class GameEngine {
  constructor(playerCount, difficulty, duration, onEvent) {
    this.playerCount = playerCount;
    this.difficulty = difficulty;
    this.duration = duration;
    this.mode = MODES[difficulty] ?? MODES.normal;
    this.onEvent = onEvent;

    this.players = null;
    this.currentTurn = 0;
    this.secondsLeft = duration;
    this.running = false;

    this.bellState = {
      available: false,
      fruitKey: null,
      startedAt: 0,
      handled: true,
    };

    // Per-player stats keyed by seatIndex
    this.playerStats = {};

    this._revealInterval = null;
    this._countdownInterval = null;
  }

  start() {
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

  _advanceTurn() {
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
    const { player, card } = flipCardForPlayer(preparedPlayers[actorIndex]);
    preparedPlayers[actorIndex] = player;

    const nextTurn = (actorIndex + 1) % preparedPlayers.length;
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

  handleBellPress(seatIndex) {
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

      const result = {
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
    const penaltyResult = takePenaltyCards(nextPlayers[seatIndex], penaltyTarget);
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

    const result = {
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

  finish() {
    if (!this.running) return null;
    this.running = false;
    clearInterval(this._revealInterval);
    clearInterval(this._countdownInterval);

    // Reconcile pending bell
    if (this.bellState.available && !this.bellState.handled) {
      for (const stats of Object.values(this.playerStats)) {
        stats.missedHits++;
        stats.scoreBreakdown.missedPenalty += 30;
        stats.score = Math.max(0, stats.score - 30);
      }
    }

    const results = {};
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

  destroy() {
    this.running = false;
    clearInterval(this._revealInterval);
    clearInterval(this._countdownInterval);
  }

  _getTopCards() {
    return this.players.map((p) => getTopCard(p));
  }

  _getStartPayload() {
    return {
      playerCount: this.playerCount,
      difficulty: this.difficulty,
      duration: this.duration,
      topCards: this._getTopCards(),
    };
  }
}
