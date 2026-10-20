import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { DIFFICULTIES, FRUITS } from "./game/catalog.js";
import type { Difficulty, FruitKey } from "./game/catalog.js";
import { projectRoomSnapshot } from "./multiplayer/projection.js";
import { useRoomEntry } from "./multiplayer/room-entry.js";
import { useBellPress } from "./useBellPress.js";

const PIP_LAYOUTS = {
  1: ["center"],
  2: ["mid-left", "mid-right"],
  3: ["top-center", "center", "bottom-center"],
  4: ["top-left", "top-right", "bottom-left", "bottom-right"],
  5: ["top-left", "top-right", "center", "bottom-left", "bottom-right"],
} as const;

const COPY = {
  kicker: "Exact-five reaction trainer",
  heroRule: "Flip cards clockwise, count only the top visible cards, ring when one fruit totals exactly 5",
  practiceIntro: "Practice alone: you take one seat and the other seats are Neutral Seats that flip cards but never ring or score.",
  practice: "Practice alone",
  rules: "Rules",
  rule1: "Players flip clockwise. A new face-up card covers the old one immediately.",
  rule2: "Only the top face-up card of each player counts.",
  rule3: "If one fruit totals exactly 5, ring the bell. The winner takes all face-up cards.",
  rule4: "If you ring by mistake, pay half the table cards rounded up to your own pile.",
  deckHint: "2s and 3s are most common, making exact-five combinations more likely.",
  seatShort: "Seat {seat}",
  difficulty: "Difficulty",
  scoreUnit: "pts",
  correctHits: "Correct rings",
  wrongHits: "Wrong rings",
  missedHits: "Missed chances",
  scoreCorrectBase: "Correct ring base",
  scoreCollectionBonus: "Table card bonus",
  scoreSpeedBonus: "Speed bonus",
  scoreStreakBonus: "Streak bonus",
  scoreWrongPenalty: "Wrong ring penalty",
  scoreMissedPenalty: "Missed bell penalty",
  scoreCardPenalty: "Penalty card deduction",
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
  waitingForReady: "Waiting for every player to be ready",
  turnOwner: "Current turn: {name}",
  matchResult: "{name} wins with {score} points",
  matchResultNoWinner: "Everyone forfeited. No one wins this match.",
  scoreboardTitle: "Score breakdown",
  seatLabel: "Seat {seat}",
  correctBellEvent: "Successful ring. The server confirmed the score.",
  wrongBellEvent: "Wrong ring. The penalty was applied to the current score.",
  staleBellEvent: "Too slow. That ring did not count.",
  missedBellEvent: "Missed bell. The penalty was applied to the current score.",
  continueMatch: "Play again",
  leaveRoom: "Leave room",
  forfeitMatch: "Forfeit this match",
  errorRoomNotFound: "The room does not exist or has expired.",
  errorRoomFull: "The room is full.",
  errorRoomNotJoinable: "The match has started; the room cannot be joined now.",
  errorHostRequired: "Only the host can start the match.",
  errorPlayersNotReady: "Every player must be ready before the match starts.",
  errorCommandUnavailable: "That action is not available right now.",
  errorInvalidRequest: "The request is invalid. Check the room settings.",
  errorConnectionUnavailable: "The room connection is unavailable; reconnecting.",
  errorGeneric: "That did not work. Please try again.",
  forfeitEvent: "A player forfeited and left this match.",
  forfeitedTag: "Forfeited",
  playerPlaceholder: "Player",
  roomSeats: "Table Seats",
  humanPlayers: "Human players",
  createRoomFor: "Create {seats}-seat room for {humans}",
  neutralSeat: "Neutral Seat",
} as const;

type CopyKey = keyof typeof COPY;

const ROOM_ERROR_COPY: Record<string, CopyKey> = {
  room_not_found: "errorRoomNotFound",
  room_full: "errorRoomFull",
  room_not_joinable: "errorRoomNotJoinable",
  match_already_started: "errorRoomNotJoinable",
  host_required: "errorHostRequired",
  players_not_ready: "errorPlayersNotReady",
  already_ready: "errorCommandUnavailable",
  match_not_running: "errorCommandUnavailable",
  post_match_not_active: "errorCommandUnavailable",
  forfeit_not_allowed: "errorCommandUnavailable",
  leave_not_allowed: "errorCommandUnavailable",
  participant_departed: "errorCommandUnavailable",
  invalid_request: "errorInvalidRequest",
  invalid_room_configuration: "errorInvalidRequest",
  connection_unavailable: "errorConnectionUnavailable",
};

function roomErrorCopyKey(code: string): CopyKey {
  return ROOM_ERROR_COPY[code] ?? "errorGeneric";
}

function t(key: CopyKey, values: Record<string, number | string> = {}): string {
  let message: string = COPY[key];
  for (const [name, value] of Object.entries(values)) {
    message = message.replaceAll(`{${name}}`, String(value));
  }
  return message;
}

