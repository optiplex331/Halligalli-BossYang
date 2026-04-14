import { useEffect, useRef, useState } from "react";
import {
  ACHIEVEMENT_KEYS,
  DAILY_TARGET_ROUNDS,
  DEFAULT_SETTINGS,
  INITIAL_BREAKDOWN,
  INITIAL_SUMMARY,
} from "./game/constants";
import {
  BEST_KEY,
  RECENT_KEY,
  SETTINGS_KEY,
  appendHistoryEntry,
  loadAchievements,
  loadBestSummary,
  loadDailyGoal,
  loadHistory,
  loadRecentSummary,
  loadSettings,
  normalizeSummary,
  saveJson,
  saveDailyGoal,
  unlockAchievement,
} from "./game/persistence";
import {
  computeDailyGoalStreak,
  computeRollingAccuracy,
  computeReactionTrend,
} from "./game/stats.js";
import {
  calcAccuracy,
  clonePlayers,
  collectFaceUpCards,
  createRoundSummary,
  createPlayers,
  evaluateBellAvailability,
  flipCardForPlayer,
  getSeatLayouts,
  getTopCard,
  reconcilePendingBellWindow,
  sumBreakdown,
  takePenaltyCards,
  totalTableCards,
  visibleTotals,
} from "./game/rules";
import { clearGameLoopHandles } from "./game/lifecycle";
import { connectSocket, disconnectSocket, getSocket } from "./multiplayer/socket";
import { useMultiplayerSocket } from "./multiplayer/useMultiplayerSocket";
import { useAudioEngine } from "./audio/useAudioEngine";

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

