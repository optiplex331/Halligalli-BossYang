/**
 * Monte Carlo simulation to analyze bell frequency for different card distributions.
 * Simulates thousands of games and reports average flips between bell opportunities.
 *
 * Usage: node scripts/simulate-bell.mjs
 */

const FRUIT_KEYS = ["banana", "strawberry", "lemon", "grape"];

function shuffle(cards) {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function createDeck(distribution) {
  const cards = [];
  let serial = 0;
  for (const fruitKey of FRUIT_KEYS) {
    for (const [count, repeat] of distribution) {
      for (let i = 0; i < repeat; i++) {
        cards.push({ id: serial++, fruit: fruitKey, count });
      }
    }
  }
  return shuffle(cards);
}

function simulateGame(distribution, playerCount, maxFlips = 200) {
  const deck = createDeck(distribution);
  const players = Array.from({ length: playerCount }, () => ({
    drawPile: [],
    faceUpPile: [],
  }));

  deck.forEach((card, i) => {
    players[i % playerCount].drawPile.push(card);
  });

  let flipsSinceBell = 0;
  let totalBells = 0;
  let totalFlipsBetweenBells = 0;
  let turn = 0;
  let totalFlips = 0;

  for (let flip = 0; flip < maxFlips; flip++) {
    const player = players[turn % playerCount];
    if (!player.drawPile.length) {
      turn++;
      continue;
    }

    const card = player.drawPile.pop();
    player.faceUpPile.push(card);
    totalFlips++;
    flipsSinceBell++;

    // Check bell: sum top cards
    const totals = {};
    for (const key of FRUIT_KEYS) totals[key] = 0;
    for (const p of players) {
      const top = p.faceUpPile[p.faceUpPile.length - 1];
      if (top) totals[top.fruit] += top.count;
    }

    const hasBell = Object.values(totals).some((v) => v === 5);
    if (hasBell) {
      totalBells++;
      totalFlipsBetweenBells += flipsSinceBell;
      flipsSinceBell = 0;
      // Simulate collection: clear all faceUpPiles
      for (const p of players) {
        p.faceUpPile = [];
      }
    }

    turn++;
  }

  return { totalBells, totalFlips, avgFlipsPerBell: totalBells > 0 ? totalFlipsBetweenBells / totalBells : Infinity };
}

function runSimulation(label, distribution, trials = 10000) {
  const deckSize = distribution.reduce((sum, [, repeat]) => sum + repeat, 0) * 4;
  console.log(`\n=== ${label} (${deckSize} cards) ===`);
  console.log(`  Distribution: ${distribution.map(([c, r]) => `${c}×${r}`).join(", ")}`);

  for (const playerCount of [3, 4, 5, 6]) {
    let totalBells = 0;
    let totalAvg = 0;
    let validTrials = 0;

    for (let i = 0; i < trials; i++) {
      const result = simulateGame(distribution, playerCount, 120);
      totalBells += result.totalBells;
      if (result.totalBells > 0) {
        totalAvg += result.avgFlipsPerBell;
        validTrials++;
      }
    }

    const avgBellsPerGame = totalBells / trials;
    const avgFlipsBetween = validTrials > 0 ? totalAvg / validTrials : "N/A";
    console.log(
      `  ${playerCount}P: avg ${avgBellsPerGame.toFixed(1)} bells/game, avg ${typeof avgFlipsBetween === "number" ? avgFlipsBetween.toFixed(1) : avgFlipsBetween} flips/bell`
    );
  }
}

// Current distribution
runSimulation("Current", [
  [1, 5], [2, 4], [3, 3], [4, 4], [5, 2],
]);

// Option A: More 2s, fewer 1s and 4s
runSimulation("Option A: more 2s", [
  [1, 4], [2, 5], [3, 4], [4, 3], [5, 2],
]);

// Option B: Flat mid-range
runSimulation("Option B: flat mid", [
  [1, 4], [2, 4], [3, 4], [4, 4], [5, 2],
]);

// Option C: Heavy on 2s and 3s (which combine to 5)
runSimulation("Option C: heavy 2+3", [
  [1, 3], [2, 5], [3, 5], [4, 3], [5, 2],
]);

// Option D: One more count-5
runSimulation("Option D: more 5s", [
  [1, 4], [2, 4], [3, 3], [4, 4], [5, 3],
]);

// Option E: Even more 5s and complementary pairs
runSimulation("Option E: more 5s + pairs", [
  [1, 3], [2, 4], [3, 4], [4, 4], [5, 3],
]);

// Option F: Maximize complementary pairs (1+4, 2+3)
runSimulation("Option F: max complement", [
  [1, 4], [2, 5], [3, 5], [4, 4], [5, 2],
]);

// Option G: aggressive bell frequency
runSimulation("Option G: aggressive", [
  [1, 3], [2, 5], [3, 5], [4, 3], [5, 3],
]);
