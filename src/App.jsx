import { useEffect, useRef, useState } from "react";

const FRUITS = [
  { key: "banana", label: "香蕉", labelEn: "banana", icon: "🍌" },
  { key: "strawberry", label: "草莓", labelEn: "strawberry", icon: "🍓" },
  { key: "lemon", label: "柠檬", labelEn: "lemon", icon: "🍋" },
  { key: "grape", label: "葡萄", labelEn: "grape", icon: "🍇" },
];

const PIP_LAYOUTS = {
  1: ["center"],
  2: ["mid-left", "mid-right"],
  3: ["top-center", "center", "bottom-center"],
  4: ["top-left", "top-right", "bottom-left", "bottom-right"],
  5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
};

const SETTINGS_KEY = "halligalli_settings";
const BEST_KEY = "halligalli_best";
const RECENT_KEY = "halligalli_recent";

const DEFAULT_SETTINGS = {
  difficulty: "normal",
  duration: 60,
  playerCount: 4,
  language: "zh",
  soundEnabled: true,
};

const MODES = {
  easy: {
    label: "简单",
    labelEn: "Easy",
    revealMs: 1850,
    scoreBonusWindow: 1900,
  },
  normal: {
    label: "标准",
    labelEn: "Normal",
    revealMs: 1400,
    scoreBonusWindow: 1500,
  },
  hard: {
    label: "Boss模式",
    labelEn: "Boss Mode",
    revealMs: 900,
    scoreBonusWindow: 1000,
    isBoss: true,
  },
};

const BOSS_TAUNTS = {
  zh: [
    "Yang哥：全桌高呼五个水果，你居然把铃让成了传家宝！",
    "Yang哥：这不是漏拍，这是把胜利铺红毯送给下一位！",
    "Yang哥：铃就在你面前发光，你却演了一整段慢动作默剧！",
    "Yang哥：如此显眼的机会都能放生，今天的主角原来是后悔！",
    "Yang哥：下一位已经笑着接管牌桌了，你还在回味刚才那次发呆！",
  ],
  en: [
    "Boss Yang: The whole table screamed FIVE and you still let the bell become a museum piece!",
    "Boss Yang: That was not a miss. That was a ceremonial handoff of victory to the next player!",
    "Boss Yang: The bell was glowing in front of you and you answered with dramatic slow motion!",
    "Boss Yang: Missing something that obvious turns regret into the main character!",
    "Boss Yang: The next player is already taking over the table while you're still processing the disaster!",
  ],
};

const INITIAL_SUMMARY = {
  score: 0,
  correctHits: 0,
  wrongHits: 0,
  missedHits: 0,
  accuracy: 0,
  avgReactionMs: 0,
  bestReactionMs: 0,
  difficulty: DEFAULT_SETTINGS.difficulty,
  durationSec: DEFAULT_SETTINGS.duration,
  playerCount: DEFAULT_SETTINGS.playerCount,
};

const INITIAL_BREAKDOWN = {
  correctBase: 0,
  collectionBonus: 0,
  speedBonus: 0,
  streakBonus: 0,
  wrongPenalty: 0,
  missedPenalty: 0,
  cardPenalty: 0,
};

