export const FRUIT_KEYS = ["banana", "strawberry", "lemon", "grape"];

export const SETTINGS_KEY = "halligalli_settings";
export const BEST_KEY = "halligalli_best";
export const RECENT_KEY = "halligalli_recent";

export const DEFAULT_SETTINGS = {
  difficulty: "normal",
  duration: 60,
  playerCount: 4,
  language: "zh",
  soundEnabled: true,
};

export const INITIAL_SUMMARY = {
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

export const INITIAL_BREAKDOWN = {
  correctBase: 0,
  collectionBonus: 0,
  speedBonus: 0,
  streakBonus: 0,
  wrongPenalty: 0,
  missedPenalty: 0,
  cardPenalty: 0,
};
