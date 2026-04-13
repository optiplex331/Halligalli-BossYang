import {
  COUNT_DISTRIBUTION,
  DEFAULT_SETTINGS,
  FRUIT_KEYS,
  INITIAL_BREAKDOWN,
  INITIAL_SUMMARY,
} from "./constants.js";

export function shuffle(cards) {
  const next = [...cards];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

export function createCard(serial, fruitKey, count) {
  return {
    id: `card-${serial}-${Math.random().toString(36).slice(2, 8)}`,
    fruit: fruitKey,
    count,
  };
}

export function createDeck(fruits, cardCount = 72) {
  const cards = [];
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
    const fruit = fruits[cards.length % fruits.length];
    const extraCounts = [1, 2, 3, 4];
    const count = extraCounts[cards.length % extraCounts.length];
    cards.push(createCard(serial, fruit.key, count));
    serial += 1;
  }

  return shuffle(cards.slice(0, cardCount));
}

export function getSeatLayouts(playerCount) {
  const layouts = {
    3: [
      { labelZh: "上家", labelEn: "Top", gridArea: "top" },
      { labelZh: "右侧玩家", labelEn: "Right", gridArea: "right" },
      { labelZh: "你", labelEn: "You", gridArea: "you", isUser: true },
    ],
    4: [
      { labelZh: "上家", labelEn: "Top", gridArea: "top" },
      { labelZh: "右侧玩家", labelEn: "Right", gridArea: "right" },
      { labelZh: "你", labelEn: "You", gridArea: "you", isUser: true },
      { labelZh: "左侧玩家", labelEn: "Left", gridArea: "left" },
    ],
    5: [
      { labelZh: "左上玩家", labelEn: "Upper Left", gridArea: "tl" },
      { labelZh: "右上玩家", labelEn: "Upper Right", gridArea: "tr" },
      { labelZh: "右侧玩家", labelEn: "Right", gridArea: "right" },
      { labelZh: "你", labelEn: "You", gridArea: "you", isUser: true },
      { labelZh: "左侧玩家", labelEn: "Left", gridArea: "left" },
    ],
    6: [
      { labelZh: "左上玩家", labelEn: "Upper Left", gridArea: "tl" },
      { labelZh: "上家", labelEn: "Top", gridArea: "top" },
      { labelZh: "右上玩家", labelEn: "Upper Right", gridArea: "tr" },
      { labelZh: "右侧玩家", labelEn: "Right", gridArea: "right" },
      { labelZh: "你", labelEn: "You", gridArea: "you", isUser: true },
      { labelZh: "左侧玩家", labelEn: "Left", gridArea: "left" },
    ],
  };

  return layouts[playerCount];
}

export function createPlayers(playerCount, fruits) {
  const deck = createDeck(fruits);
  const seats = getSeatLayouts(playerCount);
  const players = Array.from({ length: playerCount }, (_, index) => ({
    id: index,
    labelZh: seats[index].labelZh,
    labelEn: seats[index].labelEn,
    drawPile: [],
    wonPile: [],
    faceUpPile: [],
  }));

  deck.forEach((card, index) => {
    players[index % playerCount].drawPile.push(card);
  });

  return players;
}

export function getTopCard(player) {
  return player.faceUpPile[player.faceUpPile.length - 1] ?? null;
}

export function sumVisible(cards) {
  const totals = Object.fromEntries(FRUIT_KEYS.map((fruitKey) => [fruitKey, 0]));

  cards.forEach((card) => {
    if (card && Object.hasOwn(totals, card.fruit)) {
      totals[card.fruit] += card.count;
    }
  });

  return totals;
}

export function visibleTotals(players) {
  return sumVisible(players.map(getTopCard));
}

export function evaluateBellAvailability(players) {
  const totals = visibleTotals(players);
  const matchedFruit = Object.entries(totals).find(([, total]) => total === 5);

  return {
    available: Boolean(matchedFruit),
    fruitKey: matchedFruit?.[0] ?? null,
    totals,
  };
}

export function totalTableCards(players) {
  return players.reduce((total, player) => total + player.faceUpPile.length, 0);
}

export function recycleDrawPile(player) {
  if (player.drawPile.length || !player.wonPile.length) {
    return player;
  }

  return {
    ...player,
    drawPile: shuffle(player.wonPile),
    wonPile: [],
  };
}

export function flipCardForPlayer(player) {
  const ready = recycleDrawPile(player);

  if (!ready.drawPile.length) {
    return { player: ready, card: null };
  }

  const card = ready.drawPile[ready.drawPile.length - 1];

  return {
    player: {
      ...ready,
      drawPile: ready.drawPile.slice(0, -1),
      faceUpPile: [...ready.faceUpPile, card],
    },
    card,
  };
}

export function takePenaltyCards(player, count) {
  let nextPlayer = { ...player };
  const takenCards = [];

  while (takenCards.length < count) {
    nextPlayer = recycleDrawPile(nextPlayer);
    if (!nextPlayer.drawPile.length) {
      break;
    }

    const card = nextPlayer.drawPile[nextPlayer.drawPile.length - 1];
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

export function collectFaceUpCards(players, winnerId) {
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

export function calcAccuracy(correctHits, wrongHits, missedHits) {
  const total = correctHits + wrongHits + missedHits;
  return total ? correctHits / total : 0;
}

export function clonePlayers(players) {
  return players.map((player) => ({
    ...player,
    drawPile: [...player.drawPile],
    wonPile: [...player.wonPile],
    faceUpPile: [...player.faceUpPile],
  }));
}

export function sumBreakdown(breakdown) {
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

export function reconcilePendingBellWindow(snapshot, bellState) {
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
      scoreBreakdown: {
        ...(snapshot.scoreBreakdown ?? INITIAL_BREAKDOWN),
        missedPenalty:
          (snapshot.scoreBreakdown?.missedPenalty ?? INITIAL_BREAKDOWN.missedPenalty) + 30,
      },
    },
    missed: true,
    missedFruit: bellState.fruitKey,
  };
}

export function createRoundSummary(snapshot) {
  const safeSnapshot = {
    ...snapshot,
    scoreBreakdown: snapshot.scoreBreakdown ?? INITIAL_BREAKDOWN,
    reactionTimes: snapshot.reactionTimes ?? [],
  };
  const accuracy = calcAccuracy(
    safeSnapshot.correctHits,
    safeSnapshot.wrongHits,
    safeSnapshot.missedHits,
  );
  const avgReactionMs = safeSnapshot.reactionTimes.length
    ? Math.round(
        safeSnapshot.reactionTimes.reduce((total, time) => total + time, 0) /
          safeSnapshot.reactionTimes.length,
      )
    : 0;
  const bestReactionMs = safeSnapshot.reactionTimes.length
    ? Math.min(...safeSnapshot.reactionTimes)
    : 0;

  return {
    score: Math.max(0, sumBreakdown(safeSnapshot.scoreBreakdown)),
    correctHits: safeSnapshot.correctHits,
    wrongHits: safeSnapshot.wrongHits,
    missedHits: safeSnapshot.missedHits,
    accuracy,
    avgReactionMs,
    bestReactionMs,
    difficulty: safeSnapshot.difficulty ?? DEFAULT_SETTINGS.difficulty,
    durationSec: safeSnapshot.durationSec ?? DEFAULT_SETTINGS.duration,
    playerCount: safeSnapshot.playerCount ?? INITIAL_SUMMARY.playerCount,
  };
}
