import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useAudioEngine } from "./audio/useAudioEngine.js";
import { projectRoomSnapshot } from "./multiplayer/projection.js";
import { useRoomEntry } from "./multiplayer/room-entry.js";
import { FRUITS, MODES } from "./game/catalog.js";
import { DEFAULT_SETTINGS } from "./game/constants.js";
import { loadSettings, removeLegacyProgress, saveSettings } from "./game/persistence.js";
import { getTopCard, visibleTotals } from "./game/rules.js";
import type { Card, Difficulty, FruitKey, GameSettings } from "./game/types.js";
import { useSoloRound } from "./solo/useSoloRound.js";
import type { SoloRoundNotice } from "./solo/useSoloRound.js";
import { useBellPress } from "./useBellPress.js";

type Screen = "home" | "play" | "result";
type FeedbackType = "idle" | "success" | "warn" | "error";

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
    kicker: "恰好五个 · 反应训练",
    timeLabel: "剩余",
    scoreLabel: "得分",
    you: "你",
    seatShort: "座位 {seat}",
    visibleTotals: "桌面水果合计",
    heroRule: "顺时针翻牌，只看桌面最上层，出现刚好 5 个同类水果就抢铃",
    startIntro: "单人训练：调好设置直接开打，边练手速边磨判断力。",
    start: "开始练习",
    settings: "开局设置",
    players: "桌面座位",
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
    gameUpdate: "场上提示",
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
    resultLine: "{players} 个桌面座位，1 位真人，正确率 {accuracy}%，平均反应 {avg} ms",
    bellReady: "抢铃 — {fruit}已凑齐5个",
    bellWait: "抢铃（等待时机）",
    multiplayer: "多人房间",
    playerName: "玩家名",
    roomCode: "房间码",
    joinRoom: "加入房间",
    roomStatus: "大厅：{current}/{max} 位玩家",
    entryHint: "凭证只保留在当前页面内；刷新后需要重新加入。",
    roomConnecting: "正在连接房间…",
    readyForMatch: "准备对局",
    startMatch: "开始对局",
    ringMultiplayerBell: "抢铃",
    waitingForReady: "等待至少两位玩家全部准备",
    turnOwner: "当前翻牌：{name}",
    matchResult: "{name} 获胜，获得 {score} 分",
    scoreboardTitle: "多人得分明细",
    seatLabel: "座位 {seat}",
    correctBellEvent: "抢铃成功，得分已由服务器确认。",
    wrongBellEvent: "错拍，已按当前得分应用惩罚。",
    missedBellEvent: "漏拍，已按当前得分应用惩罚。",
    continueMatch: "继续下一局",
    leaveRoom: "离开房间",
    forfeitMatch: "认输并退出本局",
    forfeitEvent: "有玩家认输，已退出本局。",
    forfeitedTag: "已认输",
    playerPlaceholder: "玩家",
    roomSeats: "桌面座位",
    humanPlayers: "真人玩家",
    createRoomFor: "创建 {seats} 座位 / {humans} 真人房间",
    neutralSeat: "中立座位",
  },
  en: {
    kicker: "Exact-five reaction trainer",
    timeLabel: "Time",
    scoreLabel: "Score",
    you: "You",
    seatShort: "Seat {seat}",
    visibleTotals: "Visible fruit totals",
    heroRule: "Flip cards clockwise, count only the top visible cards, ring when one fruit totals exactly 5",
    startIntro: "Solo training: tune the table, then sharpen your reflexes and judgment.",
    start: "Start Practice",
    settings: "Setup",
    players: "Table Seats",
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
    gameUpdate: "Table update",
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
    resultLine: "{players} Table Seats, 1 human, {accuracy}% accuracy, avg reaction {avg} ms",
    bellReady: "Ring — {fruit} ×5",
    bellWait: "Ring bell (waiting for condition)",
    multiplayer: "Multiplayer room",
    playerName: "Player name",
    roomCode: "Room code",
    joinRoom: "Join room",
    roomStatus: "Lobby: {current}/{max} players",
    entryHint: "The participant credential stays only in this page; rejoin after refresh.",
    roomConnecting: "Connecting to room…",
    readyForMatch: "Ready for match",
    startMatch: "Start match",
    ringMultiplayerBell: "Ring bell",
    waitingForReady: "Waiting for at least two ready players",
    turnOwner: "Current turn: {name}",
    matchResult: "{name} wins with {score} points",
    scoreboardTitle: "Multiplayer score breakdown",
    seatLabel: "Seat {seat}",
    correctBellEvent: "Successful ring. The server confirmed the score.",
    wrongBellEvent: "Wrong ring. The penalty was applied to the current score.",
    missedBellEvent: "Missed bell. The penalty was applied to the current score.",
    continueMatch: "Continue to next match",
    leaveRoom: "Leave room",
    forfeitMatch: "Forfeit this match",
    forfeitEvent: "A player forfeited and left this match.",
    forfeitedTag: "Forfeited",
    playerPlaceholder: "Player",
    roomSeats: "Table Seats",
    humanPlayers: "Human players",
    createRoomFor: "Create {seats}-seat room for {humans}",
    neutralSeat: "Neutral Seat",
  },
} as const;

