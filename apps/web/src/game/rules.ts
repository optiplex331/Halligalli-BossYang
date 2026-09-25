import { COUNT_DISTRIBUTION, FRUIT_KEYS, MISSED_BELL_PENALTY } from "./constants.js";
import type {
  BellEvaluation,
  BellState,
  Card,
  FruitDefinition,
  FruitKey,
  PlayerState,
  RoundSnapshot,
  RoundSummary,
  ScoreBreakdown,
  VisibleTotals,
} from "./types.js";

export function shuffle<T>(cards: readonly T[]): T[] {
  const next = [...cards];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = next[index]!;
    next[index] = next[swapIndex]!;
    next[swapIndex] = current;
  }

  return next;
}

export function createCard(serial: number, fruitKey: FruitKey, count: number): Card {
  return {
    id: `card-${serial}-${Math.random().toString(36).slice(2, 8)}`,
    fruit: fruitKey,
    count,
  };
}

export function createDeck(fruits: readonly FruitDefinition[], cardCount = 72): Card[] {
  if (!fruits.length) {
    return [];
  }

  const cards: Card[] = [];
  let serial = 0;

  fruits.forEach((fruit) => {
    COUNT_DISTRIBUTION.forEach(([count, repeat]) => {
      for (let index = 0; index < repeat; index += 1) {
        cards.push(createCard(serial, fruit.key, count));
        serial += 1;
      }
    });
  });

  while (cards.length < cardCount) {
    const fruit = fruits[cards.length % fruits.length]!;
    const extraCounts = [1, 2, 3, 4];
    const count = extraCounts[cards.length % extraCounts.length]!;
    cards.push(createCard(serial, fruit.key, count));
    serial += 1;
  }

  return shuffle(cards.slice(0, cardCount));
}

const HUMAN_SEAT_INDEX: Readonly<Record<number, number>> = {
  4: 2,
  5: 3,
  6: 4,
  7: 0,
  8: 0,
};

export function getHumanSeatIndex(tableSeatCount: number): number | undefined {
  return Number.isInteger(tableSeatCount) ? HUMAN_SEAT_INDEX[tableSeatCount] : undefined;
}

export function createPlayers(tableSeatCount: number, fruits: readonly FruitDefinition[]): PlayerState[] {
  if (tableSeatCount <= 0) {
    return [];
  }

  const deck = createDeck(fruits);
  const humanSeatIndex = getHumanSeatIndex(tableSeatCount);
  if (humanSeatIndex === undefined) {
    throw new Error(`Unsupported Table Seat count: ${tableSeatCount}`);
  }

  const players: PlayerState[] = Array.from({ length: tableSeatCount }, (_, index) => {
    const isHuman = index === humanSeatIndex;
    return {
      id: index,
      isHuman,
      labelZh: isHuman ? "你" : `中立座位 ${index + 1}`,
      labelEn: isHuman ? "You" : `Neutral Seat ${index + 1}`,
      drawPile: [],
      wonPile: [],
      faceUpPile: [],
    };
  });

  deck.forEach((card, index) => {
    players[index % tableSeatCount]?.drawPile.push(card);
  });

  return players;
}

export function getTopCard(player: PlayerState): Card | null {
  return player.faceUpPile[player.faceUpPile.length - 1] ?? null;
}

export function sumVisible(cards: readonly (Card | null | undefined)[]): VisibleTotals {
  const totals = Object.fromEntries(FRUIT_KEYS.map((fruitKey) => [fruitKey, 0])) as VisibleTotals;

  cards.forEach((card) => {
    if (card) {
      totals[card.fruit] += card.count;
    }
  });

  return totals;
}

export function visibleTotals(players: readonly PlayerState[]): VisibleTotals {
  return sumVisible(players.map(getTopCard));
}

export function evaluateBellAvailability(players: readonly PlayerState[]): BellEvaluation {
  const totals = visibleTotals(players);
  const matchedFruit = FRUIT_KEYS.find((fruitKey) => totals[fruitKey] === 5) ?? null;

  return {
    available: matchedFruit !== null,
    fruitKey: matchedFruit,
    totals,
  };
}

export function totalTableCards(players: readonly PlayerState[]): number {
  return players.reduce((total, player) => total + player.faceUpPile.length, 0);
}

export function recycleDrawPile(player: PlayerState): PlayerState {
  if (player.drawPile.length || !player.wonPile.length) {
    return player;
  }

  return {
    ...player,
    drawPile: shuffle(player.wonPile),
    wonPile: [],
  };
}

export function flipCardForPlayer(player: PlayerState): { player: PlayerState; card: Card | null } {
  const ready = recycleDrawPile(player);

  if (!ready.drawPile.length) {
    return { player: ready, card: null };
  }

  const card = ready.drawPile[ready.drawPile.length - 1]!;

  return {
    player: {
      ...ready,
      drawPile: ready.drawPile.slice(0, -1),
      faceUpPile: [...ready.faceUpPile, card],
    },
    card,
  };
}

