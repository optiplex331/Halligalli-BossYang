import type {
  FruitKey,
  GameSettings,
  ScoreBreakdown,
} from "./types.js";

export const FRUIT_KEYS = ["banana", "strawberry", "lemon", "grape"] as const satisfies readonly FruitKey[];

export const COUNT_DISTRIBUTION = [
  [1, 3],
  [2, 5],
  [3, 5],
  [4, 3],
  [5, 2],
] as const satisfies readonly (readonly [count: number, repeat: number])[];

export const SETTINGS_KEY = "halligalli_settings";
export const LEGACY_PROGRESS_KEYS = [
  "halligalli_best",
  "halligalli_recent",
  "halligalli_history",
  "halligalli_daily",
  "halligalli_achievements",
] as const;

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: "normal",
  duration: 60,
  tableSeatCount: 4,
  language: "en",
  soundEnabled: true,
};

export const INITIAL_BREAKDOWN: ScoreBreakdown = {
  correctBase: 0,
  collectionBonus: 0,
  speedBonus: 0,
  streakBonus: 0,
  wrongPenalty: 0,
  missedPenalty: 0,
  cardPenalty: 0,
};

export const MISSED_BELL_PENALTY = 30;
