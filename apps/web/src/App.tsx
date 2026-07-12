import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useAudioEngine } from "./audio/useAudioEngine.js";
import { projectRoomSnapshot } from "./multiplayer/projection.js";
import { useRoomEntry } from "./multiplayer/room-entry.js";
import { FRUITS, MODES } from "./game/catalog.js";
import { DEFAULT_SETTINGS, INITIAL_BREAKDOWN } from "./game/constants.js";
import {
  finishSinglePlayerMatch,
  resolveSinglePlayerBell,
  resolveSinglePlayerMissedBell,
} from "./game/lifecycle.js";
import type { SinglePlayerMatchState } from "./game/lifecycle.js";
import { loadSettings, removeLegacyProgress, saveSettings } from "./game/persistence.js";
import {
  clonePlayers,
  createPlayers,
  evaluateBellAvailability,
  flipCardForPlayer,
  getSeatLayouts,
  getTopCard,
  visibleTotals,
} from "./game/rules.js";
import type {
  BellState,
  Card,
  Difficulty,
  FruitKey,
  GameSettings,
  PlayerState,
  RoundSummary,
  ScoreBreakdown,
  SeatLayout,
} from "./game/types.js";

type Screen = "home" | "play" | "result";
type FeedbackType = "idle" | "success" | "warn" | "error";
type TimerRef = { current: number | null };

interface GameSnapshot extends SinglePlayerMatchState {
  userSeatId: number;
}

const PIP_LAYOUTS = {
  1: ["center"],
  2: ["mid-left", "mid-right"],
  3: ["top-center", "center", "bottom-center"],
  4: ["top-left", "top-right", "bottom-left", "bottom-right"],
  5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
} as const;

const BOSS_TAUNTS = {
  zh: [
    "Yang哥：全桌高呼五个水果，你居然把铃让成了传家宝！",
    "Yang哥：这不是漏拍，这是把胜利铺红毯送给下一位！",
    "Yang哥：铃就在你面前发光，你却演了一整段慢动作默剧！",
  ],
  en: [
    "Boss Yang: The whole table screamed FIVE and you still let the bell become a museum piece!",
    "Boss Yang: That was not a miss. That was a ceremonial handoff of victory to the next player!",
    "Boss Yang: The bell was glowing in front of you and you answered with dramatic slow motion!",
  ],
} as const;

