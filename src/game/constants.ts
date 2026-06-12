import type {
  AchievementKey,
  FruitKey,
  GameMode,
  GameSettings,
  RoundSummary,
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
export const BEST_KEY = "halligalli_best";
export const RECENT_KEY = "halligalli_recent";
export const HISTORY_KEY = "halligalli_history";
export const MAX_HISTORY = 100;
export const VALID_MODES = ["solo", "multi"] as const satisfies readonly GameMode[];
export const DAILY_GOAL_KEY = "halligalli_daily";
export const ACHIEVEMENTS_KEY = "halligalli_achievements";
export const DAILY_TARGET_ROUNDS = 5;
export const ACHIEVEMENT_KEYS = [
  "first_win",
  "streak_5",
  "perfect_round",
  "sub_200ms",
  "daily_3",
] as const satisfies readonly AchievementKey[];

export const DEFAULT_SETTINGS: GameSettings = {
  difficulty: "normal",
  duration: 60,
  playerCount: 4,
  language: "en",
  soundEnabled: true,
};

export const INITIAL_SUMMARY: RoundSummary = {
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

export const INITIAL_BREAKDOWN: ScoreBreakdown = {
  correctBase: 0,
  collectionBonus: 0,
  speedBonus: 0,
  streakBonus: 0,
  wrongPenalty: 0,
  missedPenalty: 0,
  cardPenalty: 0,
};