type CopyKey = keyof typeof COPY.en;

const NOTICE_TONES: Record<SoloRoundNotice["kind"], FeedbackType> = {
  start: "idle",
  observe: "idle",
  missed: "warn",
  correct: "success",
  wrong: "error",
};

function fruitLabel(fruitKey: FruitKey | null, language: GameSettings["language"]): string {
  const fruit = FRUITS.find((item) => item.key === fruitKey);
  return language === "en" ? fruit?.labelEn ?? "" : fruit?.label ?? "";
}

function modeLabel(difficulty: Difficulty, language: GameSettings["language"]): string {
  const mode = MODES[difficulty];
  return language === "en" ? mode.labelEn : mode.label;
}

type CardFace = Pick<Card, "fruit" | "count">;

interface TableSeatView {
  key: number;
  label: string;
  isYou: boolean;
  currentTurn: boolean;
  active: boolean;
  card: CardFace | null;
  revealSequence: number | null;
}

function FruitCardFace({ card }: { card: CardFace | null }) {
  const fruit = card ? FRUITS.find((item) => item.key === card.fruit) : null;
  const positions = card ? PIP_LAYOUTS[card.count as keyof typeof PIP_LAYOUTS] ?? [] : [];

  return (
    <div className="play-card-face">
      {card && (
        <div className={`play-card-pips count-${card.count}`}>
          {positions.map((slot, index) => (
            <span key={`${slot}-${index}`} className={`pip slot-${slot}`}>
              {fruit?.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BellIcon() {
  return (
    <svg className="bell-icon" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="12" r="4" />
      <path d="M32 18c-11 0-20 8.6-20 20v4h40v-4c0-11.4-9-20-20-20Z" />
      <rect x="6" y="45" width="52" height="7" rx="3.5" />
    </svg>
  );
}

function TableSeat({ seat, angle }: { seat: TableSeatView; angle: number }) {
  const innerClass = [
    "card-3d-inner",
    seat.card && "face-up",
    seat.revealSequence !== null && "just-flipped",
  ].filter(Boolean).join(" ");
  const seatClass = ["table-seat", seat.currentTurn && "current-turn", seat.isYou && "is-you"]
    .filter(Boolean).join(" ");

  return (
    <article
      className={seatClass}
      style={{ "--seat-angle": `${angle}deg` } as CSSProperties}
      aria-current={seat.currentTurn ? "true" : undefined}
    >
      <span className="seat-label">{seat.label}</span>
      <div className={["table-card-shell", seat.active && "active", seat.currentTurn && "current"].filter(Boolean).join(" ")}>
        <div className="card-3d-container">
          <div key={seat.revealSequence ?? "settled"} className={innerClass} data-reveal-sequence={seat.revealSequence ?? undefined}>
            <div className="card-3d-back"><div className="card-back" /></div>
            <div className="card-3d-front"><FruitCardFace card={seat.card} /></div>
          </div>
        </div>
      </div>
    </article>
  );
}

function GameTable({
  seats,
  viewerIndex,
  bellReady,
  bellPressed,
  bellLabel,
  bellDisabled = false,
  onBell,
  children,
}: {
  seats: TableSeatView[];
  viewerIndex: number;
  bellReady: boolean;
  bellPressed: boolean;
  bellLabel: string;
  bellDisabled?: boolean;
  onBell: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={`table-scene seats-${seats.length}`}>
      <div className="table-felt">
        {children}
        {seats.map((seat, index) => (
          <TableSeat key={seat.key} seat={seat} angle={90 + ((index - viewerIndex) * 360) / seats.length} />
        ))}
        <div className={bellReady ? "center-bell is-ready" : "center-bell"}>
          <button
            className={bellPressed ? "bell-button pressed" : "bell-button"}
            onClick={onBell}
            disabled={bellDisabled}
            aria-label={bellLabel}
          >
            <BellIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [settings, setSettings] = useState<GameSettings>(loadSettings);
  const [showHome, setShowHome] = useState(true);
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomSeatCount, setRoomSeatCount] = useState(settings.tableSeatCount);
  const [roomHumanTarget, setRoomHumanTarget] = useState(2);
  const [roomDifficulty, setRoomDifficulty] = useState<Difficulty>(DEFAULT_SETTINGS.difficulty);

  const screenRegionRef = useRef<HTMLElement | null>(null);
  const multiplayerSignalRef = useRef<{ sequence: number; correct: number; wrong: number; missed: number } | null>(null);

  const mode = MODES[settings.difficulty];
  const isBossMode = "isBoss" in mode && mode.isBoss;
  const copy = COPY[settings.language];
  const { playFeedback, previewSound } = useAudioEngine(settings.soundEnabled);
  const round = useSoloRound(playFeedback);
  const screen: Screen = showHome ? "home" : round.state.phase === "finished" ? "result" : "play";
  const [multiplayerBellPressed, pressMultiplayerBell] = useBellPress();
  const roomEntry = useRoomEntry();
  const roomProjection = roomEntry.session
    ? projectRoomSnapshot(roomEntry.session.snapshot)
    : null;
  const activeRoomParticipant = roomProjection?.snapshot.participants.find(
    (participant) => participant.seatIndex === roomProjection.snapshot.currentTurnSeatIndex,
  );

  function t(key: CopyKey, values: Record<string, number | string> = {}): string {
    let message: string = copy[key];
    for (const [name, value] of Object.entries(values)) {
      message = message.replaceAll(`{${name}}`, String(value));
    }
    return message;
  }

  function startRound(): void {
    setShowHome(false);
    round.start({
      tableSeatCount: settings.tableSeatCount,
      difficulty: settings.difficulty,
      durationSec: settings.duration,
    });
  }

  function noticeMessage(notice: SoloRoundNotice): string {
    switch (notice.kind) {
      case "start":
        return t("startRound");
      case "observe":
        return t("idleObserve");
      case "missed":
        return t("missedBell", { fruit: fruitLabel(notice.fruit, settings.language) });
      case "correct":
        return t("bellSuccess", { count: notice.collectedCount });
      case "wrong":
        return notice.penaltyCount ? t("bellPenalty", { count: notice.penaltyCount }) : t("bellPenaltyNone");
    }
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
        round.ring();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [screen, round.ring]);

  const roomSnapshot = roomEntry.session?.snapshot;
  useEffect(() => {
    if (!roomSnapshot || roomSnapshot.phase !== "playing") {
      multiplayerSignalRef.current = null;
      return;
    }
    const current = roomSnapshot.scoreboard.reduce(
      (sum, row) => ({
        sequence: sum.sequence,
        correct: sum.correct + row.correctHits,
        wrong: sum.wrong + row.wrongHits,
        missed: sum.missed + row.missedHits,
      }),
      { sequence: roomSnapshot.lastReveal?.sequence ?? 0, correct: 0, wrong: 0, missed: 0 },
    );
    const previous = multiplayerSignalRef.current;
    multiplayerSignalRef.current = current;
    if (!previous) return;
    if (current.correct > previous.correct) playFeedback("success");
    else if (current.wrong > previous.wrong) playFeedback("penalty");
    else if (current.missed > previous.missed) playFeedback("warn");
    else if (current.sequence !== previous.sequence) playFeedback("flip");
  }, [roomSnapshot, playFeedback]);

  useEffect(() => {
    screenRegionRef.current?.focus();
  }, [screen]);

  const { countdown, secondsLeft, bellFruit: activeBellFruit, bellPressed, reveal: latestReveal, summary: resultSummary } = round.state;
  const { players, score, scoreBreakdown, actingPlayer } = round.state.match;
  const feedbackType = NOTICE_TONES[round.state.notice.kind];
  const bossTauntChoices = BOSS_TAUNTS[settings.language];
  const bossTaunt = round.state.bossTauntRoll === null
    ? ""
    : bossTauntChoices[Math.floor(round.state.bossTauntRoll * bossTauntChoices.length)] ?? "";
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
        <header className={screen === "home" ? "hero" : "hero is-compact"}>
          <div>
            <p className="hero-kicker">{t("kicker")}</p>
            <h1>Halligalli Arena</h1>
          </div>
          {screen === "home" && <p className="hero-rule">{t("heroRule")}</p>}
        </header>

        {screen === "home" && (
          <section ref={screenRegionRef} tabIndex={-1} className="stack screen-enter home-enter">
            <div className="card intro">
              <div className="intro-copy">
                <p>{t("startIntro")}</p>
                <p className="setup-summary">
                  <span>{settings.language === "en" ? `${settings.tableSeatCount} seats` : `${settings.tableSeatCount} 个座位`}</span>
                  <span>{modeLabel(settings.difficulty, settings.language)}</span>
                  <span>{settings.duration} {t("seconds")}</span>
                </p>
              </div>
              <button className="primary-button start-button" onClick={startRound}>{t("start")}</button>
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
                    <button className={settings.soundEnabled ? "chip active" : "chip"} aria-pressed={settings.soundEnabled} onClick={() => { updateSetting("soundEnabled", true); previewSound(); }}>{t("soundOn")}</button>
                    <button className={!settings.soundEnabled ? "chip active" : "chip"} aria-pressed={!settings.soundEnabled} onClick={() => updateSetting("soundEnabled", false)}>{t("soundOff")}</button>
                  </div>
                </div>
                <div className="control-group">
                  <span>{t("players")}</span>
                  <div className="chip-row">
                  {[4, 5, 6, 7, 8].map((count) => (
                      <button key={count} className={settings.tableSeatCount === count ? "chip active" : "chip"} aria-pressed={settings.tableSeatCount === count} onClick={() => updateSetting("tableSeatCount", count)}>{settings.language === "en" ? `${count} seats` : `${count} 个座位`}</button>
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
                  <div>
                    <strong>{t("bossTitle")}</strong>
                    <p>{t("bossHint")}</p>
                  </div>
                </div>
              </section>
            </div>

            <section className="card multiplayer-entry" aria-labelledby="multiplayer-entry-title">
              <div>
                <h2 id="multiplayer-entry-title">{t("multiplayer")}</h2>
                <p className="deck-note">{t("entryHint")}</p>
              </div>
              {!roomProjection && <div className="room-entry-controls">
                <label>
                  <span>{t("playerName")}</span>
                  <input
                    value={roomName}
                    maxLength={24}
                    onChange={(event) => setRoomName(event.target.value)}
                    placeholder={t("playerPlaceholder")}
                  />
                </label>
                <label>
                  <span>{t("roomSeats")}</span>
                  <select value={roomSeatCount} onChange={(event) => {
                    const count = Number(event.target.value);
                    setRoomSeatCount(count);
                    setRoomHumanTarget((current) => Math.min(current, count));
                  }}>
                    {[4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t("humanPlayers")}</span>
                  <select value={roomHumanTarget} onChange={(event) => setRoomHumanTarget(Number(event.target.value))}>
                    {Array.from({ length: roomSeatCount - 1 }, (_, index) => index + 2).map((count) => <option key={count} value={count}>{count}</option>)}
                  </select>
                </label>
                <label>
                  <span>{t("difficulty")}</span>
                  <select value={roomDifficulty} onChange={(event) => setRoomDifficulty(event.target.value as Difficulty)}>
                    {(Object.keys(MODES) as Difficulty[]).map((difficulty) => <option key={difficulty} value={difficulty}>{modeLabel(difficulty, settings.language)}</option>)}
                  </select>
                </label>
                <button
                  className="primary-button"
                  disabled={roomEntry.pending}
                  onClick={() => void roomEntry.createRoom(roomName, {
                    tableSeatCount: roomSeatCount,
                    targetHumanParticipantCount: roomHumanTarget,
                    difficulty: roomDifficulty,
                  })}
                >
                  {t("createRoomFor", { seats: roomSeatCount, humans: roomHumanTarget })}
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
              </div>}
              {roomEntry.error && <p className="room-entry-error" role="alert">{roomEntry.error}</p>}
              {roomProjection && (
                <div className="room-entry-snapshot" role="status" aria-live="polite">
                  <strong>{t("roomCode")}: {roomProjection.snapshot.roomCode}</strong>
                  <p>{t("roomStatus", {
                    current: roomProjection.snapshot.participants.length,
                    max: roomProjection.snapshot.configuration.targetHumanParticipantCount,
                  })}</p>
                  <ul className="room-participants">
                    {roomProjection.seats.map((seat) => (
                      <li key={seat.seatIndex}>
                        {t("seatLabel", { seat: seat.seatNumber })} · {seat.occupied ? seat.name : t("neutralSeat")}{seat.ready ? " ✓" : ""}
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
                      <button className="ghost-button" disabled={!roomEntry.connected} onClick={roomEntry.leaveRoom}>
                        {t("leaveRoom")}
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
                      <GameTable
                        seats={roomProjection.seats.map((seat) => ({
                          key: seat.seatIndex,
                          label: seat.occupied ? seat.name : t("seatShort", { seat: seat.seatNumber }),
                          isYou: seat.seatIndex === roomProjection.snapshot.viewerSeatIndex,
                          currentTurn: seat.currentTurn,
                          active: false,
                          card: seat.card ?? null,
                          revealSequence: roomProjection.snapshot.lastReveal?.seatIndex === seat.seatIndex
                            ? roomProjection.snapshot.lastReveal.sequence
                            : null,
                        }))}
                        viewerIndex={roomProjection.snapshot.viewerSeatIndex}
                        bellReady={false}
                        bellPressed={multiplayerBellPressed}
                        bellLabel={t("ringMultiplayerBell")}
                        bellDisabled={!roomEntry.connected || !roomProjection.canRing}
                        onBell={() => {
                          roomEntry.ringBell();
                          pressMultiplayerBell();
                          playFeedback("ring");
                        }}
                      />
                      <button className="ghost-button" disabled={!roomEntry.connected || !roomProjection.snapshot.allowedCommands.includes("forfeit")} onClick={roomEntry.forfeit}>
                        {t("forfeitMatch")}
                      </button>
                    </div>
                  )}
                  {roomProjection.snapshot.lastEvent === "correct_bell" && (
                    <p className="multiplayer-event">{t("correctBellEvent")}</p>
                  )}
                  {roomProjection.snapshot.lastEvent === "wrong_bell" && (
                    <p className="multiplayer-event">{t("wrongBellEvent")}</p>
                  )}
                  {roomProjection.snapshot.lastEvent === "missed_bell" && (
                    <p className="multiplayer-event">{t("missedBellEvent")}</p>
                  )}
                  {roomProjection.snapshot.lastEvent === "forfeit" && (
                    <p className="multiplayer-event">{t("forfeitEvent")}</p>
                  )}
                  {roomProjection.snapshot.scoreboard.length > 0 && (
                    <section className="multiplayer-scoreboard" aria-label={t("scoreboardTitle")}>
                      <h3>{t("scoreboardTitle")}</h3>
                      {roomProjection.snapshot.scoreboard.map((score) => (
                        <article className="multiplayer-score-row" key={score.seatIndex}>
                          <div className="multiplayer-score-heading">
                            <strong>{score.name}{score.forfeited ? ` · ${t("forfeitedTag")}` : ""}</strong>
                            <span>{score.score} {t("scoreUnit")}</span>
                          </div>
                          <p>
                            {t("correctHits")} {score.correctHits} · {t("wrongHits")} {score.wrongHits} · {t("missedHits")} {score.missedHits}
                          </p>
                          <div className="multiplayer-score-breakdown">
                            <span>{t("scoreCorrectBase")} +{score.scoreBreakdown.correctBase}</span>
                            <span>{t("scoreCollectionBonus")} +{score.scoreBreakdown.collectionBonus}</span>
                            <span>{t("scoreSpeedBonus")} +{score.scoreBreakdown.speedBonus}</span>
                            <span>{t("scoreStreakBonus")} +{score.scoreBreakdown.streakBonus}</span>
                            <span>{t("scoreWrongPenalty")} −{score.scoreBreakdown.wrongPenalty}</span>
                            <span>{t("scoreMissedPenalty")} −{score.scoreBreakdown.missedPenalty}</span>
                            <span>{t("scoreCardPenalty")} −{score.scoreBreakdown.cardPenalty}</span>
                          </div>
                        </article>
                      ))}
                    </section>
                  )}
                  {roomProjection.snapshot.phase === "post_match" && roomProjection.snapshot.result && (
                    <>
                      <p>{t("matchResult", {
                        name: roomProjection.snapshot.result.winnerName,
                        score: roomProjection.snapshot.result.score,
                      })}</p>
                      <button className="primary-button" disabled={!roomEntry.connected || !roomProjection.snapshot.allowedCommands.includes("continue")} onClick={roomEntry.continueMatch}>
                        {t("continueMatch")}
                      </button>
                      <button className="ghost-button" disabled={!roomEntry.connected} onClick={roomEntry.leaveAfterMatch}>
                        {t("leaveRoom")}
                      </button>
                    </>
                  )}
                </div>
              )}
            </section>
          </section>
        )}

        {screen === "play" && (
          <section ref={screenRegionRef} tabIndex={-1} className="play-screen screen-enter">
            {countdown && <div className="countdown-overlay" role="status" aria-live="assertive" aria-atomic="true"><span key={`${countdown.runId}-${countdown.value}`} className="countdown-number" data-countdown-run={countdown.runId} data-countdown-value={countdown.value}>{countdown.value}</span></div>}
            <div className="play-hud" style={{ "--progress": secondsLeft / Math.max(1, settings.duration) } as CSSProperties}>
              <div className="hud-stat">
                <span className="hud-label">{t("timeLabel")}</span>
                <strong className="hud-value" aria-label={t("timeLeft", { seconds: secondsLeft })}>{secondsLeft}<small>{t("seconds")}</small></strong>
              </div>
              <div className="hud-stat">
                <span className="hud-label">{t("scoreLabel")}</span>
                <strong className="hud-value">{score}</strong>
              </div>
              <div className={isBossMode ? "boss-presence is-boss" : "boss-presence"}>
                <img className="boss-presence-avatar" src="/yang-boss.png" alt="" />
                <span>{isBossMode ? t("bossWatching") : modeLabel(settings.difficulty, settings.language)}</span>
              </div>
              <button className="ghost-button hud-end" disabled={Boolean(countdown)} onClick={round.end}>{t("endGame")}</button>
              <span className="hud-progress" aria-hidden="true" />
            </div>
            <div
              className={`game-feedback ${feedbackType}`}
              role="status"
              aria-live={feedbackType === "error" ? "assertive" : "polite"}
              aria-atomic="true"
            >
              <span className="game-feedback-label">{t("gameUpdate")}</span>
              <span className="game-feedback-message">{noticeMessage(round.state.notice)}</span>
            </div>
            <GameTable
              seats={players.map((player, index) => {
                const topCard = getTopCard(player);
                return {
                  key: player.id,
                  label: player.isHuman ? t("you") : t("seatShort", { seat: index + 1 }),
                  isYou: player.isHuman,
                  currentTurn: actingPlayer === index,
                  active: Boolean(activeBellFruit && topCard?.fruit === activeBellFruit && totals[activeBellFruit] === 5),
                  card: topCard,
                  revealSequence: latestReveal?.seatIndex === index ? latestReveal.sequence : null,
                };
              })}
              viewerIndex={round.state.userSeatId}
              bellReady={Boolean(activeBellFruit)}
              bellPressed={bellPressed}
              bellLabel={activeBellFruit ? t("bellReady", { fruit: fruitLabel(activeBellFruit, settings.language) }) : t("bellWait")}
              onBell={round.ring}
            >
              {bossTaunt && <div className="boss-taunt" aria-live="polite" aria-atomic="true">{bossTaunt}</div>}
            </GameTable>
            <div className="totals-strip" aria-label={t("visibleTotals")}>
              {FRUITS.map((fruit) => (
                <div key={fruit.key} className={totals[fruit.key] === 5 ? "total-item total-match" : "total-item"}>
                  <span className="total-icon" aria-hidden="true">{fruit.icon}</span>
                  <span className="total-name">{settings.language === "en" ? fruit.labelEn : fruit.label}</span>
                  <strong>{totals[fruit.key]}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {screen === "result" && resultSummary && (
          <section ref={screenRegionRef} tabIndex={-1} className="stack screen-enter">
            <div className="card result-hero">
              <p className="eyebrow">{t("finish")}</p>
              <h2>{resultSummary.score} {t("scoreUnit")}</h2>
              <p>{t("resultLine", { players: resultSummary.tableSeatCount, accuracy: Math.round(resultSummary.accuracy * 100), avg: resultSummary.avgReactionMs || "-" })}</p>
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
              <button className="primary-button" onClick={startRound}>{t("playAgain")}</button>
              <button className="ghost-button" onClick={() => setShowHome(true)}>{t("backHome")}</button>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
