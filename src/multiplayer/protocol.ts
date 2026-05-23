import type {
  Card,
  Difficulty,
  FruitKey,
  Language,
  ScoreBreakdown,
} from "../game/types.js";

export type RoomCode = string;
export type SeatIndex = number;
export type PlayerId = number;

export interface RoomPlayerProjection {
  id: PlayerId;
  name: string;
  ready: boolean;
  connected: boolean;
  seatIndex: SeatIndex;
  isHost: boolean;
}

export interface RoomProjection {
  code: RoomCode;
  hostId: PlayerId;
  maxPlayers: number;
  difficulty: Difficulty;
  duration: number;
  language: Language;
  state: "lobby" | "playing" | "finished";
  players: RoomPlayerProjection[];
}

export interface SeatMapEntry {
  id: PlayerId;
  name: string;
}

export type SeatMap = Array<SeatMapEntry | undefined>;
export type TopCards = Array<Card | null>;

export interface RoomCreateIntent {
  playerName?: string;
  maxPlayers?: number;
  difficulty?: Difficulty;
  duration?: number;
  language?: Language;
}

export interface RoomJoinIntent {
  code?: string;
  playerName?: string;
}

export interface RoomReadyIntent {
  ready?: boolean;
}

export interface RoomCreatedPayload {
  code: RoomCode;
  playerId: PlayerId;
  room: RoomProjection;
}

export interface RoomJoinedPayload {
  playerId: PlayerId;
  room: RoomProjection;
}

export interface RoomPlayerUpdatePayload {
  players: RoomPlayerProjection[];
}

export interface RoomErrorPayload {
  message: string;
  messageZh: string;
}

export interface RoomDissolvedPayload {
  reason: "timeout";
}

export interface GameStartPayload {
  playerCount: number;
  difficulty: Difficulty;
  duration: number;
  topCards: TopCards;
  seatMap: SeatMap;
}

export interface GameYourSeatPayload {
  seatIndex: SeatIndex;
}

export interface GameFlipPayload {
  seatIndex: SeatIndex;
  card: Card | null;
  nextTurn: SeatIndex;
  bellAvailable: boolean;
  bellFruitKey: FruitKey | null;
  topCards: TopCards;
}

export interface GameMissedPayload {
  fruitKey: FruitKey | null;
}

export interface CorrectBellResultPayload {
  type: "correct";
  winnerId: SeatIndex;
  collectedCount: number;
  reactionMs: number;
  earned: number;
  topCards: TopCards;
}

export interface WrongBellResultPayload {
  type: "wrong";
  playerId: SeatIndex;
  penaltyCount: number;
  bellAvailable: boolean;
  bellFruitKey: FruitKey | null;
  topCards: TopCards;
}

export type GameBellResultPayload = CorrectBellResultPayload | WrongBellResultPayload;

export interface GameTickPayload {
  secondsLeft: number;
}

export interface MultiplayerResult {
  seatIndex: SeatIndex;
  score: number;
  correctHits: number;
  wrongHits: number;
  missedHits: number;
  accuracy: number;
  avgReactionMs: number;
  bestReactionMs: number;
  scoreBreakdown: ScoreBreakdown;
}

export type MultiplayerResults = Record<string, MultiplayerResult>;

export interface GameEndPayload {
  results: MultiplayerResults;
}

export interface ClientToServerEvents {
  "room:create": (payload: RoomCreateIntent) => void;
  "room:join": (payload: RoomJoinIntent) => void;
  "room:ready": (payload: RoomReadyIntent) => void;
  "room:start": () => void;
  "game:bell": () => void;
  "room:leave": () => void;
}

export interface ServerToClientEvents {
  "room:created": (payload: RoomCreatedPayload) => void;
  "room:joined": (payload: RoomJoinedPayload) => void;
  "room:player-update": (payload: RoomPlayerUpdatePayload) => void;
  "room:error": (payload: RoomErrorPayload) => void;
  "room:dissolved": (payload: RoomDissolvedPayload) => void;
  "game:start": (payload: GameStartPayload) => void;
  "game:your-seat": (payload: GameYourSeatPayload) => void;
  "game:flip": (payload: GameFlipPayload) => void;
  "game:missed": (payload: GameMissedPayload) => void;
  "game:bell-result": (payload: GameBellResultPayload) => void;
  "game:tick": (payload: GameTickPayload) => void;
  "game:end": (payload: GameEndPayload) => void;
}
