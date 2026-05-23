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
import type {
  AchievementKey,
  Achievements,
  DailyGoal,
  Difficulty,
  GameMode,
  GameSettings,
  HistoryEntry,
  Language,
  RoundSummary,
} from "./types.js";

type JsonRecord = Record<string, unknown>;

const VALID_DIFFICULTIES = new Set<Difficulty>(["easy", "normal", "hard"]);
const VALID_DURATIONS = new Set([45, 60, 90]);
const VALID_PLAYER_COUNTS = new Set([3, 4, 5, 6]);
const VALID_LANGUAGES = new Set<Language>(["zh", "en"]);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function clampNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}

function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && VALID_DIFFICULTIES.has(value as Difficulty);
}

function isLanguage(value: unknown): value is Language {
  return typeof value === "string" && VALID_LANGUAGES.has(value as Language);
}

function isDuration(value: unknown): value is number {
  return typeof value === "number" && VALID_DURATIONS.has(value);
}

function isPlayerCount(value: unknown): value is number {
  return typeof value === "number" && VALID_PLAYER_COUNTS.has(value);
}

function isGameMode(value: unknown): value is GameMode {
  return typeof value === "string" && VALID_MODES.includes(value as GameMode);
}

export function loadJson<T>(key: string, fallback: T): T {
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

export function saveJson(key: string, value: unknown): boolean {
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

export function normalizeSettings(value: unknown): GameSettings {
  const next = asRecord(value);

  return {
    difficulty: isDifficulty(next.difficulty)
      ? next.difficulty
      : DEFAULT_SETTINGS.difficulty,
    duration: isDuration(next.duration)
      ? next.duration
      : DEFAULT_SETTINGS.duration,
    playerCount: isPlayerCount(next.playerCount)
      ? next.playerCount
      : DEFAULT_SETTINGS.playerCount,
    language: isLanguage(next.language)
      ? next.language
      : DEFAULT_SETTINGS.language,
    soundEnabled:
      typeof next.soundEnabled === "boolean"
        ? next.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
  };
}

export function normalizeSummary(value: unknown): RoundSummary {
  const next = asRecord(value);
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
    difficulty: isDifficulty(next.difficulty)
      ? next.difficulty
      : INITIAL_SUMMARY.difficulty,
    durationSec: isDuration(next.durationSec)
      ? next.durationSec
      : INITIAL_SUMMARY.durationSec,
    playerCount: isPlayerCount(next.playerCount)
      ? next.playerCount
      : INITIAL_SUMMARY.playerCount,
  };
}

export function loadSettings(): GameSettings {
  return normalizeSettings(loadJson(SETTINGS_KEY, DEFAULT_SETTINGS));
}

export function loadBestSummary(): RoundSummary {
  return normalizeSummary(loadJson(BEST_KEY, INITIAL_SUMMARY));
}

export function loadRecentSummary(): RoundSummary {
  return normalizeSummary(loadJson(RECENT_KEY, INITIAL_SUMMARY));
}

export function normalizeHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== "object") return null;
  const next = asRecord(value);
  const summary = normalizeSummary(value);
  const ts = clampNumber(next.ts, Date.now());
  const mode = isGameMode(next.mode) ? next.mode : "solo";
  return { ts, mode, ...summary };
}

export function loadHistory(): HistoryEntry[] {
  const raw = loadJson(HISTORY_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeHistoryEntry)
    .filter((entry): entry is HistoryEntry => entry !== null);
}

export function appendHistoryEntry(entry: unknown): HistoryEntry[] {
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

export function normalizeDailyGoal(value: unknown): DailyGoal {
  const today = toLocalDateStr();
  const next = asRecord(value);
  return {
    date:
      typeof next.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(next.date)
        ? next.date
        : today,
    completedRounds: Math.max(0, clampInteger(next.completedRounds, 0)),
    goalReached: typeof next.goalReached === "boolean" ? next.goalReached : false,
  };
}

export function loadDailyGoal(): DailyGoal {
  const today = toLocalDateStr();
  const raw = loadJson(DAILY_GOAL_KEY, null);
  const normalized = normalizeDailyGoal(raw);
  if (normalized.date !== today) {
    return { date: today, completedRounds: 0, goalReached: false };
  }
  return normalized;
}

export function saveDailyGoal(goal: DailyGoal): void {
  saveJson(DAILY_GOAL_KEY, goal);
}

export function normalizeAchievements(value: unknown): Achievements {
  const next = asRecord(value);
  const result = {} as Achievements;
  for (const key of ACHIEVEMENT_KEYS) {
    const unlockedAt = next[key];
    result[key] =
      typeof unlockedAt === "number" && Number.isFinite(unlockedAt) ? unlockedAt : null;
  }
  return result;
}

export function loadAchievements(): Achievements {
  return normalizeAchievements(loadJson(ACHIEVEMENTS_KEY, {}));
}

export function unlockAchievement(key: AchievementKey, current: Achievements): Achievements {
  if (current[key]) return current;
  const next = { ...current, [key]: Date.now() };
  saveJson(ACHIEVEMENTS_KEY, next);
  return next;
}

export { SETTINGS_KEY, BEST_KEY, RECENT_KEY, HISTORY_KEY, DAILY_GOAL_KEY, ACHIEVEMENTS_KEY, DAILY_TARGET_ROUNDS };
