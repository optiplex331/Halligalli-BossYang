export type FruitKey = "banana" | "strawberry" | "lemon" | "grape";
export type Difficulty = "easy" | "normal" | "hard";
export type Language = "zh" | "en";
export type GameMode = "solo" | "multi";
export type AchievementKey =
  | "first_win"
  | "streak_5"
  | "perfect_round"
  | "sub_200ms"
  | "daily_3";

export interface FruitDefinition {
  key: FruitKey;
  label?: string;
  labelEn?: string;
  icon?: string;
}

export interface Card {
  id: string;
  fruit: FruitKey;
  count: number;
}

export interface SeatLayout {
  labelZh: string;
  labelEn: string;
  gridArea: string;
  isUser?: true;
}

export interface PlayerState {
  id: number;
  labelZh: string;
  labelEn: string;
  drawPile: Card[];
  wonPile: Card[];
  faceUpPile: Card[];
}

export type VisibleTotals = Record<FruitKey, number>;

export interface BellEvaluation {
  available: boolean;
  fruitKey: FruitKey | null;
  totals: VisibleTotals;
}

export interface BellState {
  available: boolean;
  fruitKey: FruitKey | null;
  startedAt: number;
  handled: boolean;
}

export interface ScoreBreakdown {
  correctBase: number;
  collectionBonus: number;
  speedBonus: number;
  streakBonus: number;
  wrongPenalty: number;
  missedPenalty: number;
  cardPenalty: number;
}

export interface RoundSnapshot {
  correctHits: number;
  wrongHits: number;
  missedHits: number;
  reactionTimes?: number[];
  scoreBreakdown?: ScoreBreakdown;
  difficulty?: Difficulty;
  durationSec?: number;
  playerCount?: number;
  maxStreak?: number;
}

export interface RoundSummary {
  score: number;
  correctHits: number;
  wrongHits: number;
  missedHits: number;
  accuracy: number;
  avgReactionMs: number;
  bestReactionMs: number;
  difficulty: Difficulty;
  durationSec: number;
  playerCount: number;
}

export interface HistoryEntry extends RoundSummary {
  ts: number;
  mode: GameMode;
}

export interface TrendPoint {
  date: string;
  value: number | null;
}

export interface GameSettings {
  difficulty: Difficulty;
  duration: number;
  playerCount: number;
  language: Language;
  soundEnabled: boolean;
}

export interface DailyGoal {
  date: string;
  completedRounds: number;
  goalReached: boolean;
}

export type Achievements = Record<AchievementKey, number | null>;
