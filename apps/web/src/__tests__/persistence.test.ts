import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LEGACY_PROGRESS_KEYS } from "../game/constants.js";
import {
  loadSettings,
  normalizeSettings,
  removeLegacyProgress,
  saveSettings,
} from "../game/persistence.js";

describe("Local Preferences", () => {
  const originalWindow = globalThis.window;
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    globalThis.window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, String(value)),
        removeItem: (key: string) => store.delete(key),
      },
    } as unknown as Window & typeof globalThis;
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  it("normalizes the retained settings record, including the V1 two-seat choice", () => {
    expect(normalizeSettings({ playerCount: 2, language: "zh", soundEnabled: false })).toEqual({
      difficulty: "normal",
      duration: 60,
      playerCount: 2,
      language: "zh",
      soundEnabled: false,
    });
  });

  it("persists only normalized settings", () => {
    saveSettings({ difficulty: "hard", duration: 90, playerCount: 6, language: "en", soundEnabled: true });

    expect(loadSettings()).toEqual({
      difficulty: "hard",
      duration: 90,
      playerCount: 6,
      language: "en",
      soundEnabled: true,
    });
  });

  it("removes every legacy progress record without touching settings", () => {
    saveSettings({ difficulty: "easy", duration: 45, playerCount: 3, language: "zh", soundEnabled: false });
    for (const key of LEGACY_PROGRESS_KEYS) {
      store.set(key, "legacy");
    }

    removeLegacyProgress();

    expect([...store.keys()]).toEqual(["halligalli_settings"]);
  });
});