const COPY = {
  zh: {
    title: "更接近线下桌面的抢铃练习",
    heroRule: "顺时针翻牌，只看桌面最上层，出现刚好 5 个同类水果就抢铃",
    startIntro:
      "单人训练：调好设置直接开打，边练手速边磨判断力。多人对局：创建房间分享匹配码，和朋友同桌抢铃。",
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
    historyTitle: "训练记录",
    historyDesc: "最近 5 局的成绩，攒够数据后会出现趋势图。",
    historyEmpty: "还没有完整对局，开一局把第一条数据填上。",
    historyHeaderScore: "得分",
    historyHeaderAccuracy: "正确率",
    historyHeaderReaction: "平均反应",
    historyModeSolo: "单人",
    historyModeMulti: "多人",
    historyJustNow: "刚刚",
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
    deckHint: "当前牌组采用优化分布：2 和 3 最常见，更容易凑出 5 的组合。",
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
    createRoom: "创建房间",
    joinRoom: "加入房间",
    roomCode: "房间码",
    enterCode: "输入房间码",
    waitingPlayers: "等待玩家加入…",
    ready: "准备",
    cancelReady: "取消准备",
    startMatch: "开始对局",
    leaveLobby: "离开房间",
    host: "房主",
    playerSlot: "玩家 {n}",
    notReady: "未准备",
    readyStatus: "已准备",
    roomFull: "房间已满",
    roomNotFound: "房间不存在",
    connecting: "连接中…",
    disconnected: "连接断开",
    needReady: "还有玩家未准备",
    multiplayerTitle: "多人对局",
    multiplayerDesc: "通过匹配码与好友实时对战",
    orText: "或",
    rank: "排名",
    playerName: "玩家",
    multiResult: "对局结束",
    bellReady: "抢铃 — {fruit}已凑齐5个",
    bellWait: "抢铃（等待时机）",
    tabRecent: "近期",
    tabTrend: "趋势",
    tabAchievements: "成就",
    dailyGoalLabel: "今日目标",
    dailyProgress: "{done}/{target} 局",
    dailyDone: "今日目标完成 ✓",
    trendAccuracyLabel: "准确率（%）",
    trendReactionLabel: "反应时间（ms）",
    trendNoData: "连续 3 天有记录后解锁趋势图",
    achievementFirstWin: "首局完成",
    achievementFirstWinDesc: "完成一局练习",
    achievementStreak5: "5 连击",
    achievementStreak5Desc: "单局连续正确抢铃 5 次",
    achievementPerfectRound: "完美一局",
    achievementPerfectRoundDesc: "单局零错误、零漏拍",
    achievementSub200ms: "极速反应",
    achievementSub200msDesc: "平均反应时间 ≤ 200ms",
    achievementDaily3: "三日连击",
    achievementDaily3Desc: "连续 3 天完成今日目标（{target} 局）",
    achievementToast: "成就解锁：{name}",
  },
  en: {
    title: "A More Table-Like Halligalli Practice",
    heroRule:
      "Flip cards clockwise, count only the top visible cards, ring when one fruit totals exactly 5",
    startIntro:
      "Solo training: tweak the settings and jump straight in to sharpen your reflexes and judgment. Multiplayer: create a room, share the code, and race your friends to the bell.",
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
    historyTitle: "Training log",
    historyDesc: "Your last 5 rounds. Keep going to unlock trend charts.",
    historyEmpty: "No completed rounds yet — play one to seed your log.",
    historyHeaderScore: "Score",
    historyHeaderAccuracy: "Accuracy",
    historyHeaderReaction: "Avg reaction",
    historyModeSolo: "Solo",
    historyModeMulti: "Multi",
    historyJustNow: "Just now",
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
    deckHint: "The deck is optimized: 2s and 3s are most common, making complementary 5-combos more frequent.",
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
    createRoom: "Create Room",
    joinRoom: "Join Room",
    roomCode: "Room Code",
    enterCode: "Enter room code",
    waitingPlayers: "Waiting for players…",
    ready: "Ready",
    cancelReady: "Unready",
    startMatch: "Start Match",
    leaveLobby: "Leave Room",
    host: "Host",
    playerSlot: "Player {n}",
    notReady: "Not ready",
    readyStatus: "Ready",
    roomFull: "Room is full",
    roomNotFound: "Room not found",
    connecting: "Connecting…",
    disconnected: "Disconnected",
    needReady: "Not all players are ready",
    multiplayerTitle: "Multiplayer",
    multiplayerDesc: "Play against friends with a match code",
    orText: "or",
    rank: "Rank",
    playerName: "Player",
    multiResult: "Match Complete",
    bellReady: "Ring — {fruit} ×5",
    bellWait: "Ring bell (waiting for condition)",
    tabRecent: "Recent",
    tabTrend: "Trend",
    tabAchievements: "Achievements",
    dailyGoalLabel: "Daily goal",
    dailyProgress: "{done}/{target} rounds",
    dailyDone: "Daily goal reached ✓",
    trendAccuracyLabel: "Accuracy (%)",
    trendReactionLabel: "Reaction (ms)",
    trendNoData: "Play on 3+ different days to unlock trend charts",
    achievementFirstWin: "First Round",
    achievementFirstWinDesc: "Complete one round",
    achievementStreak5: "5-Hit Streak",
    achievementStreak5Desc: "5 correct rings in a row in a single round",
    achievementPerfectRound: "Perfect Round",
    achievementPerfectRoundDesc: "No wrong rings or missed bells",
    achievementSub200ms: "Lightning Fast",
    achievementSub200msDesc: "Average reaction ≤ 200ms",
    achievementDaily3: "3-Day Streak",
    achievementDaily3Desc: "Hit daily goal ({target} rounds) 3 days in a row",
    achievementToast: "Achievement unlocked: {name}",
  },
};

function fruitLabel(fruitKey, language) {
  const fruit = FRUITS.find((item) => item.key === fruitKey);
  if (!fruit) {
    return "";
  }

  return language === "en" ? fruit.labelEn : fruit.label;
}

function modeLabel(modeKey, language) {
  const mode = MODES[modeKey];
  return language === "en" ? mode.labelEn : mode.label;
}

