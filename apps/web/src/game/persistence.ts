import { DEFAULT_SETTINGS, LEGACY_PROGRESS_KEYS, SETTINGS_KEY } from "./constants.js";
import type { Difficulty, GameSettings, Language } from "./types.js";

type JsonRecord = Record<string, unknown>;

const VALID_DIFFICULTIES = new Set<Difficulty>(["easy", "normal", "hard"]);
const VALID_DURATIONS = new Set([45, 60, 90]);
const VALID_TABLE_SEAT_COUNTS = new Set([4, 5, 6, 7, 8]);
const VALID_LANGUAGES = new Set<Language>(["zh", "en"]);

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
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

function isTableSeatCount(value: unknown): value is number {
  return typeof value === "number" && VALID_TABLE_SEAT_COUNTS.has(value);
}

function loadJson<T>(key: string, fallback: T): T {
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

function saveJson(key: string, value: unknown): boolean {
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
    tableSeatCount: isTableSeatCount(next.tableSeatCount)
      ? next.tableSeatCount
      : DEFAULT_SETTINGS.tableSeatCount,
    language: isLanguage(next.language)
      ? next.language
      : DEFAULT_SETTINGS.language,
    soundEnabled:
      typeof next.soundEnabled === "boolean"
        ? next.soundEnabled
        : DEFAULT_SETTINGS.soundEnabled,
  };
}

export function loadSettings(): GameSettings {
  return normalizeSettings(loadJson(SETTINGS_KEY, DEFAULT_SETTINGS));
}

export function saveSettings(settings: GameSettings): boolean {
  return saveJson(SETTINGS_KEY, normalizeSettings(settings));
}

export function removeLegacyProgress(): void {
  if (typeof window === "undefined") return;

  for (const key of LEGACY_PROGRESS_KEYS) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      return;
    }
  }
}

export { SETTINGS_KEY };