const COPY = {
  zh: {
    heroRule: "顺时针翻牌，只看桌面最上层，出现刚好 5 个同类水果就抢铃",
    startIntro: "单人训练：调好设置直接开打，边练手速边磨判断力。",
    start: "开始练习",
    settings: "开局设置",
    players: "参加人数",
    difficulty: "难度",
    duration: "局时",
    sound: "音效",
    soundOn: "开启",
    soundOff: "关闭",
    lang: "语言",
    chinese: "中文",
    english: "English",
    rules: "规则要点",
    rule1: "按顺时针轮流翻牌，新牌压住旧牌，旧牌立即失效。",
    rule2: "只计算每位玩家最上面的那张牌。",
    rule3: "某种水果总数恰好等于 5 时抢铃，抢到的人收走场上所有牌。",
    rule4: "错拍时，你要罚出场牌一半向上取整的牌，压到自己桌面底部。",
    deckHint: "2 和 3 最常见，更容易凑出刚好 5 的组合。",
    seconds: "秒",
    timeLeft: "剩余 {seconds}s",
    endGame: "结束本局",
    startRound: "从第一位玩家开始，按顺时针翻牌。",
    idleObserve: "继续观察桌面，只统计每位玩家最上面的那张牌。",
    missedBell: "漏拍了，刚才桌面上其实已经有 5 个{fruit}。",
    bellSuccess: "抢铃成功，收走场上 {count} 张牌，然后由你重新开始出牌。",
    bellPenalty: "错拍了，罚出 {count} 张牌压到你桌面的底部。",
    bellPenaltyNone: "错拍了，但你已经没有可罚出的暗牌了。",
    penaltyBanner: "惩罚：罚出 {count} 张牌",
    bossTitle: "Yang哥 Boss",
    bossWatching: "Yang哥正在盯场",
    bossHint: "Boss模式下，Yang哥会在你漏拍后高调开嘲。",
    finish: "本局完成",
    scoreUnit: "分",
    accuracy: "正确率",
    avgReaction: "平均反应",
    correctHits: "正确拍铃",
    wrongHits: "错拍",
    missedHits: "漏拍",
    bestReaction: "最快反应",
    currentDifficulty: "当前难度",
    playAgain: "再来一局",
    backHome: "返回首页",
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
    resultLine: "{players} 人局，正确率 {accuracy}%，平均反应 {avg} ms",
    bellReady: "抢铃 — {fruit}已凑齐5个",
    bellWait: "抢铃（等待时机）",
    multiplayer: "多人房间",
    playerName: "玩家名",
    roomCode: "房间码",
    createRoom: "创建两人房间",
    joinRoom: "加入房间",
    roomStatus: "大厅：{current}/{max} 位玩家",
    entryHint: "凭证只保留在当前页面内；刷新后需要重新加入。",
    roomConnecting: "正在连接房间…",
    readyForMatch: "准备对局",
    startMatch: "开始对局",
    ringMultiplayerBell: "抢铃",
    waitingForReady: "等待两位玩家准备",
    turnOwner: "当前翻牌：{name}",
    matchResult: "座位 {seat} 获胜，获得 {score} 分",
  },
  en: {
    heroRule: "Flip cards clockwise, count only the top visible cards, ring when one fruit totals exactly 5",
    startIntro: "Solo training: tune the table, then sharpen your reflexes and judgment.",
    start: "Start Practice",
    settings: "Setup",
    players: "Players",
    difficulty: "Difficulty",
    duration: "Duration",
    sound: "Sound",
    soundOn: "On",
    soundOff: "Off",
    lang: "Language",
    chinese: "中文",
    english: "English",
    rules: "Rules",
    rule1: "Players flip clockwise. A new face-up card covers the old one immediately.",
    rule2: "Only the top face-up card of each player counts.",
    rule3: "If one fruit totals exactly 5, ring the bell. The winner takes all face-up cards.",
    rule4: "If you ring by mistake, pay half the table cards rounded up to your own pile.",
    deckHint: "2s and 3s are most common, making exact-five combinations more likely.",
    seconds: "s",
    timeLeft: "{seconds}s left",
    endGame: "End Round",
    startRound: "The first player starts. Cards flip clockwise.",
    idleObserve: "Keep watching the table. Only the top visible card of each player counts.",
    missedBell: "Missed it. There were already exactly 5 {fruit} on the table.",
    bellSuccess: "Successful ring. You take {count} table cards and start the next round.",
    bellPenalty: "Wrong ring. You pay {count} cards to the bottom of your face-up pile.",
    bellPenaltyNone: "Wrong ring, but you have no hidden cards left to pay.",
    penaltyBanner: "Penalty: pay {count} cards",
    bossTitle: "Boss Yang",
    bossWatching: "Boss Yang is watching",
    bossHint: "In Boss Mode, Boss Yang goes loud after a missed bell.",
    finish: "Round Complete",
    scoreUnit: "pts",
    accuracy: "Accuracy",
    avgReaction: "Avg reaction",
    correctHits: "Correct rings",
    wrongHits: "Wrong rings",
    missedHits: "Missed chances",
    bestReaction: "Best reaction",
    currentDifficulty: "Difficulty",
    playAgain: "Play Again",
    backHome: "Back Home",
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
    resultLine: "{players}-player round, {accuracy}% accuracy, avg reaction {avg} ms",
    bellReady: "Ring — {fruit} ×5",
    bellWait: "Ring bell (waiting for condition)",
    multiplayer: "Multiplayer room",
    playerName: "Player name",
    roomCode: "Room code",
    createRoom: "Create two-seat room",
    joinRoom: "Join room",
    roomStatus: "Lobby: {current}/{max} players",
    entryHint: "The participant credential stays only in this page; rejoin after refresh.",
    roomConnecting: "Connecting to room…",
    readyForMatch: "Ready for match",
    startMatch: "Start match",
    ringMultiplayerBell: "Ring bell",
    waitingForReady: "Waiting for both players to be ready",
    turnOwner: "Current turn: {name}",
    matchResult: "Seat {seat} wins {score} points",
  },
} as const;

type CopyKey = keyof typeof COPY.en;

const INITIAL_BELL_STATE: BellState = {
  available: false,
  fruitKey: null,
  startedAt: 0,
  handled: true,
};