const COPY = {
  zh: {
    title: "更接近线下桌面的抢铃练习",
    heroRule: "顺时针翻牌，只看桌面最上层，出现刚好 5 个同类水果就抢铃",
    startIntro:
      "开局前先选人数、难度和局时。开局后页面会保持尽量简洁，只保留桌面、铃和必要提示。",
    start: "开始练习",
    settings: "开局设置",
    players: "参加人数",
    difficulty: "难度",
    duration: "局时",
    rules: "规则要点",
    rule1: "按顺时针轮流翻牌，新牌压住旧牌，旧牌立即失效。",
    rule2: "只计算每位玩家最上面的那张牌。",
    rule3: "某种水果总数恰好等于 5 时抢铃，抢到的人收走场上所有牌。",
    rule4: "错拍时，你要罚出场牌一半向上取整的牌，压到自己桌面底部。",
    seconds: "秒",
    timeLeft: "剩余 {seconds}s",
    endGame: "结束本局",
    finish: "本局完成",
    scoreUnit: "分",
    plusUnit: "+",
    minusUnit: "-",
    accuracy: "正确率",
    avgReaction: "平均反应",
    recent: "最近一局",
    best: "历史最佳",
    roundStats: "局内数据",
    history: "历史对比",
    correctHits: "正确拍铃",
    wrongHits: "错拍",
    missedHits: "漏拍",
    bestReaction: "最快反应",
    currentDifficulty: "当前难度",
    playAgain: "再来一局",
    backHome: "返回首页",
    idleObserve: "按顺时针依次翻牌，只有每位玩家最上面那张参与判定。",
    idleContinue: "继续观察桌面，只统计每位玩家最上面的那张牌。",
    startRound: "从第一位玩家开始，按顺时针翻牌。",
    missedBell: "漏拍了，刚才桌面上其实已经有 5 个{fruit}。",
    bellSuccess: "抢铃成功，收走场上 {count} 张牌，然后由你重新开始出牌。",
    bellPenalty: "错拍了，罚出 {count} 张牌压到你桌面的底部。",
    bellPenaltyNone: "错拍了，但你已经没有可罚出的暗牌了。",
    resultLine: "{players} 人局，正确率 {accuracy}%，平均反应 {avg} ms",
    lang: "语言",
    chinese: "中文",
    english: "English",
    you: "你",
    sound: "音效",
    soundOn: "开启",
    soundOff: "关闭",
    deckHint: "当前牌组采用平衡分布：小数量更常见，5 个水果最少见。",
    penaltyBanner: "惩罚：罚出 {count} 张牌",
    bossTitle: "Yang哥 Boss",
    bossSubtitle: "桌边的最终裁定者",
    bossDesc: "冷静盯场，不动声色地看你是不是会在那一瞬间抢对铃。",
    bossWatching: "Yang哥正在盯场",
    bossHint: "Boss模式下，Yang哥会在你漏拍后高调开嘲。",
    breakdownTitle: "算分回放",
    breakdownDesc: "这一局的每一分都在这里复盘。",
    scoreCorrectBase: "正确抢铃基础分",
    scoreCollectionBonus: "收牌奖励",
    scoreSpeedBonus: "反应速度奖励",
    scoreStreakBonus: "连击奖励",
    scoreWrongPenalty: "错拍惩罚",
    scoreMissedPenalty: "漏拍惩罚",
    scoreCardPenalty: "罚牌附加扣分",
    finalScore: "最终得分",
  },
  en: {
    title: "A More Table-Like Halligalli Practice",
    heroRule:
      "Flip cards clockwise, count only the top visible cards, ring when one fruit totals exactly 5",
    startIntro:
      "Choose player count, difficulty, and round length before starting. During play, the screen stays minimal: table, bell, and essential feedback only.",
    start: "Start",
    settings: "Setup",
    players: "Players",
    difficulty: "Difficulty",
    duration: "Duration",
    rules: "Rules",
    rule1: "Players flip cards clockwise. A new face-up card covers the old one immediately.",
    rule2: "Only the top face-up card of each player counts.",
    rule3: "If one fruit totals exactly 5, ring the bell. The winner takes all face-up cards.",
    rule4: "If you ring by mistake, you must pay half the table cards rounded up to your own pile.",
    seconds: "s",
    timeLeft: "{seconds}s left",
    endGame: "End Round",
    finish: "Round Complete",
    scoreUnit: "pts",
    plusUnit: "+",
    minusUnit: "-",
    accuracy: "Accuracy",
    avgReaction: "Avg reaction",
    recent: "Recent",
    best: "Best",
    roundStats: "Round Stats",
    history: "History",
    correctHits: "Correct rings",
    wrongHits: "Wrong rings",
    missedHits: "Missed chances",
    bestReaction: "Best reaction",
    currentDifficulty: "Difficulty",
    playAgain: "Play Again",
    backHome: "Back Home",
    idleObserve: "Cards flip clockwise. Only the top card of each player is counted.",
    idleContinue: "Keep watching the table. Only the top visible card of each player counts.",
    startRound: "The first player starts. Cards flip clockwise.",
    missedBell: "Missed it. There were already exactly 5 {fruit} on the table.",
    bellSuccess: "Successful ring. You take {count} table cards and start the next round.",
    bellPenalty: "Wrong ring. You pay {count} cards to the bottom of your face-up pile.",
    bellPenaltyNone: "Wrong ring, but you have no hidden cards left to pay.",
    resultLine: "{players}-player round, {accuracy}% accuracy, avg reaction {avg} ms",
    lang: "Language",
    chinese: "中文",
    english: "English",
    you: "You",
    sound: "Sound",
    soundOn: "On",
    soundOff: "Off",
    deckHint: "The current deck uses a balanced distribution: low counts are more common, 5s are rare.",
    penaltyBanner: "Penalty: pay {count} cards",
    bossTitle: "Boss Yang",
    bossSubtitle: "The table's final judge",
    bossDesc: "Calm, unreadable, and always watching whether you ring at exactly the right moment.",
    bossWatching: "Boss Yang is watching",
    bossHint: "In Boss Mode, Boss Yang goes loud only after you miss the bell.",
    breakdownTitle: "Score Breakdown",
    breakdownDesc: "Every point from the round, played back line by line.",
    scoreCorrectBase: "Correct ring base",
    scoreCollectionBonus: "Table card bonus",
    scoreSpeedBonus: "Speed bonus",
    scoreStreakBonus: "Streak bonus",
    scoreWrongPenalty: "Wrong ring penalty",
    scoreMissedPenalty: "Missed bell penalty",
    scoreCardPenalty: "Penalty card deduction",
    finalScore: "Final score",
  },
};

function loadJson(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadSettings() {
  const saved = loadJson(SETTINGS_KEY, DEFAULT_SETTINGS);
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
  };
}

function saveJson(key, value) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