interface CardFace {
  fruit: FruitKey;
  count: number;
}

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
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomSeatCount, setRoomSeatCount] = useState(4);
  const [roomHumanTarget, setRoomHumanTarget] = useState(2);
  const [roomDifficulty, setRoomDifficulty] = useState<Difficulty>("normal");
  const [practicing, setPracticing] = useState(false);
  const autoCommandRef = useRef<string | null>(null);

  const [multiplayerBellPressed, pressMultiplayerBell] = useBellPress();
  const roomEntry = useRoomEntry();
  const roomProjection = roomEntry.session
    ? projectRoomSnapshot(roomEntry.session.snapshot)
    : null;
  const activeRoomParticipant = roomProjection?.snapshot.participants.find(
    (participant) => participant.seatIndex === roomProjection.snapshot.currentTurnSeatIndex,
  );

  const phase = roomProjection?.snapshot.phase;
  const canReady = roomProjection?.canReady ?? false;
  const canStart = roomProjection?.canStart ?? false;
  const canRing = roomProjection?.canRing ?? false;
  const revision = roomProjection?.snapshot.revision ?? 0;
  const { connected, ready, start, ringBell } = roomEntry;

  // Practice alone is an ordinary one-human room that readies and starts itself once connected.
  useEffect(() => {
    if (!practicing || phase !== "lobby" || !connected) return;
    const next = canStart ? "start" : canReady ? "ready" : null;
    if (next === null) return;
    const key = `${next}-${revision}`;
    if (autoCommandRef.current === key) return;
    autoCommandRef.current = key;
    if (next === "start") start();
    else ready();
  }, [practicing, phase, connected, canReady, canStart, revision, ready, start]);

  useEffect(() => {
    if (!roomProjection) {
      setPracticing(false);
      autoCommandRef.current = null;
    }
  }, [roomProjection === null]);

  useEffect(() => {
    if (phase !== "playing") return;
    function onKeyDown(event: KeyboardEvent): void {
      if (event.code !== "Space" || !connected || !canRing) return;
      event.preventDefault();
      ringBell();
      pressMultiplayerBell();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, connected, canRing, ringBell, pressMultiplayerBell]);

  function practiceAlone(): void {
    setPracticing(true);
    void roomEntry.createRoom(roomName, {
      tableSeatCount: roomSeatCount,
      targetHumanParticipantCount: 1,
      difficulty: roomDifficulty,
    });
  }

  return (
    <main className="app-shell">
      <section className="app-panel">
        <header className={roomProjection ? "hero is-compact" : "hero"}>
          <div>
            <p className="hero-kicker">{t("kicker")}</p>
            <h1>Halligalli Arena</h1>
          </div>
          {!roomProjection && <p className="hero-rule">{t("heroRule")}</p>}
        </header>

        <section className="stack screen-enter">
          {!roomProjection && (
            <>
              <div className="card intro">
                <div className="intro-copy">
                  <p>{t("practiceIntro")}</p>
                  <div className="control-group">
                    <span>{t("difficulty")}</span>
                    <div className="chip-row">
                      {DIFFICULTIES.map((difficulty) => (
                        <button
                          key={difficulty.key}
                          className={roomDifficulty === difficulty.key ? "chip active" : "chip"}
                          aria-pressed={roomDifficulty === difficulty.key}
                          onClick={() => setRoomDifficulty(difficulty.key)}
                        >
                          {difficulty.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button className="primary-button start-button" disabled={roomEntry.pending} onClick={practiceAlone}>
                  {t("practice")}
                </button>
              </div>

              <section className="card">
                <h2>{t("rules")}</h2>
                <ol className="rule-list">
                  <li>{t("rule1")}</li>
                  <li>{t("rule2")}</li>
                  <li>{t("rule3")}</li>
                  <li>{t("rule4")}</li>
                </ol>
                <p className="deck-note">{t("deckHint")}</p>
              </section>
            </>
          )}

          <section className="card multiplayer-entry" aria-labelledby="multiplayer-entry-title">
            {!roomProjection && (
              <div>
                <h2 id="multiplayer-entry-title">{t("multiplayer")}</h2>
                <p className="deck-note">{t("entryHint")}</p>
              </div>
            )}
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
            {roomEntry.error && <p className="room-entry-error" role="alert">{t(roomErrorCopyKey(roomEntry.error))}</p>}
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
                      }}
                    />
                    <button className="ghost-button" disabled={!roomEntry.connected || !roomProjection.snapshot.allowedCommands.includes("forfeit")} onClick={roomEntry.forfeit}>
                      {t("forfeitMatch")}
                    </button>
                  </div>
                )}
                {roomEntry.bellTooSlow && (
                  <p className="multiplayer-event">{t("staleBellEvent")}</p>
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
                    <p>{roomProjection.snapshot.result.winnerName === null || roomProjection.snapshot.result.score === null
                      ? t("matchResultNoWinner")
                      : t("matchResult", {
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
      </section>
    </main>
  );
}