const INITIAL_GAME_SNAPSHOT: GameSnapshot = {
  players: [],
  currentTurn: 0,
  actingPlayer: 0,
  score: 0,
  correctHits: 0,
  wrongHits: 0,
  missedHits: 0,
  reactionTimes: [],
  scoreBreakdown: INITIAL_BREAKDOWN,
  difficulty: DEFAULT_SETTINGS.difficulty,
  durationSec: DEFAULT_SETTINGS.duration,
  playerCount: DEFAULT_SETTINGS.playerCount,
  userSeatId: 0,
  maxStreak: 0,
  streak: 0,
};

function fruitLabel(fruitKey: FruitKey | null, language: GameSettings["language"]): string {
  const fruit = FRUITS.find((item) => item.key === fruitKey);
  return language === "en" ? fruit?.labelEn ?? "" : fruit?.label ?? "";
}

function modeLabel(difficulty: Difficulty, language: GameSettings["language"]): string {
  const mode = MODES[difficulty];
  return language === "en" ? mode.labelEn : mode.label;
}

function FruitCardFace({ card, compact }: { card: Card | null; compact: boolean }) {
  const fruit = card ? FRUITS.find((item) => item.key === card.fruit) : null;
  const positions = card ? PIP_LAYOUTS[card.count as keyof typeof PIP_LAYOUTS] : [];

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

function TableSeat({
  player,
  seat,
  active,
  currentTurn,
  language,
  compact,
  justFlipped,
}: {
  player: PlayerState;
  seat: SeatLayout;
  active: boolean;
  currentTurn: boolean;
  language: GameSettings["language"];
  compact: boolean;
  justFlipped: boolean;
}) {
  const topCard = getTopCard(player);
  const hasCard = Boolean(topCard);
  const previousFaceUp = useRef(false);
  const wasFaceUp = previousFaceUp.current;

  useEffect(() => {
    previousFaceUp.current = hasCard;
  }, [hasCard]);

  const innerClass = [
    "card-3d-inner",
    hasCard && "face-up",
    justFlipped && "just-flipped",
    justFlipped && wasFaceUp && "card-swap",
  ].filter(Boolean).join(" ");

  return (
    <article
      className={currentTurn ? "table-seat current-turn" : "table-seat"}
      style={{ gridArea: seat.gridArea } as CSSProperties}
    >
      <div className="seat-header">
        <span className="seat-label">{language === "en" ? player.labelEn : player.labelZh}</span>
      </div>
      <div className={["table-card-shell", active && "active", currentTurn && "current"].filter(Boolean).join(" ")}>
        <div className="card-3d-container">
          <div className={innerClass}>
            <div className="card-3d-back"><div className="card-back" /></div>
            <div className="card-3d-front"><FruitCardFace card={topCard} compact={compact} /></div>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [screen, setScreen] = useState<Screen>("home");
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [score, setScore] = useState(0);
  const [correctHits, setCorrectHits] = useState(0);
  const [wrongHits, setWrongHits] = useState(0);
  const [missedHits, setMissedHits] = useState(0);
  const [scoreBreakdown, setScoreBreakdown] = useState<ScoreBreakdown>(INITIAL_BREAKDOWN);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SETTINGS.duration);
  const [countdown, setCountdown] = useState(0);
  const [activeBellFruit, setActiveBellFruit] = useState<FruitKey | null>(null);
  const [feedback, setFeedback] = useState({ type: "idle" as FeedbackType, message: "" });
  const [penaltyNotice, setPenaltyNotice] = useState("");
  const [bossTaunt, setBossTaunt] = useState("");
  const [bellPressed, setBellPressed] = useState(false);
  const [justFlippedSeat, setJustFlippedSeat] = useState(-1);
  const [resultSummary, setResultSummary] = useState<RoundSummary | null>(null);
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const gameStateRef = useRef<GameSnapshot>(INITIAL_GAME_SNAPSHOT);
  const gameRunningRef = useRef(false);
  const bellStateRef = useRef<BellState>(INITIAL_BELL_STATE);
  const revealIntervalRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);
  const penaltyTimeoutRef = useRef<number | null>(null);
  const bossTauntTimeoutRef = useRef<number | null>(null);
  const startupTimeoutRef = useRef<number | null>(null);
  const flipTimeoutRef = useRef<number | null>(null);
  const bellPressTimeoutRef = useRef<number | null>(null);
  const screenRegionRef = useRef<HTMLElement | null>(null);

  const mode = MODES[settings.difficulty];
  const seatLayouts = getSeatLayouts(settings.playerCount) ?? [];
  const userSeatId = seatLayouts.findIndex((seat) => seat.isUser);
  const copy = COPY[settings.language];
  const compactCards = settings.playerCount >= 5;
  const { ensureUnlocked, playFeedback } = useAudioEngine(settings.soundEnabled);
  const roomEntry = useRoomEntry();
  const roomProjection = roomEntry.session
    ? projectRoomSnapshot(roomEntry.session.snapshot)
    : null;
  const activeRoomParticipant = roomProjection?.snapshot.participants.find(
    (participant) => participant.seatIndex === roomProjection.snapshot.currentTurn,
  );

  function t(key: CopyKey, values: Record<string, number | string> = {}): string {
    let message: string = copy[key];
    for (const [name, value] of Object.entries(values)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
    return message;
  }

  function commitSnapshot(next: GameSnapshot): void {
    gameStateRef.current = next;
    setPlayers(next.players);
    setScore(next.score);
    setCorrectHits(next.correctHits);
    setWrongHits(next.wrongHits);
    setMissedHits(next.missedHits);
    setScoreBreakdown(next.scoreBreakdown);
  }

  function clearTimer(ref: TimerRef, clear: (timer: number) => void): void {
    if (ref.current !== null) {
      clear(ref.current);
      ref.current = null;
    }
  }

  function stopGameLoops(): void {
    clearTimer(revealIntervalRef, window.clearInterval);
    clearTimer(countdownIntervalRef, window.clearInterval);
    clearTimer(feedbackTimeoutRef, window.clearTimeout);
    clearTimer(penaltyTimeoutRef, window.clearTimeout);
    clearTimer(bossTauntTimeoutRef, window.clearTimeout);
    clearTimer(startupTimeoutRef, window.clearTimeout);
    clearTimer(flipTimeoutRef, window.clearTimeout);
    clearTimer(bellPressTimeoutRef, window.clearTimeout);
  }

  function updateFeedback(type: FeedbackType, message: string): void {
    setFeedback({ type, message });
    clearTimer(feedbackTimeoutRef, window.clearTimeout);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedback({ type: "idle", message: t("idleObserve") });
    }, 1_200);
  }

  function triggerBossTaunt(): void {
    if (!("isBoss" in mode) || !mode.isBoss) return;

    const choices = BOSS_TAUNTS[settings.language];
    setBossTaunt(choices[Math.floor(Math.random() * choices.length)] ?? "");
    clearTimer(bossTauntTimeoutRef, window.clearTimeout);
    bossTauntTimeoutRef.current = window.setTimeout(() => setBossTaunt(""), 1_700);
  }

  function applyBellAvailability(nextPlayers: PlayerState[], now: number): void {
    const evaluation = evaluateBellAvailability(nextPlayers);
    bellStateRef.current = evaluation.available
      ? { available: true, fruitKey: evaluation.fruitKey, startedAt: now, handled: false }
      : INITIAL_BELL_STATE;
    setActiveBellFruit(evaluation.fruitKey);
  }

  function triggerBellPress(): void {
    setBellPressed(true);
    clearTimer(bellPressTimeoutRef, window.clearTimeout);
    bellPressTimeoutRef.current = window.setTimeout(() => setBellPressed(false), 250);
  }

  function advanceTurn(base = gameStateRef.current): void {
    if (!gameRunningRef.current) return;

    let next = base;
    if (bellStateRef.current.available && !bellStateRef.current.handled) {
      const missedFruit = bellStateRef.current.fruitKey;
      const resolved = resolveSinglePlayerMissedBell(next);
      next = { ...resolved, userSeatId: next.userSeatId };
      updateFeedback("warn", t("missedBell", { fruit: fruitLabel(missedFruit, settings.language) }));
      playFeedback("warn");
      triggerBossTaunt();
    }

    const playersForTurn = clonePlayers(next.players);
    const actorIndex = next.currentTurn;
    const actor = playersForTurn[actorIndex];
    if (!actor) return;

    const { player } = flipCardForPlayer(actor);
    playersForTurn[actorIndex] = player;
    applyBellAvailability(playersForTurn, Date.now());
    commitSnapshot({
      ...next,
      players: playersForTurn,
      actingPlayer: actorIndex,
      currentTurn: (actorIndex + 1) % playersForTurn.length,
    });
    setJustFlippedSeat(actorIndex);
    clearTimer(flipTimeoutRef, window.clearTimeout);
    flipTimeoutRef.current = window.setTimeout(() => setJustFlippedSeat(-1), 500);
  }

  function beginGameLoop(snapshot: GameSnapshot): void {
    gameRunningRef.current = true;
    updateFeedback("idle", t("startRound"));
    advanceTurn(snapshot);

    revealIntervalRef.current = window.setInterval(() => advanceTurn(), mode.revealMs);
    countdownIntervalRef.current = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          finishGame();
          return 0;
        }
        return current - 1;
      });
    }, 1_000);
  }

  function startGame(): void {
    ensureUnlocked();
    stopGameLoops();
    const freshPlayers = createPlayers(settings.playerCount, FRUITS);
    const freshSnapshot: GameSnapshot = {
      ...INITIAL_GAME_SNAPSHOT,
      players: freshPlayers,
      difficulty: settings.difficulty,
      durationSec: settings.duration,
      playerCount: settings.playerCount,
      userSeatId,
      scoreBreakdown: { ...INITIAL_BREAKDOWN },
      reactionTimes: [],
    };

    gameRunningRef.current = false;
    bellStateRef.current = INITIAL_BELL_STATE;
    commitSnapshot(freshSnapshot);
    setResultSummary(null);
    setSecondsLeft(settings.duration);
    setActiveBellFruit(null);
    setPenaltyNotice("");
    setBossTaunt("");
    setFeedback({ type: "idle", message: "" });
    setScreen("play");
    setCountdown(3);

    let tick = 3;
    startupTimeoutRef.current = window.setInterval(() => {
      tick -= 1;
      if (tick > 0) {
        setCountdown(tick);
        return;
      }
      clearTimer(startupTimeoutRef, window.clearInterval);
      setCountdown(0);
      beginGameLoop(freshSnapshot);
    }, 1_000);
  }

  function handleBell(): void {
    if (!gameRunningRef.current || screen !== "play") return;

    const result = resolveSinglePlayerBell({
      state: gameStateRef.current,
      bellState: bellStateRef.current,
      userSeatId: gameStateRef.current.userSeatId,
      mode,
      now: Date.now(),
    });
    bellStateRef.current = result.bellState;
    setActiveBellFruit(result.bellState.fruitKey);
    commitSnapshot({ ...result.state, userSeatId: gameStateRef.current.userSeatId });
    triggerBellPress();

    if (result.kind === "correct") {
      updateFeedback("success", t("bellSuccess", { count: result.collectedCount }));
      playFeedback("success");
      return;
    }

    updateFeedback(
      "error",
      result.penaltyCount ? t("bellPenalty", { count: result.penaltyCount }) : t("bellPenaltyNone"),
    );
    if (result.penaltyCount) {
      setPenaltyNotice(t("penaltyBanner", { count: result.penaltyCount }));
      clearTimer(penaltyTimeoutRef, window.clearTimeout);
      penaltyTimeoutRef.current = window.setTimeout(() => setPenaltyNotice(""), 1_500);
    }
    playFeedback("penalty");
  }

  function finishGame(): void {
    if (!gameRunningRef.current) return;

    gameRunningRef.current = false;
    stopGameLoops();
    const result = finishSinglePlayerMatch(gameStateRef.current, bellStateRef.current);
    const resolvedSnapshot = result.pendingResolution.snapshot;
    const nextSnapshot: GameSnapshot = {
      ...gameStateRef.current,
      ...resolvedSnapshot,
      score: result.summary.score,
      scoreBreakdown: resolvedSnapshot.scoreBreakdown ?? INITIAL_BREAKDOWN,
    };

    bellStateRef.current = result.bellState;
    commitSnapshot(nextSnapshot);
    setResultSummary(result.summary);
    setScreen("result");
  }

  function updateSetting<Key extends keyof GameSettings>(key: Key, value: GameSettings[Key]): void {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    removeLegacyProgress();
  }, []);

  useEffect(() => {
    document.documentElement.lang = settings.language === "zh" ? "zh-CN" : "en";
  }, [settings.language]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (screen === "play" && event.code === "Space") {
        event.preventDefault();
        handleBell();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, settings.difficulty, settings.playerCount]);

  useEffect(() => () => stopGameLoops(), []);

  useEffect(() => {
    screenRegionRef.current?.focus();
  }, [screen]);

  const totals = visibleTotals(players);
  const breakdownRows = [
    ["correctBase", "scoreCorrectBase", true],
    ["collectionBonus", "scoreCollectionBonus", true],
    ["speedBonus", "scoreSpeedBonus", true],
    ["streakBonus", "scoreStreakBonus", true],
    ["wrongPenalty", "scoreWrongPenalty", false],
    ["missedPenalty", "scoreMissedPenalty", false],
    ["cardPenalty", "scoreCardPenalty", false],
  ] as const;

  return (
    <main className="app-shell">
      <section className="app-panel">
        <header className="hero">
          <div><h1>Halligalli Arena</h1></div>
          <p className="hero-rule">{t("heroRule")}</p>
        </header>

        {screen === "home" && (
          <section ref={screenRegionRef} tabIndex={-1} className="stack screen-enter home-enter">
            <div className="card intro">
              <p>{t("startIntro")}</p>
              <div className="button-row">
                <button className="primary-button glow-button" onClick={startGame}>{t("start")}</button>
              </div>
            </div>

            <div className="grid two-up">
              <section className="card">
                <h2>{t("settings")}</h2>
                <div className="control-group">
                  <span>{t("lang")}</span>
                  <div className="chip-row">
                    <button className={settings.language === "zh" ? "chip active" : "chip"} aria-pressed={settings.language === "zh"} onClick={() => updateSetting("language", "zh")}>{t("chinese")}</button>
                    <button className={settings.language === "en" ? "chip active" : "chip"} aria-pressed={settings.language === "en"} onClick={() => updateSetting("language", "en")}>{t("english")}</button>
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("sound")}</span>
                  <div className="chip-row">
                    <button className={settings.soundEnabled ? "chip active" : "chip"} aria-pressed={settings.soundEnabled} onClick={() => updateSetting("soundEnabled", true)}>{t("soundOn")}</button>
                    <button className={!settings.soundEnabled ? "chip active" : "chip"} aria-pressed={!settings.soundEnabled} onClick={() => updateSetting("soundEnabled", false)}>{t("soundOff")}</button>
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("players")}</span>
                  <div className="chip-row">
                    {[2, 3, 4, 5, 6].map((count) => (
                      <button key={count} className={settings.playerCount === count ? "chip active" : "chip"} aria-pressed={settings.playerCount === count} onClick={() => updateSetting("playerCount", count)}>{settings.language === "en" ? `${count}P` : `${count} 人`}</button>
                    ))}
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("difficulty")}</span>
                  <div className="chip-row">
                    {(Object.keys(MODES) as Difficulty[]).map((difficulty) => (
                      <button key={difficulty} className={settings.difficulty === difficulty ? "chip active" : "chip"} aria-pressed={settings.difficulty === difficulty} onClick={() => updateSetting("difficulty", difficulty)}>{modeLabel(difficulty, settings.language)}</button>
                    ))}
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("duration")}</span>
                  <div className="chip-row">
                    {[45, 60, 90].map((duration) => (
                      <button key={duration} className={settings.duration === duration ? "chip active" : "chip"} aria-pressed={settings.duration === duration} onClick={() => updateSetting("duration", duration)}>{duration} {t("seconds")}</button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="card">
                <h2>{t("rules")}</h2>
                <ol className="rule-list">
                  <li>{t("rule1")}</li>
                  <li>{t("rule2")}</li>
                  <li>{t("rule3")}</li>
                  <li>{t("rule4")}</li>
                </ol>
                <p className="deck-note">{t("deckHint")}</p>
                <div className="boss-card">
                  <img className="boss-portrait" src="/yang-boss.png" alt={t("bossTitle")} />
                  <p>{t("bossHint")}</p>
                </div>
              </section>
            </div>

            <section className="card multiplayer-entry" aria-labelledby="multiplayer-entry-title">
              <div>
                <h2 id="multiplayer-entry-title">{t("multiplayer")}</h2>
                <p className="deck-note">{t("entryHint")}</p>
              </div>
              <div className="room-entry-controls">
                <label>
                  <span>{t("playerName")}</span>
                  <input
                    value={roomName}
                    maxLength={24}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder={settings.language === "en" ? "Player" : "玩家"}
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={roomEntry.pending}
                  onClick={() => void roomEntry.createRoom(roomName)}
                >
                  {t("createRoom")}
                </button>
                <label>
                  <span>{t("roomCode")}</span>
                  <input
                    value={joinCode}
                    maxLength={4}
                    onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                    placeholder="ABCD"
                  />
                </label>
                <button
                  className="ghost-button"
                  disabled={roomEntry.pending || !joinCode.trim()}
                  onClick={() => void roomEntry.joinRoom(joinCode, roomName)}
                >
                  {t("joinRoom")}
                </button>
              </div>
              {roomEntry.error && <p className="room-entry-error" role="alert">{roomEntry.error}</p>}
              {roomProjection && (
                <div className="room-entry-snapshot" role="status" aria-live="polite">
                  <strong>{t("roomCode")}: {roomProjection.snapshot.roomCode}</strong>
                  <p>{t("roomStatus", {
                    current: roomProjection.snapshot.participants.length,
                    max: roomProjection.snapshot.maxParticipants,
                  })}</p>
                  <ul>
                    {roomProjection.snapshot.participants.map((participant) => (
                      <li key={participant.seatIndex}>
                        {participant.name}{participant.ready ? " ✓" : ""}
                      </li>
                    ))}
                  </ul>
                  {!roomEntry.connected && <p>{t("roomConnecting")}</p>}
                  {roomProjection.snapshot.phase === "lobby" && (
                    <div className="button-row">
                      <button
                        className="primary-button"
                        disabled={!roomEntry.connected || !roomProjection.canReady}
                        onClick={roomEntry.ready}
                      >
                        {t("readyForMatch")}
                      </button>
                      <button
                        className="ghost-button"
                        disabled={!roomEntry.connected || !roomProjection.canStart}
                        onClick={roomEntry.start}
                      >
                        {t("startMatch")}
                      </button>
                    </div>
                  )}
                  {roomProjection.snapshot.phase === "lobby" && !roomProjection.canStart && (
                    <p>{t("waitingForReady")}</p>
                  )}
                  {roomProjection.snapshot.phase === "playing" && (
                    <div className="multiplayer-match-state">
                      {activeRoomParticipant && <p>{t("turnOwner", { name: activeRoomParticipant.name })}</p>}
                      <div className="multiplayer-cards" aria-label={t("multiplayer")}>
                        {roomProjection.cards.map((card, index) => {
                          const fruit = card && FRUITS.find((item) => item.key === card.fruit);
                          return (
                            <span key={index} className={card ? "multiplayer-card" : "multiplayer-card empty"}>
                              {card ? `${fruit?.icon ?? ""} ×${card.count}` : "—"}
                            </span>
                          );
                        })}
                      </div>
                      <button
                        className="primary-button"
                        disabled={!roomEntry.connected || !roomProjection.canRing}
                        onClick={roomEntry.ringBell}
                      >
                        {t("ringMultiplayerBell")}
                      </button>
                    </div>
                  )}
                  {roomProjection.snapshot.phase === "post_match" && roomProjection.snapshot.result && (
                    <p>{t("matchResult", {
                      seat: roomProjection.snapshot.result.winnerSeatIndex + 1,
                      score: roomProjection.snapshot.result.score,
                    })}</p>
                  )}
                </div>
              )}
            </section>
          </section>
        )}

        {screen === "play" && (
          <section ref={screenRegionRef} tabIndex={-1} className="stack screen-enter">
            {countdown > 0 && <div className="countdown-overlay" role="status" aria-live="assertive" aria-atomic="true"><span className="countdown-number">{countdown}</span></div>}
            <div className="play-topbar minimal">
              <span className="pill">{t("timeLeft", { seconds: secondsLeft })}</span>
              <button className="ghost-button" onClick={finishGame}>{t("endGame")}</button>
            </div>
            <div className={`feedback ${feedback.type}`} aria-live="polite" aria-atomic="true">{feedback.message}</div>
            {penaltyNotice && <div className="penalty-banner" aria-live="assertive" aria-atomic="true">{penaltyNotice}</div>}
            <div className={`table-scene players-${settings.playerCount}`}>
              <div className="table-felt">
                <div className="boss-presence"><img className="boss-presence-avatar" src="/yang-boss.png" alt="" /><span>{t("bossWatching")}</span></div>
                {bossTaunt && <div className="boss-taunt" aria-live="polite" aria-atomic="true">{bossTaunt}</div>}
                {seatLayouts.map((seat, index) => {
                  const player = players[index];
                  if (!player) return null;
                  const topCard = getTopCard(player);
                  const active = Boolean(activeBellFruit && topCard?.fruit === activeBellFruit && totals[activeBellFruit] === 5);
                  return <TableSeat key={player.id} player={player} seat={seat} active={active} currentTurn={gameStateRef.current.actingPlayer === index} language={settings.language} compact={compactCards} justFlipped={justFlippedSeat === index} />;
                })}
                <div className={activeBellFruit ? "center-bell is-ready" : "center-bell"}>
                  <button className={bellPressed ? "bell-button pressed" : "bell-button"} onClick={handleBell} aria-label={activeBellFruit ? t("bellReady", { fruit: fruitLabel(activeBellFruit, settings.language) }) : t("bellWait")} aria-pressed={bellPressed}>铃</button>
                </div>
              </div>
            </div>
            <div className="totals-grid compact" aria-label={t("rules")}>
              {FRUITS.map((fruit) => <div key={fruit.key} className={totals[fruit.key] === 5 ? "total-item total-match" : "total-item"}><span>{fruit.icon} {settings.language === "en" ? fruit.labelEn : fruit.label}</span><strong>{totals[fruit.key]}</strong></div>)}
            </div>
          </section>
        )}

        {screen === "result" && resultSummary && (
          <section ref={screenRegionRef} tabIndex={-1} className="stack screen-enter">
            <div className="card result-hero">
              <p className="eyebrow">{t("finish")}</p>
              <h2>{resultSummary.score} {t("scoreUnit")}</h2>
              <p>{t("resultLine", { players: resultSummary.playerCount, accuracy: Math.round(resultSummary.accuracy * 100), avg: resultSummary.avgReactionMs || "-" })}</p>
            </div>
            <div className="grid two-up">
              <section className="card">
                <h2>{t("accuracy")}</h2>
                <dl className="stats-list">
                  <div><dt>{t("correctHits")}</dt><dd>{resultSummary.correctHits}</dd></div>
                  <div><dt>{t("wrongHits")}</dt><dd>{resultSummary.wrongHits}</dd></div>
                  <div><dt>{t("missedHits")}</dt><dd>{resultSummary.missedHits}</dd></div>
                  <div><dt>{t("bestReaction")}</dt><dd>{resultSummary.bestReactionMs || "-"} ms</dd></div>
                </dl>
              </section>
              <section className="card">
                <h2>{t("currentDifficulty")}</h2>
                <dl className="stats-list">
                  <div><dt>{t("difficulty")}</dt><dd>{modeLabel(resultSummary.difficulty, settings.language)}</dd></div>
                  <div><dt>{t("duration")}</dt><dd>{resultSummary.durationSec} {t("seconds")}</dd></div>
                  <div><dt>{t("avgReaction")}</dt><dd>{resultSummary.avgReactionMs || "-"} ms</dd></div>
                </dl>
              </section>
            </div>
            <section className="score-reel">
              <div className="score-reel-head"><h2>{t("breakdownTitle")}</h2><p>{t("breakdownDesc")}</p></div>
              <div className="score-reel-list">
                {breakdownRows.filter(([key]) => scoreBreakdown[key] > 0).map(([key, label, positive], index) => <div key={key} className={positive ? "score-row positive" : "score-row negative"} style={{ animationDelay: `${index * 120}ms` }}><span>{t(label)}</span><strong>{positive ? "+" : "-"}{scoreBreakdown[key]}</strong></div>)}
                <div className="score-row total" style={{ animationDelay: `${breakdownRows.length * 120}ms` }}><span>{t("finalScore")}</span><strong>{resultSummary.score}</strong></div>
              </div>
            </section>
            <div className="button-row">
              <button className="primary-button" onClick={startGame}>{t("playAgain")}</button>
              <button className="ghost-button" onClick={() => setScreen("home")}>{t("backHome")}</button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