export function takePenaltyCards(
  player: PlayerState,
  count: number,
): { player: PlayerState; penaltyCount: number } {
  let nextPlayer = { ...player };
  const takenCards: Card[] = [];

  while (takenCards.length < count) {
    nextPlayer = recycleDrawPile(nextPlayer);
    if (!nextPlayer.drawPile.length) {
      break;
    }

    const card = nextPlayer.drawPile[nextPlayer.drawPile.length - 1]!;
    nextPlayer = {
      ...nextPlayer,
      drawPile: nextPlayer.drawPile.slice(0, -1),
    };
    takenCards.push(card);
  }

  return {
    player: {
      ...nextPlayer,
      faceUpPile: [...takenCards, ...nextPlayer.faceUpPile],
    },
    penaltyCount: takenCards.length,
  };
}

export function collectFaceUpCards(
  players: readonly PlayerState[],
  winnerId: number,
): { players: PlayerState[]; collectedCount: number } {
  const collectedCards = players.flatMap((player) => player.faceUpPile);

  return {
    players: players.map((player) =>
      player.id === winnerId
        ? {
            ...player,
            wonPile: [...player.wonPile, ...collectedCards],
            faceUpPile: [],
          }
        : {
            ...player,
            faceUpPile: [],
          },
    ),
    collectedCount: collectedCards.length,
  };
}

export function calcAccuracy(correctHits: number, wrongHits: number, missedHits: number): number {
  const total = correctHits + wrongHits + missedHits;
  return total ? correctHits / total : 0;
}

export function clonePlayers(players: readonly PlayerState[]): PlayerState[] {
  return players.map((player) => ({
    ...player,
    drawPile: [...player.drawPile],
    wonPile: [...player.wonPile],
    faceUpPile: [...player.faceUpPile],
  }));
}

export function sumBreakdown(breakdown: ScoreBreakdown): number {
  return (
    breakdown.correctBase +
    breakdown.collectionBonus +
    breakdown.speedBonus +
    breakdown.streakBonus -
    breakdown.wrongPenalty -
    breakdown.missedPenalty -
    breakdown.cardPenalty
  );
}

interface AssessedPenalty {
  wrongPenalty?: number;
  cardPenalty?: number;
  missedPenalty?: number;
}

export function applyScoringPenalty(
  breakdown: ScoreBreakdown,
  assessed: AssessedPenalty,
): ScoreBreakdown {
  let available = Math.max(0, sumBreakdown(breakdown));
  const wrongPenalty = Math.min(available, assessed.wrongPenalty ?? 0);
  available -= wrongPenalty;
  const cardPenalty = Math.min(available, assessed.cardPenalty ?? 0);
  available -= cardPenalty;
  const missedPenalty = Math.min(available, assessed.missedPenalty ?? 0);

  return {
    ...breakdown,
    wrongPenalty: breakdown.wrongPenalty + wrongPenalty,
    cardPenalty: breakdown.cardPenalty + cardPenalty,
    missedPenalty: breakdown.missedPenalty + missedPenalty,
  };
}

export function reconcilePendingBellWindow(
  snapshot: RoundSnapshot,
  bellState: BellState,
): { snapshot: RoundSnapshot; missed: boolean; missedFruit: FruitKey | null } {
  if (!bellState.available || bellState.handled || !bellState.fruitKey) {
    return {
      snapshot,
      missed: false,
      missedFruit: null,
    };
  }

  return {
    snapshot: {
      ...snapshot,
      missedHits: snapshot.missedHits + 1,
      scoreBreakdown: applyScoringPenalty(
        snapshot.scoreBreakdown,
        { missedPenalty: MISSED_BELL_PENALTY },
      ),
    },
    missed: true,
    missedFruit: bellState.fruitKey,
  };
}

export function createRoundSummary(snapshot: RoundSnapshot): RoundSummary {
  const scoreBreakdown = snapshot.scoreBreakdown;
  const reactionTimes = snapshot.reactionTimes;
  const accuracy = calcAccuracy(
    snapshot.correctHits,
    snapshot.wrongHits,
    snapshot.missedHits,
  );
  const avgReactionMs = reactionTimes.length
    ? Math.round(
        reactionTimes.reduce((total, time) => total + time, 0) /
          reactionTimes.length,
      )
    : 0;
  const bestReactionMs = reactionTimes.length
    ? Math.min(...reactionTimes)
    : 0;

  return {
    score: Math.max(0, sumBreakdown(scoreBreakdown)),
    correctHits: snapshot.correctHits,
    wrongHits: snapshot.wrongHits,
    missedHits: snapshot.missedHits,
    accuracy,
    avgReactionMs,
    bestReactionMs,
    difficulty: snapshot.difficulty,
    durationSec: snapshot.durationSec,
    tableSeatCount: snapshot.tableSeatCount,
  };
}