function shuffle(cards) {
  const next = [...cards];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
}

function createCard(serial, fruitKey, count) {
  return {
    id: `card-${serial}-${Math.random().toString(36).slice(2, 8)}`,
    fruit: fruitKey,
    count,
  };
}

function createDeck(cardCount = 72) {
  const countDistribution = [
    [1, 5],
    [2, 4],
    [3, 3],
    [4, 4],
    [5, 2],
  ];
  const cards = [];
  let serial = 0;

  FRUITS.forEach((fruit) => {
    countDistribution.forEach(([count, repeat]) => {
      for (let index = 0; index < repeat; index += 1) {
        cards.push(createCard(serial, fruit.key, count));
        serial += 1;
      }
    });
  });

  while (cards.length < cardCount) {
    const fruit = FRUITS[cards.length % FRUITS.length];
    const extraCounts = [1, 2, 3, 4];
    const count = extraCounts[cards.length % extraCounts.length];
    cards.push(createCard(serial, fruit.key, count));
    serial += 1;
  }

  return shuffle(cards.slice(0, cardCount));
}

function getSeatLayouts(playerCount) {
  const layouts = {
    3: [
      { labelZh: "上家", labelEn: "Top", x: 50, y: 16 },
      { labelZh: "右侧玩家", labelEn: "Right", x: 80, y: 50 },
      { labelZh: "你", labelEn: "You", x: 50, y: 84, isUser: true },
    ],
    4: [
      { labelZh: "上家", labelEn: "Top", x: 50, y: 14 },
      { labelZh: "右侧玩家", labelEn: "Right", x: 84, y: 50 },
      { labelZh: "你", labelEn: "You", x: 50, y: 84, isUser: true },
      { labelZh: "左侧玩家", labelEn: "Left", x: 16, y: 50 },
    ],
    5: [
      { labelZh: "左上玩家", labelEn: "Upper Left", x: 28, y: 18 },
      { labelZh: "右上玩家", labelEn: "Upper Right", x: 72, y: 18 },
      { labelZh: "右侧玩家", labelEn: "Right", x: 86, y: 52 },
      { labelZh: "你", labelEn: "You", x: 50, y: 84, isUser: true },
      { labelZh: "左侧玩家", labelEn: "Left", x: 14, y: 52 },
    ],
    6: [
      { labelZh: "左上玩家", labelEn: "Upper Left", x: 28, y: 16 },
      { labelZh: "上家", labelEn: "Top", x: 50, y: 12 },
      { labelZh: "右上玩家", labelEn: "Upper Right", x: 72, y: 16 },
      { labelZh: "右侧玩家", labelEn: "Right", x: 85, y: 52 },
      { labelZh: "你", labelEn: "You", x: 50, y: 84, isUser: true },
      { labelZh: "左侧玩家", labelEn: "Left", x: 15, y: 52 },
    ],
  };

  return layouts[playerCount];
}