function FruitCardFace({ card, compact }) {
  const fruit = card ? FRUITS.find((item) => item.key === card.fruit) : null;
  const positions = card ? (PIP_LAYOUTS[card.count] ?? PIP_LAYOUTS[1]) : [];

  return (
    <div className="play-card-face">
      {card && (
        <div className={`play-card-pips count-${card.count} ${compact ? "compact" : ""}`}>
          {positions.map((slot, index) => (
            <span key={`${card.id}-${slot}-${index}`} className={`pip slot-${slot}`}>
              {fruit?.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TableSeat({ player, seat, isActive, isCurrentTurn, language, compactCard, justFlipped }) {
  const topCard = getTopCard(player);
  const hasCard = Boolean(topCard);
  const label = language === "en" ? player.labelEn : player.labelZh;

  const shellClasses = [
    "table-card-shell",
    isActive && "active",
    isCurrentTurn && "current",
  ].filter(Boolean).join(" ");

  const innerClasses = [
    "card-3d-inner",
    hasCard && "face-up",
    justFlipped && "just-flipped",
  ].filter(Boolean).join(" ");

  return (
    <article
      className={isCurrentTurn ? "table-seat current-turn" : "table-seat"}
      style={{ gridArea: seat.gridArea }}
    >
      <div className="seat-header">
        <span className="seat-label">{label}</span>
      </div>
      <div className={shellClasses}>
        <div className="card-3d-container">
          <div className={innerClasses}>
            <div className="card-3d-back">
              <div className="card-back" />
            </div>
            <div className="card-3d-front">
              <FruitCardFace card={topCard} compact={compactCard} />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

const ACHIEVEMENT_META = {
  first_win:     { icon: "🎯", nameKey: "achievementFirstWin",    descKey: "achievementFirstWinDesc" },
  streak_5:      { icon: "🔥", nameKey: "achievementStreak5",     descKey: "achievementStreak5Desc" },
  perfect_round: { icon: "🌟", nameKey: "achievementPerfectRound",descKey: "achievementPerfectRoundDesc" },
  sub_200ms:     { icon: "⚡", nameKey: "achievementSub200ms",    descKey: "achievementSub200msDesc" },
  daily_3:       { icon: "📅", nameKey: "achievementDaily3",      descKey: "achievementDaily3Desc" },
};

function TrendLine({ points, color }) {
  const nonNullValues = points.map((p) => p.value).filter((v) => v !== null);
  if (nonNullValues.length < 2) return null;
  const W = 260;
  const H = 56;
  const PAD = 8;
  const min = Math.min(...nonNullValues);
  const max = Math.max(...nonNullValues);
  const range = max - min || 1;
  const n = points.length;
  const cx = (i) => ((i / (n - 1)) * (W - PAD * 2) + PAD).toFixed(1);
  const cy = (v) => (H - PAD - ((v - min) / range) * (H - PAD * 2)).toFixed(1);
  const segments = [];
  let seg = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i].value !== null) {
      seg.push(`${cx(i)},${cy(points[i].value)}`);
    } else if (seg.length) {
      segments.push(seg.join(" "));
      seg = [];
    }
  }
  if (seg.length) segments.push(seg.join(" "));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="trend-svg" aria-hidden="true">
      {segments.map((pts, idx) => (
        <polyline key={idx} points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {points.map((p, i) =>
        p.value !== null ? <circle key={i} cx={cx(i)} cy={cy(p.value)} r="2.5" fill={color} /> : null,
      )}
    </svg>
  );
}

function App() {
  const [screen, setScreen] = useState("home");
  const [settings, setSettings] = useState(loadSettings);
  const [bestSummary, setBestSummary] = useState(loadBestSummary);
  const [recentSummary, setRecentSummary] = useState(loadRecentSummary);
  const [history, setHistory] = useState(loadHistory);
  const [players, setPlayers] = useState(() => createPlayers(DEFAULT_SETTINGS.playerCount, FRUITS));
  const [currentTurn, setCurrentTurn] = useState(0);
  const [actingPlayer, setActingPlayer] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SETTINGS.duration);
  const [score, setScore] = useState(0);
  const [correctHits, setCorrectHits] = useState(0);
  const [wrongHits, setWrongHits] = useState(0);
  const [missedHits, setMissedHits] = useState(0);
  const [reactionTimes, setReactionTimes] = useState([]);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(loadDailyGoal);
  const [achievements, setAchievements] = useState(loadAchievements);
  const [achievementQueue, setAchievementQueue] = useState([]);
  const [activeTab, setActiveTab] = useState("recent");
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
  const [justFlippedSeat, setJustFlippedSeat] = useState(-1);
  const [bellParticles, setBellParticles] = useState([]);
  const [bellPressed, setBellPressed] = useState(false);
  const [cardCollecting, setCardCollecting] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Multiplayer state
  const [isMultiplayer, setIsMultiplayer] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [myPlayerId, setMyPlayerId] = useState(-1);
  const [mySeatIndex, setMySeatIndex] = useState(-1);
  const [lobbyError, setLobbyError] = useState("");
  const [multiResults, setMultiResults] = useState(null);
  const [seatMap, setSeatMap] = useState([]);

  const revealIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const penaltyTimeoutRef = useRef(null);
  const bossTauntTimeoutRef = useRef(null);
  const startupTimeoutRef = useRef(null);
  const gameStateRef = useRef({});
  const gameRunningRef = useRef(false);
  const bellStateRef = useRef({
    available: false,
    fruitKey: null,
    startedAt: 0,
    handled: true,
  });
  const matchContextRef = useRef(null);
  const flipTimeoutRef = useRef(null);
  const particleTimeoutRef = useRef(null);
  const bellPressTimeoutRef = useRef(null);
  const collectTimeoutRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const screenRegionRef = useRef(null);

  const mode = MODES[settings.difficulty];
  const seatLayouts = getSeatLayouts(settings.playerCount);
  const userSeatId = seatLayouts.findIndex((seat) => seat.isUser);
  const copy = COPY[settings.language] ?? COPY.zh;
  const compactCard = settings.playerCount >= 5;

  const { playFeedback: playFeedbackSound, ensureUnlocked: ensureAudioContext } =
    useAudioEngine(settings.soundEnabled);

  function t(key, vars = {}) {
    return Object.entries(vars).reduce(
      (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
      copy[key],
    );
  }

  function formatRelativeTime(ts) {
    const diffMs = Date.now() - ts;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return t("historyJustNow");
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    const date = new Date(ts);
    const locale = settings.language === "zh" ? "zh-CN" : "en-US";
    return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
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
      maxStreak,
    };
  }, [
    correctHits,
    actingPlayer,
    currentTurn,
    maxStreak,
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

  useEffect(() => {
    screenRegionRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    if (achievementQueue.length === 0) return;
    const timer = setTimeout(() => {
      setAchievementQueue((q) => q.slice(1));
    }, 3000);
    return () => clearTimeout(timer);
  }, [achievementQueue]);

  useMultiplayerSocket({
    isMultiplayer,
    mySeatIndex,
    language: settings.language,
    actions: {
      setRoomCode,
      setMyPlayerId,
      setRoomPlayers,
      setLobbyError,
      setScreen,
      setSeatMap,
      setPlayers,
      setCurrentTurn,
      setActingPlayer,
      setSecondsLeft,
      setScore,
      setCorrectHits,
      setWrongHits,
      setMissedHits,
      setReactionTimes,
      setStreak,
      setActiveBellFruit,
      setScoreBreakdown,
      setPenaltyNotice,
      setBossTaunt,
      setBossDisrupting,
      setTauntEchoes,
      setFeedback,
      setMySeatIndex,
      setMultiResults,
      setIsMultiplayer,
      setHistory,
      dailyGoal,
      setDailyGoal,
      bellStateRef,
      gameRunningRef,
      matchContextRef,
      seatMap,
      t,
      fruitLabel,
      updateFeedback,
      playFeedbackSound,
      triggerFlipAnimation,
      triggerBellPress,
      triggerCollectAnimation,
      spawnBellParticles,
      showPenalty,
    },
  });

  function stopGameLoops() {
    clearGameLoopHandles({
      revealIntervalRef,
      countdownIntervalRef,
      feedbackTimeoutRef,
      penaltyTimeoutRef,
      bossTauntTimeoutRef,
      startupTimeoutRef,
    });
    window.clearTimeout(flipTimeoutRef.current);
    window.clearTimeout(particleTimeoutRef.current);
    window.clearTimeout(bellPressTimeoutRef.current);
    window.clearTimeout(collectTimeoutRef.current);
    window.clearInterval(countdownTimerRef.current);
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
    const evaluation = evaluateBellAvailability(nextPlayers);

    if (evaluation.available) {
      bellStateRef.current = {
        available: true,
        fruitKey: evaluation.fruitKey,
        startedAt: Date.now(),
        handled: false,
      };
      setActiveBellFruit(evaluation.fruitKey);
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

  function spawnBellParticles() {
    const count = 16;
    const seed = Date.now();
    const particles = Array.from({ length: count }, (_, i) => ({
      id: `${seed}-${i}`,
      angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4,
      dist: 60 + Math.random() * 50,
      color: i % 3 === 0 ? "white" : "gold",
      size: 4 + Math.random() * 5,
    }));
    setBellParticles(particles);
    window.clearTimeout(particleTimeoutRef.current);
    particleTimeoutRef.current = window.setTimeout(() => {
      setBellParticles([]);
    }, 700);
  }

  function triggerBellPress() {
    setBellPressed(true);
    window.clearTimeout(bellPressTimeoutRef.current);
    bellPressTimeoutRef.current = window.setTimeout(() => {
      setBellPressed(false);
    }, 250);
  }

  function triggerFlipAnimation(seatIndex) {
    setJustFlippedSeat(seatIndex);
    window.clearTimeout(flipTimeoutRef.current);
    flipTimeoutRef.current = window.setTimeout(() => {
      setJustFlippedSeat(-1);
    }, 500);
  }

  function triggerCollectAnimation() {
    setCardCollecting(true);
    window.clearTimeout(collectTimeoutRef.current);
    collectTimeoutRef.current = window.setTimeout(() => {
      setCardCollecting(false);
    }, 400);
  }

  function createRoom() {
    ensureAudioContext();
    setIsMultiplayer(true);
    setLobbyError("");
    const socket = connectSocket();
    socket.emit("room:create", {
      playerName: settings.language === "zh" ? "房主" : "Host",
      maxPlayers: settings.playerCount,
      difficulty: settings.difficulty,
      duration: settings.duration,
      language: settings.language,
    });
  }

  function joinRoom() {
    if (!joinCode.trim()) return;
    ensureAudioContext();
    setIsMultiplayer(true);
    setLobbyError("");
    const socket = connectSocket();
    socket.emit("room:join", {
      code: joinCode.trim(),
      playerName: settings.language === "zh" ? `玩家` : "Player",
    });
  }

  function toggleReady() {
    const socket = getSocket();
    const me = roomPlayers.find((p) => p.id === myPlayerId);
    socket.emit("room:ready", { ready: !me?.ready });
  }

  function startMatch() {
    const socket = getSocket();
    socket.emit("room:start");
  }

  function leaveLobby() {
    const socket = getSocket();
    socket.emit("room:leave");
    disconnectSocket();
    setIsMultiplayer(false);
    setRoomCode("");
    setRoomPlayers([]);
    setJoinCode("");
    setLobbyError("");
    setScreen("home");
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
    triggerFlipAnimation(actorIndex);
  }

  function startGame() {
    ensureAudioContext();
    stopGameLoops();
    window.clearInterval(countdownTimerRef.current);

    const freshPlayers = createPlayers(settings.playerCount, FRUITS);

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
    setMaxStreak(0);
    setActiveBellFruit(null);
    setScoreBreakdown(INITIAL_BREAKDOWN);
    setPenaltyNotice("");
    setBossTaunt("");
    setBossDisrupting(false);
    setTauntEchoes([]);
    setFeedback({ type: "idle", message: "" });
    bellStateRef.current = {
      available: false,
      fruitKey: null,
      startedAt: 0,
      handled: true,
    };
    gameRunningRef.current = false;
    setScreen("play");
    setCountdown(3);

    let tick = 3;
    countdownTimerRef.current = window.setInterval(() => {
      tick--;
      if (tick > 0) {
        setCountdown(tick);
      } else {
        window.clearInterval(countdownTimerRef.current);
        setCountdown(0);
        beginGameLoop(freshPlayers);
      }
    }, 1000);
  }

  function beginGameLoop(freshPlayers) {
    gameRunningRef.current = true;
    setFeedback({ type: "idle", message: t("startRound") });

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

    if (isMultiplayer) {
      const socket = getSocket();
      socket.emit("game:bell");
      triggerBellPress();
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
      setMaxStreak((value) => Math.max(value, streak + 1));
      updateFeedback(
        "success",
        t("bellSuccess", { count: collectedCount }),
      );
      playFeedbackSound("success");
      applyBellAvailability(nextPlayers);
      triggerBellPress();
      spawnBellParticles();
      triggerCollectAnimation();
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
    triggerBellPress();
  }

  function finishGame() {
    if (!gameRunningRef.current) {
      return;
    }

    gameRunningRef.current = false;
    stopGameLoops();
    const pendingResolution = reconcilePendingBellWindow(
      gameStateRef.current,
      bellStateRef.current,
    );
    const resolvedSnapshot = pendingResolution.snapshot;
    const summary = normalizeSummary(createRoundSummary(resolvedSnapshot));

    if (pendingResolution.missed) {
      setMissedHits(resolvedSnapshot.missedHits);
      setScoreBreakdown(resolvedSnapshot.scoreBreakdown);
      setFeedback({
        type: "warn",
        message: t("missedBell", {
          fruit: fruitLabel(pendingResolution.missedFruit, settings.language),
        }),
      });
    }

    setResultSummary(summary);
    setScoreBreakdown(resolvedSnapshot.scoreBreakdown ?? INITIAL_BREAKDOWN);
    setScore(summary.score);
    setRecentSummary(summary);
    saveJson(RECENT_KEY, summary);

    if (summary.score >= bestSummary.score) {
      setBestSummary(summary);
      saveJson(BEST_KEY, summary);
    }

    const updatedHistory = appendHistoryEntry({
      ...summary,
      ts: Date.now(),
      mode: "solo",
    });
    setHistory(updatedHistory);

    // Update daily goal
    const newCompletedRounds = dailyGoal.completedRounds + 1;
    const newGoalReached = dailyGoal.goalReached || newCompletedRounds >= DAILY_TARGET_ROUNDS;
    const newDailyGoal = { ...dailyGoal, completedRounds: newCompletedRounds, goalReached: newGoalReached };
    saveDailyGoal(newDailyGoal);
    setDailyGoal(newDailyGoal);

    // Check achievements
    const snapshotMaxStreak = resolvedSnapshot.maxStreak ?? 0;
    let currentAchievements = achievements;
    const newlyUnlocked = [];
    const achievementChecks = [
      ["first_win", updatedHistory.length >= 1],
      ["streak_5", snapshotMaxStreak >= 5],
      ["perfect_round", summary.correctHits > 0 && summary.wrongHits === 0 && summary.missedHits === 0],
      ["sub_200ms", summary.avgReactionMs > 0 && summary.avgReactionMs <= 200],
      ["daily_3", computeDailyGoalStreak(updatedHistory, DAILY_TARGET_ROUNDS) >= 3],
    ];
    for (const [key, condition] of achievementChecks) {
      if (!currentAchievements[key] && condition) {
        currentAchievements = unlockAchievement(key, currentAchievements);
        newlyUnlocked.push(key);
      }
    }
    if (newlyUnlocked.length > 0) {
      setAchievements(currentAchievements);
      setAchievementQueue((q) => [...q, ...newlyUnlocked]);
    }

    bellStateRef.current = {
      available: false,
      fruitKey: null,
      startedAt: 0,
      handled: true,
    };
    gameStateRef.current = resolvedSnapshot;

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
            <h1>Halligalli</h1>
          </div>
          <div className="hero-rule">{t("heroRule")}</div>
        </header>

        {screen === "home" && (
          <section key="home" ref={screenRegionRef} tabIndex={-1} className="stack screen-enter home-enter">
            <div className="card intro">
              <p>{t("startIntro")}</p>
              <div className="button-row">
                <button className="primary-button glow-button" onClick={startGame}>
                  {t("start")}
                </button>
              </div>
            </div>

            <div className="card multiplayer-card">
              <h2>{t("multiplayerTitle")}</h2>
              <p className="multi-desc">{t("multiplayerDesc")}</p>
              <div className="multi-actions">
                <button className="primary-button glow-button" onClick={createRoom}>
                  {t("createRoom")}
                </button>
                <span className="or-divider">{t("orText")}</span>
                <div className="join-row">
                  <input
                    id="join-code-input"
                    name="joinCode"
                    className="code-input"
                    type="text"
                    maxLength={4}
                    placeholder={t("enterCode")}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                  />
                  <button className="ghost-button" onClick={joinRoom}>
                    {t("joinRoom")}
                  </button>
                </div>
              </div>
            </div>

            <div className="card history-card">
              <div className="history-head">
                <h2>{t("historyTitle")}</h2>
                <div className="daily-goal-bar">
                  <span className="daily-goal-label">{t("dailyGoalLabel")}</span>
                  <span className={`daily-goal-progress${dailyGoal.goalReached ? " reached" : ""}`}>
                    {dailyGoal.goalReached
                      ? t("dailyDone")
                      : t("dailyProgress", { done: dailyGoal.completedRounds, target: DAILY_TARGET_ROUNDS })}
                  </span>
                </div>
              </div>
              <div className="history-tabs" role="tablist" aria-label={t("historyTitle")}>
                {(["recent", "trend", "achievements"]).map((tab) => (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={activeTab === tab}
                    className={`tab-btn${activeTab === tab ? " active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === "recent" ? t("tabRecent") : tab === "trend" ? t("tabTrend") : t("tabAchievements")}
                  </button>
                ))}
              </div>

              {activeTab === "recent" && (
                history.length === 0 ? (
                  <p className="history-empty">{t("historyEmpty")}</p>
                ) : (
                  <ul className="history-list">
                    {history.slice(0, 5).map((entry) => (
                      <li key={entry.ts} className="history-row">
                        <div className="history-meta">
                          <span className={`history-mode mode-${entry.mode}`}>
                            {entry.mode === "multi" ? t("historyModeMulti") : t("historyModeSolo")}
                          </span>
                          <span className="history-time">{formatRelativeTime(entry.ts)}</span>
                        </div>
                        <div className="history-stats">
                          <div className="history-stat">
                            <span className="history-stat-label">{t("historyHeaderScore")}</span>
                            <span className="history-stat-value">{entry.score}</span>
                          </div>
                          <div className="history-stat">
                            <span className="history-stat-label">{t("historyHeaderAccuracy")}</span>
                            <span className="history-stat-value">
                              {Math.round(entry.accuracy * 100)}%
                            </span>
                          </div>
                          <div className="history-stat">
                            <span className="history-stat-label">{t("historyHeaderReaction")}</span>
                            <span className="history-stat-value">
                              {entry.avgReactionMs ? `${entry.avgReactionMs}ms` : "-"}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {activeTab === "trend" && (() => {
                const accData = computeRollingAccuracy(history, 14);
                const rxData = computeReactionTrend(history, 14);
                const filledDays = accData.filter((p) => p.value !== null).length;
                if (filledDays < 3) {
                  return <p className="history-empty">{t("trendNoData")}</p>;
                }
                return (
                  <div className="trend-section">
                    <div className="trend-group">
                      <span className="trend-label">{t("trendAccuracyLabel")}</span>
                      <TrendLine points={accData} color="var(--gold-light)" />
                    </div>
                    <div className="trend-group">
                      <span className="trend-label">{t("trendReactionLabel")}</span>
                      <TrendLine points={rxData} color="#6fcf97" />
                    </div>
                  </div>
                );
              })()}

              {activeTab === "achievements" && (
                <ul className="achievement-grid">
                  {ACHIEVEMENT_KEYS.map((key) => {
                    const meta = ACHIEVEMENT_META[key];
                    const unlockedTs = achievements[key];
                    return (
                      <li key={key} className={`achievement-tile${unlockedTs ? " unlocked" : ""}`}>
                        <span className="achievement-icon" aria-hidden="true">{meta.icon}</span>
                        <div className="achievement-info">
                          <span className="achievement-name">{t(meta.nameKey)}</span>
                          <span className="achievement-desc">
                            {unlockedTs
                              ? formatRelativeTime(unlockedTs)
                              : t(meta.descKey, { target: DAILY_TARGET_ROUNDS })}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
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

        {screen === "lobby" && (
          <section key="lobby" ref={screenRegionRef} tabIndex={-1} className="stack screen-enter">
            <div className="card lobby-card" role="dialog" aria-modal="true" aria-labelledby="lobby-title">
              <h2 id="lobby-title">{t("multiplayerTitle")}</h2>
              <div className="room-code-display">
                <span className="room-code-label">{t("roomCode")}</span>
                <span className="room-code-value">{roomCode}</span>
              </div>
              {lobbyError && <div className="feedback error">{lobbyError}</div>}
              <div className="lobby-players">
                {roomPlayers.map((p) => (
                  <div
                    key={p.id}
                    className={`lobby-player-row ${p.ready ? "ready" : ""}`}
                  >
                    <span className="lobby-player-name">
                      {p.isHost && <span className="host-badge">{t("host")}</span>}
                      {p.name}
                    </span>
                    <span className={p.ready ? "lobby-status ready" : "lobby-status"}>
                      {p.ready ? t("readyStatus") : t("notReady")}
                    </span>
                  </div>
                ))}
                {Array.from(
                  { length: settings.playerCount - roomPlayers.length },
                  (_, i) => (
                    <div key={`empty-${i}`} className="lobby-player-row empty">
                      <span className="lobby-player-name">{t("waitingPlayers")}</span>
                    </div>
                  ),
                )}
              </div>
              <div className="button-row lobby-buttons">
                <button className="primary-button" onClick={toggleReady}>
                  {roomPlayers.find((p) => p.id === myPlayerId)?.ready
                    ? t("cancelReady")
                    : t("ready")}
                </button>
                {roomPlayers.find((p) => p.id === myPlayerId)?.isHost && (
                  <button
                    className="primary-button"
                    onClick={startMatch}
                    disabled={roomPlayers.length < 2 || !roomPlayers.every((p) => p.ready)}
                  >
                    {t("startMatch")}
                  </button>
                )}
                <button className="ghost-button" onClick={leaveLobby}>
                  {t("leaveLobby")}
                </button>
              </div>
            </div>
          </section>
        )}

        {screen === "play" && (
          <section key="play" ref={screenRegionRef} tabIndex={-1} className="stack screen-enter">
            {countdown > 0 && (
              <div className="countdown-overlay" role="status" aria-live="assertive" aria-atomic="true">
                <span key={countdown} className="countdown-number">{countdown}</span>
              </div>
            )}
            <div className="play-topbar minimal">
              <div className="pill">{t("timeLeft", { seconds: secondsLeft })}</div>
              <button className="ghost-button" onClick={finishGame}>
                {t("endGame")}
              </button>
            </div>

            <div className={`feedback ${feedback.type}`} aria-live="polite" aria-atomic="true">{feedback.message}</div>
            {penaltyNotice && <div className="penalty-banner" aria-live="assertive" aria-atomic="true">{penaltyNotice}</div>}

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
                {bossTaunt && <div className="boss-taunt" aria-live="polite" aria-atomic="true">{bossTaunt}</div>}
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
                      justFlipped={justFlippedSeat === index}
                    />
                  );
                })}

                <div className={activeBellFruit ? "center-bell is-ready" : "center-bell"}>
                  {bellParticles.map((p) => (
                    <span
                      key={p.id}
                      className={`bell-particle ${p.color}`}
                      style={{
                        "--angle": `${p.angle}rad`,
                        "--dist": `${p.dist}px`,
                        width: `${p.size}px`,
                        height: `${p.size}px`,
                      }}
                    />
                  ))}
                  {bellPressed && (
                    <>
                      <span className="bell-ripple-ring" />
                      <span className="bell-ripple-ring" />
                      <span className="bell-ripple-ring" />
                    </>
                  )}
                  <button
                    className={bellPressed ? "bell-button pressed" : "bell-button"}
                    onClick={handleBell}
                    aria-label={activeBellFruit
                      ? t("bellReady", { fruit: fruitLabel(activeBellFruit, settings.language) })
                      : t("bellWait")}
                    aria-pressed={Boolean(bellPressed)}
                  >
                    铃
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {screen === "result" && (
          <section key="result" ref={screenRegionRef} tabIndex={-1} className="stack screen-enter">
            {isMultiplayer && multiResults ? (
              <>
                <div className="card result-hero">
                  <p className="eyebrow">{t("multiResult")}</p>
                  <h2>
                    {multiResults[mySeatIndex]?.score ?? 0} {t("scoreUnit")}
                  </h2>
                </div>

                <div className="card">
                  <h2>{t("rank")}</h2>
                  <div className="multi-scoreboard">
                    {Object.values(multiResults)
                      .sort((a, b) => b.score - a.score)
                      .map((r, rank) => (
                        <div
                          key={r.seatIndex}
                          className={`scoreboard-row ${r.seatIndex === mySeatIndex ? "is-me" : ""}`}
                        >
                          <span className="scoreboard-rank">#{rank + 1}</span>
                          <span className="scoreboard-name">
                            {seatMap[r.seatIndex]?.name || `Player ${r.seatIndex + 1}`}
                          </span>
                          <span className="scoreboard-score">
                            {r.score} {t("scoreUnit")}
                          </span>
                          <span className="scoreboard-detail">
                            {t("correctHits")}: {r.correctHits}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="button-row">
                  <button
                    className="ghost-button"
                    onClick={() => {
                      leaveLobby();
                      setMultiResults(null);
                    }}
                  >
                    {t("backHome")}
                  </button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </section>
        )}
      </section>
      {achievementQueue.length > 0 && (
        <div className="achievement-toast" role="status" aria-live="assertive" aria-atomic="true">
          <span aria-hidden="true">{ACHIEVEMENT_META[achievementQueue[0]].icon}</span>
          {" "}{t("achievementToast", { name: t(ACHIEVEMENT_META[achievementQueue[0]].nameKey) })}
        </div>
      )}
    </main>
  );
}

export default App;
