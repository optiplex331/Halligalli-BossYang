import {
  ACHIEVEMENTS_KEY,
  ACHIEVEMENT_KEYS,
  BEST_KEY,
  DAILY_GOAL_KEY,
  DAILY_TARGET_ROUNDS,
  DEFAULT_SETTINGS,
  HISTORY_KEY,
  INITIAL_SUMMARY,
  MAX_HISTORY,
  RECENT_KEY,
  SETTINGS_KEY,
  VALID_MODES,
} from "./constants.js";

const VALID_DIFFICULTIES = new Set(["easy", "normal", "hard"]);
const VALID_DURATIONS = new Set([45, 60, 90]);
const VALID_PLAYER_COUNTS = new Set([3, 4, 5, 6]);
const VALID_LANGUAGES = new Set(["zh", "en"]);

function clampNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

function clampInteger(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

export function loadJson(key, fallback) {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key, value) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function normalizeSettings(value) {
  const next = value && typeof value === "object" ? value : {};

  return {
    difficulty: VALID_DIFFICULTIES.has(next.difficulty)
      ? next.difficulty
      : DEFAULT_SETTINGS.difficulty,
    duration: VALID_DURATIONS.has(next.duration)
      ? next.duration
      : DEFAULT_SETTINGS.duration,
    playerCount: VALID_PLAYER_COUNTS.has(next.playerCount)
      ? next.playerCount
      : DEFAULT_SETTINGS.playerCount,
    language: VALID_LANGUAGES.has(next.language)
      ? next.language
      : DEFAULT_SETTINGS.language,
    soundEnabled:
      typeof next.soundEnabled === "boolean"
        ? next.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
  };
}

export function normalizeSummary(value) {
  const next = value && typeof value === "object" ? value : {};
  const correctHits = Math.max(0, clampInteger(next.correctHits, INITIAL_SUMMARY.correctHits));
  const wrongHits = Math.max(0, clampInteger(next.wrongHits, INITIAL_SUMMARY.wrongHits));
  const missedHits = Math.max(0, clampInteger(next.missedHits, INITIAL_SUMMARY.missedHits));
  const totalOutcomes = correctHits + wrongHits + missedHits;
  const accuracy =
    totalOutcomes > 0
      ? correctHits / totalOutcomes
      : Math.min(1, Math.max(0, clampNumber(next.accuracy, INITIAL_SUMMARY.accuracy)));

  return {
    score: Math.max(0, clampNumber(next.score, INITIAL_SUMMARY.score)),
    correctHits,
    wrongHits,
    missedHits,
    accuracy,
    avgReactionMs: Math.max(0, clampNumber(next.avgReactionMs, INITIAL_SUMMARY.avgReactionMs)),
    bestReactionMs: Math.max(0, clampNumber(next.bestReactionMs, INITIAL_SUMMARY.bestReactionMs)),
    difficulty: VALID_DIFFICULTIES.has(next.difficulty)
      ? next.difficulty
      : INITIAL_SUMMARY.difficulty,
    durationSec: VALID_DURATIONS.has(next.durationSec)
      ? next.durationSec
      : INITIAL_SUMMARY.durationSec,
    playerCount: VALID_PLAYER_COUNTS.has(next.playerCount)
      ? next.playerCount
      : INITIAL_SUMMARY.playerCount,
  };
}

export function loadSettings() {
  return normalizeSettings(loadJson(SETTINGS_KEY, DEFAULT_SETTINGS));
}

export function loadBestSummary() {
  return normalizeSummary(loadJson(BEST_KEY, INITIAL_SUMMARY));
}

export function loadRecentSummary() {
  return normalizeSummary(loadJson(RECENT_KEY, INITIAL_SUMMARY));
}

export function normalizeHistoryEntry(value) {
  if (!value || typeof value !== "object") return null;
  const summary = normalizeSummary(value);
  const ts = Number.isFinite(value.ts) ? value.ts : Date.now();
  const mode = VALID_MODES.includes(value.mode) ? value.mode : "solo";
  return { ts, mode, ...summary };
}

export function loadHistory() {
  const raw = loadJson(HISTORY_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeHistoryEntry)
    .filter((entry) => entry !== null);
}

export function appendHistoryEntry(entry) {
  const normalized = normalizeHistoryEntry(entry);
  if (!normalized) return loadHistory();
  const next = [normalized, ...loadHistory()].slice(0, MAX_HISTORY);
  saveJson(HISTORY_KEY, next);
  return next;
}

function toLocalDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function normalizeDailyGoal(value) {
  const today = toLocalDateStr();
  const next = value && typeof value === "object" ? value : {};
  return {
    date:
      typeof next.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(next.date)
        ? next.date
        : today,
    completedRounds: Math.max(0, clampInteger(next.completedRounds, 0)),
    goalReached: typeof next.goalReached === "boolean" ? next.goalReached : false,
  };
}

export function loadDailyGoal() {
  const today = toLocalDateStr();
  const raw = loadJson(DAILY_GOAL_KEY, null);
  const normalized = normalizeDailyGoal(raw);
  if (normalized.date !== today) {
    return { date: today, completedRounds: 0, goalReached: false };
  }
  return normalized;
}

export function saveDailyGoal(goal) {
  saveJson(DAILY_GOAL_KEY, goal);
}

export function normalizeAchievements(value) {
  const next = value && typeof value === "object" ? value : {};
  const result = {};
  for (const key of ACHIEVEMENT_KEYS) {
    result[key] = Number.isFinite(next[key]) ? next[key] : null;
  }
  return result;
}

export function loadAchievements() {
  return normalizeAchievements(loadJson(ACHIEVEMENTS_KEY, {}));
}

export function unlockAchievement(key, current) {
  if (current[key]) return current;
  const next = { ...current, [key]: Date.now() };
  saveJson(ACHIEVEMENTS_KEY, next);
  return next;
}

export { SETTINGS_KEY, BEST_KEY, RECENT_KEY, HISTORY_KEY, DAILY_GOAL_KEY, ACHIEVEMENTS_KEY, DAILY_TARGET_ROUNDS };
