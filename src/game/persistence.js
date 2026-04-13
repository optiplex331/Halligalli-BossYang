import {
  BEST_KEY,
  DEFAULT_SETTINGS,
  INITIAL_SUMMARY,
  RECENT_KEY,
  SETTINGS_KEY,
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

export { SETTINGS_KEY, BEST_KEY, RECENT_KEY };
