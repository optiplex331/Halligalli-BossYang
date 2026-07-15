export type FruitKey = "banana" | "strawberry" | "lemon" | "grape";
export type Difficulty = "easy" | "normal" | "hard";
export type Language = "zh" | "en";

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
  isHuman: boolean;
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
  reactionTimes: number[];
  scoreBreakdown: ScoreBreakdown;
  difficulty: Difficulty;
  durationSec: number;
  tableSeatCount: number;
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
  tableSeatCount: number;
}

export interface GameSettings {
  difficulty: Difficulty;
  duration: number;
  tableSeatCount: number;
  language: Language;
  soundEnabled: boolean;
}