function createPlayers(playerCount) {
  const deck = createDeck();
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

function getTopCard(player) {
  return player.faceUpPile[player.faceUpPile.length - 1] ?? null;
}

function sumVisible(cards) {
  const totals = Object.fromEntries(FRUITS.map((fruit) => [fruit.key, 0]));

  cards.forEach((card) => {
    if (card) {
      totals[card.fruit] += card.count;
    }
  });

  return totals;
}

function visibleTotals(players) {
  return sumVisible(players.map(getTopCard));
}

function totalTableCards(players) {
  return players.reduce((total, player) => total + player.faceUpPile.length, 0);
}

function recycleDrawPile(player) {
  if (player.drawPile.length || !player.wonPile.length) {
    return player;
  }

  return {
    ...player,
    drawPile: shuffle(player.wonPile),
    wonPile: [],
  };
}

function flipCardForPlayer(player) {
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

function takePenaltyCards(player, count) {
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

function collectFaceUpCards(players, winnerId) {
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

function calcAccuracy(correctHits, wrongHits, missedHits) {
  const total = correctHits + wrongHits + missedHits;
  return total ? correctHits / total : 0;
}

function fruitLabel(fruitKey, language) {
  const fruit = FRUITS.find((item) => item.key === fruitKey);
  if (!fruit) {
    return "";
  }

  return language === "en" ? fruit.labelEn : fruit.label;
}

function clonePlayers(players) {
  return players.map((player) => ({
    ...player,
    drawPile: [...player.drawPile],
    wonPile: [...player.wonPile],
    faceUpPile: [...player.faceUpPile],
  }));
}

function modeLabel(modeKey, language) {
  const mode = MODES[modeKey];
  return language === "en" ? mode.labelEn : mode.label;
}

function sumBreakdown(breakdown) {
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

function FruitCardFace({ card, compact }) {
  if (!card) {
    return <div className="card-back" />;
  }

  const fruit = FRUITS.find((item) => item.key === card.fruit);
  const positions = PIP_LAYOUTS[card.count] ?? PIP_LAYOUTS[1];

  return (
    <div className="play-card-face">
      <div className={`play-card-pips count-${card.count} ${compact ? "compact" : ""}`}>
        {positions.map((slot, index) => (
          <span key={`${card.id}-${slot}-${index}`} className={`pip slot-${slot}`}>
            {fruit?.icon}
          </span>
        ))}
      </div>
    </div>
  );
}

function TableSeat({ player, seat, isActive, isCurrentTurn, language, compactCard }) {
  const topCard = getTopCard(player);
  const label = language === "en" ? player.labelEn : player.labelZh;

  return (
    <article
      className={isCurrentTurn ? "table-seat current-turn" : "table-seat"}
      style={{
        left: `${seat.x}%`,
        top: `${seat.y}%`,
      }}
    >
      <div className="seat-header">
        <span className="seat-label">{label}</span>
      </div>
      <div
        className={
          isCurrentTurn
            ? isActive
              ? "table-card-shell active current"
              : "table-card-shell current"
            : isActive
              ? "table-card-shell active"
              : "table-card-shell"
        }
      >
        <FruitCardFace card={topCard} compact={compactCard} />
      </div>
    </article>
  );
}

function App() {
  const [screen, setScreen] = useState("home");
  const [settings, setSettings] = useState(loadSettings);
  const [bestSummary, setBestSummary] = useState(() =>
    loadJson(BEST_KEY, INITIAL_SUMMARY),
  );
  const [recentSummary, setRecentSummary] = useState(() =>
    loadJson(RECENT_KEY, INITIAL_SUMMARY),
  );
  const [players, setPlayers] = useState(() => createPlayers(DEFAULT_SETTINGS.playerCount));
  const [currentTurn, setCurrentTurn] = useState(0);
  const [actingPlayer, setActingPlayer] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SETTINGS.duration);
  const [score, setScore] = useState(0);
  const [correctHits, setCorrectHits] = useState(0);
  const [wrongHits, setWrongHits] = useState(0);
  const [missedHits, setMissedHits] = useState(0);
  const [reactionTimes, setReactionTimes] = useState([]);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState({
    type: "idle",
    message: "按顺时针依次翻牌，只有每位玩家最上面那张参与判定。",
  });
  const [activeBellFruit, setActiveBellFruit] = useState(null);
  const [resultSummary, setResultSummary] = useState(INITIAL_SUMMARY);
  const [scoreBreakdown, setScoreBreakdown] = useState(INITIAL_BREAKDOWN);
  const [penaltyNotice, setPenaltyNotice] = useState("");
  const [bossTaunt, setBossTaunt] = useState("");
  const [bossDisrupting, setBossDisrupting] = useState(false);
  const [tauntEchoes, setTauntEchoes] = useState([]);

  const revealIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const penaltyTimeoutRef = useRef(null);
  const bossTauntTimeoutRef = useRef(null);
  const gameStateRef = useRef({});
  const gameRunningRef = useRef(false);
  const audioContextRef = useRef(null);
  const bellStateRef = useRef({
    available: false,
    fruitKey: null,
    startedAt: 0,
    handled: true,
  });

  const mode = MODES[settings.difficulty];
  const seatLayouts = getSeatLayouts(settings.playerCount);
  const userSeatId = seatLayouts.findIndex((seat) => seat.isUser);
  const copy = COPY[settings.language] ?? COPY.zh;
  const compactCard = settings.playerCount >= 5;

  function t(key, vars = {}) {
    return Object.entries(vars).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
      copy[key],
    );
  }

  useEffect(() => {
    saveJson(SETTINGS_KEY, settings);
  }, [settings]);

  useEffect(() => {
    gameStateRef.current = {
      players,
      currentTurn,
      actingPlayer,
      score,
      correctHits,
      wrongHits,
      missedHits,
      reactionTimes,
      scoreBreakdown,
      difficulty: settings.difficulty,
      durationSec: settings.duration,
      playerCount: settings.playerCount,
      userSeatId,
    };
  }, [
    correctHits,
    actingPlayer,
    currentTurn,
    missedHits,
    players,
    reactionTimes,
    score,
    scoreBreakdown,
    settings,
    userSeatId,
    wrongHits,
  ]);

  useEffect(() => {
    function onKeyDown(event) {
      if (screen === "play" && event.code === "Space") {
        event.preventDefault();
        handleBell();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, streak, settings.difficulty, settings.playerCount]);

  useEffect(() => () => stopGameLoops(), []);

  function stopGameLoops() {
    window.clearInterval(revealIntervalRef.current);
    window.clearInterval(countdownIntervalRef.current);
    window.clearTimeout(feedbackTimeoutRef.current);
    window.clearTimeout(penaltyTimeoutRef.current);
    window.clearTimeout(bossTauntTimeoutRef.current);
  }

  function updateFeedback(type, message) {
    setFeedback({ type, message });
    window.clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback({
        type: "idle",
        message: t("idleContinue"),
      });
    }, 1200);
  }

  function applyBellAvailability(nextPlayers) {
    const totals = visibleTotals(nextPlayers);
    const matchedFruit = Object.entries(totals).find(([, total]) => total === 5);

    if (matchedFruit) {
      bellStateRef.current = {
        available: true,
        fruitKey: matchedFruit[0],
        startedAt: Date.now(),
        handled: false,
      };
      setActiveBellFruit(matchedFruit[0]);
      return;
    }

    bellStateRef.current = {
      available: false,
      fruitKey: null,
      startedAt: 0,
      handled: true,
    };
    setActiveBellFruit(null);
  }

  function ensureAudioContext() {
    if (typeof window === "undefined" || !settings.soundEnabled) {
      return null;
    }

    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        return null;
      }
      audioContextRef.current = new AudioContextClass();
    }

    if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().catch(() => {});
    }

    return audioContextRef.current;
  }

  function playTone({ frequency, duration = 0.12, type = "sine", gain = 0.04, delay = 0 }) {
    const context = ensureAudioContext();
    if (!context) {
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    const startAt = context.currentTime + delay;
    const endAt = startAt + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gainNode.gain.setValueAtTime(0.0001, startAt);
    gainNode.gain.exponentialRampToValueAtTime(gain, startAt + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt);

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(endAt);
  }

  function playFeedbackSound(kind) {
    if (!settings.soundEnabled) {
      return;
    }

    if (kind === "success") {
      playTone({ frequency: 740, duration: 0.08, type: "triangle", gain: 0.035 });
      playTone({ frequency: 988, duration: 0.12, type: "triangle", gain: 0.04, delay: 0.08 });
      return;
    }

    if (kind === "warn") {
      playTone({ frequency: 360, duration: 0.12, type: "sine", gain: 0.03 });
      playTone({ frequency: 300, duration: 0.14, type: "sine", gain: 0.028, delay: 0.12 });
      return;
    }

    if (kind === "penalty") {
      playTone({ frequency: 220, duration: 0.12, type: "sawtooth", gain: 0.035 });
      playTone({ frequency: 180, duration: 0.14, type: "sawtooth", gain: 0.035, delay: 0.1 });
      playTone({ frequency: 140, duration: 0.18, type: "sawtooth", gain: 0.04, delay: 0.22 });
    }
  }

  function triggerBossTaunt(forceMessage) {
    if (!mode.isBoss) {
      return;
    }

    const taunts = BOSS_TAUNTS[settings.language] ?? BOSS_TAUNTS.zh;
    const message = forceMessage ?? taunts[Math.floor(Math.random() * taunts.length)];
    const echoSeed = Date.now();
    setBossTaunt(message);
    setBossDisrupting(true);
    setTauntEchoes((current) => [
      ...current.slice(-5),
      ...Array.from({ length: 3 }, (_, index) => ({
        id: `${echoSeed}-${index}`,
        text: message,
        x: 12 + ((echoSeed + index * 17) % 62),
        y: 18 + ((echoSeed + index * 29) % 56),
        rotation: -14 + ((echoSeed + index * 11) % 28),
      })),
    ]);
    window.clearTimeout(bossTauntTimeoutRef.current);
    bossTauntTimeoutRef.current = window.setTimeout(() => {
      setBossTaunt("");
      setBossDisrupting(false);
      setTauntEchoes((current) => current.slice(-3));
    }, 1700);
  }

  function showPenalty(count) {
    setPenaltyNotice(t("penaltyBanner", { count }));
    window.clearTimeout(penaltyTimeoutRef.current);
    penaltyTimeoutRef.current = window.setTimeout(() => {
      setPenaltyNotice("");
    }, 1500);
  }

  function advanceTurn(basePlayers = gameStateRef.current.players, baseTurn = gameStateRef.current.currentTurn) {
    if (!gameRunningRef.current) {
      return;
    }

    const preparedPlayers = clonePlayers(basePlayers);

    if (bellStateRef.current.available && !bellStateRef.current.handled) {
      const missedFruit = bellStateRef.current.fruitKey;
      setMissedHits((value) => value + 1);
      setScore((value) => Math.max(0, value - 30));
      setScoreBreakdown((value) => ({
        ...value,
        missedPenalty: value.missedPenalty + 30,
      }));
      setStreak(0);
      updateFeedback("warn", t("missedBell", { fruit: fruitLabel(missedFruit, settings.language) }));
      playFeedbackSound("warn");
      triggerBossTaunt();
    }

    const actorIndex = baseTurn;
    const actor = preparedPlayers[actorIndex];
    const { player } = flipCardForPlayer(actor);
    preparedPlayers[actorIndex] = player;

    const nextTurn = (actorIndex + 1) % preparedPlayers.length;

    setPlayers(preparedPlayers);
    setActingPlayer(actorIndex);
    setCurrentTurn(nextTurn);
    applyBellAvailability(preparedPlayers);

  }

  function startGame() {
    stopGameLoops();
    gameRunningRef.current = true;

    const freshPlayers = createPlayers(settings.playerCount);

    setPlayers(freshPlayers);
    setCurrentTurn(0);
    setActingPlayer(0);
    setSecondsLeft(settings.duration);
    setScore(0);
    setCorrectHits(0);
    setWrongHits(0);
    setMissedHits(0);
    setReactionTimes([]);
    setStreak(0);
    setActiveBellFruit(null);
    setScoreBreakdown(INITIAL_BREAKDOWN);
    setPenaltyNotice("");
    setBossTaunt("");
    setBossDisrupting(false);
    setTauntEchoes([]);
    setFeedback({
      type: "idle",
      message: t("startRound"),
    });
    bellStateRef.current = {
      available: false,
      fruitKey: null,
      startedAt: 0,
      handled: true,
    };
    setScreen("play");

    setTimeout(() => {
      gameStateRef.current = {
        players: freshPlayers,
        currentTurn: 0,
        actingPlayer: 0,
        score: 0,
        scoreBreakdown: INITIAL_BREAKDOWN,
        correctHits: 0,
        wrongHits: 0,
        missedHits: 0,
        reactionTimes: [],
        difficulty: settings.difficulty,
        durationSec: settings.duration,
        playerCount: settings.playerCount,
        userSeatId,
      };
      advanceTurn(freshPlayers, 0);
    }, 0);

    revealIntervalRef.current = window.setInterval(() => {
      const snapshot = gameStateRef.current;
      advanceTurn(snapshot.players, snapshot.currentTurn);
    }, mode.revealMs);

    countdownIntervalRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          finishGame();
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  function handleBell() {
    if (screen !== "play" || !gameRunningRef.current) {
      return;
    }

    const snapshot = gameStateRef.current;
    const bell = bellStateRef.current;

    if (bell.available && !bell.handled) {
      const reactionMs = Date.now() - bell.startedAt;
      const { players: nextPlayers, collectedCount } = collectFaceUpCards(
        snapshot.players,
        snapshot.userSeatId,
      );
      const speedBonus = Math.max(
        0,
        Math.round((mode.scoreBonusWindow - reactionMs) / 20),
      );
      const streakBonus = streak * 10;
      const earned = 120 + collectedCount * 6 + speedBonus + streakBonus;

      bellStateRef.current = {
        ...bell,
        handled: true,
      };
      setPlayers(nextPlayers);
      setCurrentTurn(snapshot.userSeatId);
      setActingPlayer(snapshot.userSeatId);
      setActiveBellFruit(null);
      setScore((value) => value + earned);
      setScoreBreakdown((value) => ({
        ...value,
        correctBase: value.correctBase + 120,
        collectionBonus: value.collectionBonus + collectedCount * 6,
        speedBonus: value.speedBonus + speedBonus,
        streakBonus: value.streakBonus + streakBonus,
      }));
      setCorrectHits((value) => value + 1);
      setReactionTimes((value) => [...value, reactionMs]);
      setStreak((value) => value + 1);
      updateFeedback(
        "success",
        t("bellSuccess", { count: collectedCount }),
      );
      playFeedbackSound("success");
      applyBellAvailability(nextPlayers);
      return;
    }

    const tableCount = totalTableCards(snapshot.players);
    const penaltyTarget = Math.ceil(tableCount / 2);
    const nextPlayers = clonePlayers(snapshot.players);
    const penaltyResult = takePenaltyCards(nextPlayers[snapshot.userSeatId], penaltyTarget);

    nextPlayers[snapshot.userSeatId] = penaltyResult.player;

    setPlayers(nextPlayers);
    setWrongHits((value) => value + 1);
    setScore((value) => Math.max(0, value - 50 - penaltyResult.penaltyCount * 4));
    setScoreBreakdown((value) => ({
      ...value,
      wrongPenalty: value.wrongPenalty + 50,
      cardPenalty: value.cardPenalty + penaltyResult.penaltyCount * 4,
    }));
    setStreak(0);
    updateFeedback(
      "error",
      penaltyResult.penaltyCount
        ? t("bellPenalty", { count: penaltyResult.penaltyCount })
        : t("bellPenaltyNone"),
    );
    if (penaltyResult.penaltyCount) {
      showPenalty(penaltyResult.penaltyCount);
    }
    playFeedbackSound("penalty");
    applyBellAvailability(nextPlayers);
  }

  function finishGame() {
    if (!gameRunningRef.current) {
      return;
    }

    gameRunningRef.current = false;
    stopGameLoops();
    const snapshot = gameStateRef.current;

    const accuracy = calcAccuracy(
      snapshot.correctHits,
      snapshot.wrongHits,
      snapshot.missedHits,
    );
    const avgReactionMs = snapshot.reactionTimes.length
      ? Math.round(
          snapshot.reactionTimes.reduce((total, time) => total + time, 0) /
            snapshot.reactionTimes.length,
        )
      : 0;
    const bestReactionMs = snapshot.reactionTimes.length
      ? Math.min(...snapshot.reactionTimes)
      : 0;

    const summary = {
      score: Math.max(0, sumBreakdown(snapshot.scoreBreakdown ?? INITIAL_BREAKDOWN)),
      correctHits: snapshot.correctHits,
      wrongHits: snapshot.wrongHits,
      missedHits: snapshot.missedHits,
      accuracy,
      avgReactionMs,
      bestReactionMs,
      difficulty: snapshot.difficulty,
      durationSec: snapshot.durationSec,
      playerCount: snapshot.playerCount,
    };

    setResultSummary(summary);
    setScoreBreakdown(snapshot.scoreBreakdown ?? INITIAL_BREAKDOWN);
    setScore(summary.score);
    setRecentSummary(summary);
    saveJson(RECENT_KEY, summary);

    if (summary.score >= bestSummary.score) {
      setBestSummary(summary);
      saveJson(BEST_KEY, summary);
    }

    setScreen("result");
  }

  function updateSetting(key, value) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  const totals = visibleTotals(players);
  const breakdownRows = [
    { key: "correctBase", label: t("scoreCorrectBase"), value: scoreBreakdown.correctBase, positive: true },
    { key: "collectionBonus", label: t("scoreCollectionBonus"), value: scoreBreakdown.collectionBonus, positive: true },
    { key: "speedBonus", label: t("scoreSpeedBonus"), value: scoreBreakdown.speedBonus, positive: true },
    { key: "streakBonus", label: t("scoreStreakBonus"), value: scoreBreakdown.streakBonus, positive: true },
    { key: "wrongPenalty", label: t("scoreWrongPenalty"), value: scoreBreakdown.wrongPenalty, positive: false },
    { key: "missedPenalty", label: t("scoreMissedPenalty"), value: scoreBreakdown.missedPenalty, positive: false },
    { key: "cardPenalty", label: t("scoreCardPenalty"), value: scoreBreakdown.cardPenalty, positive: false },
  ].filter((item) => item.value > 0);

  return (
    <main className="app-shell">
      <section className="app-panel">
        <header className="hero">
          <div>
            <p className="eyebrow">Halligalli Practice</p>
            <h1>{t("title")}</h1>
          </div>
          <div className="hero-rule">{t("heroRule")}</div>
        </header>

        {screen === "home" && (
          <section className="stack">
            <div className="card intro">
              <p>{t("startIntro")}</p>
              <div className="button-row">
                <button className="primary-button" onClick={startGame}>
                  {t("start")}
                </button>
              </div>
            </div>

            <div className="boss-card">
              <div className="boss-portrait-wrap">
                <img className="boss-portrait" src="/yang-boss.png" alt={t("bossTitle")} />
              </div>
              <div className="boss-copy">
                <p className="boss-kicker">BOSS</p>
                <h2>{t("bossTitle")}</h2>
                <p className="boss-subtitle">{t("bossSubtitle")}</p>
                <p>{t("bossDesc")}</p>
                <p className="boss-mode-hint">{t("bossHint")}</p>
              </div>
            </div>

            <div className="grid two-up">
              <div className="card">
                <h2>{t("settings")}</h2>
                <div className="control-group">
                  <span>{t("lang")}</span>
                  <div className="chip-row">
                    <button
                      className={settings.language === "zh" ? "chip active" : "chip"}
                      onClick={() => updateSetting("language", "zh")}
                    >
                      {t("chinese")}
                    </button>
                    <button
                      className={settings.language === "en" ? "chip active" : "chip"}
                      onClick={() => updateSetting("language", "en")}
                    >
                      {t("english")}
                    </button>
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("sound")}</span>
                  <div className="chip-row">
                    <button
                      className={settings.soundEnabled ? "chip active" : "chip"}
                      onClick={() => updateSetting("soundEnabled", true)}
                    >
                      {t("soundOn")}
                    </button>
                    <button
                      className={!settings.soundEnabled ? "chip active" : "chip"}
                      onClick={() => updateSetting("soundEnabled", false)}
                    >
                      {t("soundOff")}
                    </button>
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("players")}</span>
                  <div className="chip-row">
                    {[3, 4, 5, 6].map((count) => (
                      <button
                        key={count}
                        className={count === settings.playerCount ? "chip active" : "chip"}
                        onClick={() => updateSetting("playerCount", count)}
                      >
                        {settings.language === "en" ? `${count}P` : `${count} 人`}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("difficulty")}</span>
                  <div className="chip-row">
                    {Object.entries(MODES).map(([key, item]) => (
                      <button
                        key={key}
                        className={key === settings.difficulty ? "chip active" : "chip"}
                        onClick={() => updateSetting("difficulty", key)}
                      >
                        {modeLabel(key, settings.language)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("duration")}</span>
                  <div className="chip-row">
                    {[45, 60, 90].map((duration) => (
                      <button
                        key={duration}
                        className={duration === settings.duration ? "chip active" : "chip"}
                        onClick={() => updateSetting("duration", duration)}
                      >
                        {duration} {t("seconds")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card">
                <h2>{t("rules")}</h2>
                <ol className="rule-list">
                  <li>{t("rule1")}</li>
                  <li>{t("rule2")}</li>
                  <li>{t("rule3")}</li>
                  <li>{t("rule4")}</li>
                </ol>
                <p className="deck-note">{t("deckHint")}</p>
              </div>
            </div>
          </section>
        )}

        {screen === "play" && (
          <section className="stack">
            <div className="play-topbar minimal">
              <div className="pill">{t("timeLeft", { seconds: secondsLeft })}</div>
              <button className="ghost-button" onClick={finishGame}>
                {t("endGame")}
              </button>
            </div>

            <div className={`feedback ${feedback.type}`}>{feedback.message}</div>
            {penaltyNotice && <div className="penalty-banner">{penaltyNotice}</div>}

            <div className={`table-scene players-${settings.playerCount}`}>
              <div className={bossDisrupting ? "table-felt boss-disrupting" : "table-felt"}>
                <div className="taunt-wall" aria-hidden="true">
                  {tauntEchoes.map((echo) => (
                    <span
                      key={echo.id}
                      className="taunt-echo"
                      style={{
                        left: `${echo.x}%`,
                        top: `${echo.y}%`,
                        transform: `translate(-50%, -50%) rotate(${echo.rotation}deg)`,
                      }}
                    >
                      {echo.text}
                    </span>
                  ))}
                </div>
                <div className="boss-presence">
                  <img className="boss-presence-avatar" src="/yang-boss.png" alt={t("bossTitle")} />
                  <span>{t("bossWatching")}</span>
                </div>
                {bossTaunt && <div className="boss-taunt">{bossTaunt}</div>}
                {seatLayouts.map((seat, index) => {
                  const player = players[index];
                  const topCard = getTopCard(player);
                  const isActive =
                    activeBellFruit &&
                    topCard &&
                    topCard.fruit === activeBellFruit &&
                    totals[activeBellFruit] === 5;

                  return (
                    <TableSeat
                      key={`${seat.label}-${index}`}
                      player={player}
                      seat={seat}
                      isActive={Boolean(isActive)}
                      isCurrentTurn={actingPlayer === index}
                      language={settings.language}
                      compactCard={compactCard}
                    />
                  );
                })}

                <div className={activeBellFruit ? "center-bell is-ready" : "center-bell"}>
                  <button className="bell-button" onClick={handleBell}>
                    铃
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === "result" && (
          <section className="stack">
            <div className="card result-hero">
              <p className="eyebrow">{t("finish")}</p>
              <h2>
                {resultSummary.score} {t("scoreUnit")}
              </h2>
              <p>
                {t("resultLine", {
                  players: resultSummary.playerCount,
                  accuracy: Math.round(resultSummary.accuracy * 100),
                  avg: resultSummary.avgReactionMs || "-",
                })}
              </p>
            </div>

            <div className="grid two-up">
              <div className="card">
                <h2>{t("roundStats")}</h2>
                <dl className="stats-list">
                  <div>
                    <dt>{t("correctHits")}</dt>
                    <dd>{resultSummary.correctHits}</dd>
                  </div>
                  <div>
                    <dt>{t("wrongHits")}</dt>
                    <dd>{resultSummary.wrongHits}</dd>
                  </div>
                  <div>
                    <dt>{t("missedHits")}</dt>
                    <dd>{resultSummary.missedHits}</dd>
                  </div>
                  <div>
                    <dt>{t("bestReaction")}</dt>
                    <dd>{resultSummary.bestReactionMs || "-"} ms</dd>
                  </div>
                </dl>
              </div>

              <div className="card">
                <h2>{t("history")}</h2>
                <dl className="stats-list">
                  <div>
                    <dt>{t("best")}</dt>
                    <dd>{bestSummary.score}</dd>
                  </div>
                  <div>
                    <dt>{t("currentDifficulty")}</dt>
                    <dd>{modeLabel(resultSummary.difficulty, settings.language)}</dd>
                  </div>
                  <div>
                    <dt>{t("duration")}</dt>
                    <dd>
                      {resultSummary.durationSec} {t("seconds")}
                    </dd>
                  </div>
                  <div>
                    <dt>{t("recent")}</dt>
                    <dd>{recentSummary.score}</dd>
                  </div>
                </dl>
              </div>
            </div>

            <div className="button-row">
              <button className="primary-button" onClick={startGame}>
                {t("playAgain")}
              </button>
              <button className="ghost-button" onClick={() => setScreen("home")}>
                {t("backHome")}
              </button>
            </div>

            <section className="score-reel">
              <div className="score-reel-head">
                <h2>{t("breakdownTitle")}</h2>
                <p>{t("breakdownDesc")}</p>
              </div>
              <div className="score-reel-list">
                {breakdownRows.map((item, index) => (
                  <div
                    key={item.key}
                    className={item.positive ? "score-row positive" : "score-row negative"}
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <span>{item.label}</span>
                    <strong>
                      {item.positive ? t("plusUnit") : t("minusUnit")}
                      {item.value}
                    </strong>
                  </div>
                ))}
                <div className="score-row total" style={{ animationDelay: `${breakdownRows.length * 120}ms` }}>
                  <span>{t("finalScore")}</span>
                  <strong>{resultSummary.score}</strong>
                </div>
              </div>
            </section>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
